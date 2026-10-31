const db = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

const r2 = n => (n === null || n === undefined ? null : Math.round(Number(n) * 100) / 100);
const pct = (a, b) => (b > 0 ? r2((a / b) * 100) : 0);
const q = async (sql, p = []) => (await db.query(sql, p))[0];

// Ideal storage ranges by crop name (°C / % RH). Reference values used only for flagging.
const IDEAL = {
  Banana: [13, 15, 85, 95]
};
const DEFAULT_IDEAL = [10, 25, 50, 90];

const STAGES = [ // consecutive pairs used for stage-loss calculation
  ['collection', 'q_harvest', 'q_collection'], ['storage', 'q_collection', 'q_storage'],
  ['transportation', 'q_storage', 'q_transport'], ['distribution', 'q_transport', 'q_distribution'],
  ['retail', 'q_distribution', 'q_retail']
];
const STAGE_ORDER = ['harvest', 'collection', 'storage', 'transport', 'distribution', 'retail'];

/* ───────── SUMMARY ───────── */
async function summary() {
  const [t] = await q(`SELECT
      (SELECT COUNT(*) FROM crops) total_crops,
      (SELECT COALESCE(SUM(quantity),0) FROM harvest) harvested,
      (SELECT COALESCE(SUM(quantity_received),0) FROM collection) collected,
      (SELECT COALESCE(SUM(quantity_stored),0) FROM storage) stored_qty,
      (SELECT COALESCE(SUM(quantity_received),0) FROM distribution) distributed,
      (SELECT COALESCE(SUM(quantity_transported),0) FROM transportation) transported,
      (SELECT COALESCE(SUM(quantity_sold),0) FROM retail) sold,
      (SELECT COALESCE(SUM(quantity_wasted),0) FROM wastage) wasted,
      (SELECT COUNT(*) FROM harvest) total_chains,
      (SELECT COUNT(*) FROM v_harvest_flow WHERE q_retail IS NULL) active_chains`);
  const [price] = await q(`SELECT AVG(price) avg_price FROM market_prices mp
      WHERE recorded_date = (SELECT MAX(recorded_date) FROM market_prices x WHERE x.crop_id = mp.crop_id AND x.market = mp.market)`);
  const [dem] = await q(`SELECT SUM(demand_quantity) current_demand FROM demand d
      WHERE demand_date = (SELECT MAX(demand_date) FROM demand x WHERE x.crop_id = d.crop_id AND x.market = d.market)`);
  const [loss] = await q(`SELECT
      COALESCE(SUM(CASE WHEN q_collection IS NOT NULL AND q_storage IS NOT NULL THEN q_collection - q_storage END),0) storage_loss,
      COALESCE(SUM(CASE WHEN q_storage IS NOT NULL AND q_transport IS NOT NULL THEN q_storage - q_transport END),0) transport_loss,
      COALESCE(SUM(CASE WHEN q_retail IS NOT NULL THEN q_harvest - q_retail END),0) completed_loss,
      COALESCE(SUM(CASE WHEN q_retail IS NOT NULL THEN q_harvest END),0) completed_input
    FROM v_harvest_flow`);
  return {
    total_crops: t.total_crops, total_harvested_kg: r2(t.harvested), total_collected_kg: r2(t.collected), total_stored_kg: r2(t.stored_qty),
    total_distributed_kg: r2(t.distributed), total_transported_kg: r2(t.transported),
    total_sold_kg: r2(t.sold), total_wastage_kg: r2(t.wasted), wastage_percentage: pct(t.wasted, t.harvested),
    avg_market_price: r2(price.avg_price), current_demand_kg: r2(dem.current_demand),
    active_supply_chains: t.active_chains, total_supply_chains: t.total_chains,
    storage_loss_kg: r2(loss.storage_loss), transportation_loss_kg: r2(loss.transport_loss),
    completed_chain_loss_pct: pct(loss.completed_loss, loss.completed_input)
  };
}

/* ───────── STAGE LOSSES (Harvest → Retail) ───────── */
async function stageLosses({ crop_id } = {}) {
  const where = crop_id ? 'WHERE crop_id = ?' : '';
  const p = crop_id ? [crop_id] : [];
  const stages = [];
  for (const [name, from, to] of STAGES) {
    // Only harvests that reached this stage are compared, so in-progress chains don't look like losses.
    const [row] = await q(`SELECT COUNT(*) n, COALESCE(SUM(${from}),0) input, COALESCE(SUM(${to}),0) output
                           FROM v_harvest_flow ${where ? where + ' AND' : 'WHERE'} ${to} IS NOT NULL AND ${from} IS NOT NULL`, p);
    stages.push({ stage: name, chains: row.n, input_kg: r2(row.input), output_kg: r2(row.output),
                  loss_kg: r2(row.input - row.output), loss_pct: pct(row.input - row.output, row.input) });
  }
  const worst = stages.filter(s => s.chains > 0).sort((a, b) => b.loss_kg - a.loss_kg)[0] || null;
  return { stages, largest_loss_stage: worst && { stage: worst.stage, loss_kg: worst.loss_kg, loss_pct: worst.loss_pct } };
}

/* ───────── WASTAGE BY DIMENSION ───────── */
async function wastage(groupBy = 'stage') {
  let rows;
  switch (groupBy) {
    case 'stage':
      rows = await q(`SELECT stage label, SUM(quantity_wasted) quantity FROM wastage GROUP BY stage
                      ORDER BY FIELD(stage,'harvest','collection','storage','transportation','distribution','retail')`); break;
    case 'crop':
      rows = await q(`SELECT c.crop_name label, SUM(w.quantity_wasted) quantity,
                      (SELECT COALESCE(SUM(h.quantity),0) FROM harvest h WHERE h.crop_id = c.crop_id) input
                      FROM wastage w JOIN crops c ON c.crop_id = w.crop_id GROUP BY c.crop_id, c.crop_name ORDER BY quantity DESC`); break;
    case 'date':
      rows = await q(`SELECT DATE_FORMAT(recorded_date,'%Y-%m') label, SUM(quantity_wasted) quantity FROM wastage
                      GROUP BY label ORDER BY label`); break;
    case 'location': // derived from the chain flow: harvest quantity minus what survived the furthest stage reached
      rows = await q(`SELECT location label,
                      SUM(q_harvest - COALESCE(q_retail,q_distribution,q_transport,q_storage,q_collection,q_harvest)) quantity,
                      SUM(q_harvest) input FROM v_harvest_flow GROUP BY location ORDER BY quantity DESC`); break;
    case 'storage':
      rows = await q(`SELECT s.storage_location label, SUM(c.quantity_received - s.quantity_stored) quantity, SUM(c.quantity_received) input
                      FROM storage s JOIN collection c ON c.collection_id = s.collection_id
                      GROUP BY s.storage_location ORDER BY quantity DESC`); break;
    case 'transportation':
      rows = await q(`SELECT t.vehicle_number label, SUM(s.quantity_stored - t.quantity_transported) quantity, SUM(s.quantity_stored) input
                      FROM transportation t JOIN storage s ON s.storage_id = t.storage_id
                      GROUP BY t.vehicle_number ORDER BY quantity DESC`); break;
    default: throw new ApiError(400, 'group_by must be one of: stage, crop, location, date, storage, transportation');
  }
  return { group_by: groupBy, data: rows.map(r => ({ label: r.label, quantity_kg: r2(r.quantity), ...(r.input ? { input_kg: r2(r.input), loss_pct: pct(r.quantity, r.input) } : {}) })) };
}

/* ───────── PRICES ───────── */
async function prices({ crop_id } = {}) {
  const f = crop_id ? 'WHERE mp.crop_id = ?' : '', p = crop_id ? [crop_id] : [];
  const latest = await q(`SELECT crop_id, crop_name, market, state, district, variety, grade, price, min_price, max_price, arrivals_quintal, source, data_status, recorded_date, prev_price FROM (
      SELECT mp.crop_id, c.crop_name, mp.market, mp.state, mp.district, mp.variety, mp.grade, mp.price, mp.min_price, mp.max_price, mp.arrivals_quintal, mp.source, mp.data_status, mp.recorded_date,
             ROW_NUMBER() OVER (PARTITION BY mp.crop_id, mp.market ORDER BY mp.recorded_date DESC) rn,
             LEAD(mp.price) OVER (PARTITION BY mp.crop_id, mp.market ORDER BY mp.recorded_date DESC) prev_price
      FROM market_prices mp JOIN crops c ON c.crop_id = mp.crop_id ${f}) x WHERE rn = 1 ORDER BY crop_name, market`, p);
  const history = await q(`SELECT mp.crop_id, c.crop_name, mp.recorded_date, ROUND(AVG(mp.price),2) avg_price
      FROM market_prices mp JOIN crops c ON c.crop_id = mp.crop_id ${f}
      GROUP BY mp.crop_id, c.crop_name, mp.recorded_date ORDER BY mp.recorded_date`, p);
  return {
    latest: latest.map(r => ({ crop_id: r.crop_id, crop_name: r.crop_name, market: r.market, state: r.state, district: r.district, variety: r.variety, grade: r.grade, price: r.price, min_price: r.min_price, max_price: r.max_price, arrivals_quintal: r.arrivals_quintal, source: r.source, data_status: r.data_status, recorded_date: r.recorded_date,
      previous_price: r.prev_price, change: r.prev_price == null ? null : r2(r.price - r.prev_price),
      change_pct: r.prev_price ? pct(r.price - r.prev_price, r.prev_price) : null })),
    history
  };
}

/* ───────── DEMAND ───────── */
async function demand({ crop_id } = {}) {
  const f = crop_id ? 'WHERE d.crop_id = ?' : '', p = crop_id ? [crop_id] : [];
  const current = await q(`SELECT crop_id, crop_name, market, demand_quantity, demand_date FROM (
      SELECT d.crop_id, c.crop_name, d.market, d.demand_quantity, d.demand_date,
             ROW_NUMBER() OVER (PARTITION BY d.crop_id, d.market ORDER BY d.demand_date DESC) rn
      FROM demand d JOIN crops c ON c.crop_id = d.crop_id ${f}) x WHERE rn = 1 ORDER BY crop_name, market`, p);
  const history = await q(`SELECT d.crop_id, c.crop_name, d.demand_date, SUM(d.demand_quantity) total_demand
      FROM demand d JOIN crops c ON c.crop_id = d.crop_id ${f} GROUP BY d.crop_id, c.crop_name, d.demand_date ORDER BY d.demand_date`, p);
  const byCrop = {}, byMarket = {};
  current.forEach(r => { byCrop[r.crop_name] = (byCrop[r.crop_name] || 0) + r.demand_quantity; byMarket[r.market] = (byMarket[r.market] || 0) + r.demand_quantity; });
  const toList = o => Object.entries(o).map(([label, quantity_kg]) => ({ label, quantity_kg: r2(quantity_kg) })).sort((a, b) => b.quantity_kg - a.quantity_kg);
  return { current, by_crop: toList(byCrop), by_market: toList(byMarket), history };
}

/* ───────── STORAGE ANALYTICS ───────── */
async function storage() {
  const rows = await q(`SELECT s.storage_id, s.storage_location, cr.crop_name, s.temperature, s.humidity, s.storage_start, s.storage_end,
        c.quantity_received, s.quantity_stored, DATEDIFF(COALESCE(s.storage_end, CURDATE()), s.storage_start) duration_days
      FROM storage s JOIN collection c ON c.collection_id = s.collection_id
      JOIN harvest h ON h.harvest_id = c.harvest_id JOIN crops cr ON cr.crop_id = h.crop_id ORDER BY s.storage_start DESC`);
  return rows.map(r => {
    const [tl, th, hl, hh] = IDEAL[r.crop_name] || DEFAULT_IDEAL, issues = [];
    if (r.temperature != null && r.temperature > th) issues.push(`Temperature ${r.temperature}°C above ${th}°C`);
    if (r.temperature != null && r.temperature < tl) issues.push(`Temperature ${r.temperature}°C below ${tl}°C`);
    if (r.humidity != null && r.humidity < hl) issues.push(`Humidity ${r.humidity}% below ${hl}%`);
    if (r.humidity != null && r.humidity > hh) issues.push(`Humidity ${r.humidity}% above ${hh}%`);
    const loss = r.quantity_received - r.quantity_stored;
    const lossPct = pct(loss, r.quantity_received);
    if (lossPct >= 8) issues.push(`High quantity loss (${lossPct}%)`);
    return { ...r, ideal: { temp_min: tl, temp_max: th, humidity_min: hl, humidity_max: hh },
             loss_kg: r2(loss), loss_pct: lossPct, status: issues.length ? (lossPct >= 8 || issues.length > 1 ? 'critical' : 'warning') : 'ok', issues };
  });
}

/* ───────── TRANSPORTATION ANALYTICS ───────── */
async function transportation() {
  const rows = await q(`SELECT t.transport_id, t.source, t.destination, t.vehicle_number, t.distance, t.transport_duration, t.transport_date,
        s.quantity_stored, t.quantity_transported, cr.crop_name
      FROM transportation t JOIN storage s ON s.storage_id = t.storage_id JOIN collection c ON c.collection_id = s.collection_id
      JOIN harvest h ON h.harvest_id = c.harvest_id JOIN crops cr ON cr.crop_id = h.crop_id ORDER BY t.transport_date DESC`);
  return rows.map(r => {
    const loss = r.quantity_stored - r.quantity_transported;
    const speed = r.transport_duration > 0 && r.distance ? r2(r.distance / r.transport_duration) : null;
    const flags = [];
    if (speed !== null && speed < 35) flags.push(`Slow average speed (${speed} km/h)`);
    if (pct(loss, r.quantity_stored) >= 5) flags.push(`High transit loss (${pct(loss, r.quantity_stored)}%)`);
    return { ...r, loss_kg: r2(loss), loss_pct: pct(loss, r.quantity_stored), avg_speed_kmh: speed, flags };
  });
}

/* ───────── TRACE ───────── */
async function chains() {
  return q(`SELECT f.harvest_id, c.crop_name, fa.name farmer, f.location, f.harvest_date, f.q_harvest,
      CASE WHEN f.q_retail IS NOT NULL THEN 'retail' WHEN f.q_distribution IS NOT NULL THEN 'distribution'
           WHEN f.q_transport IS NOT NULL THEN 'transport' WHEN f.q_storage IS NOT NULL THEN 'storage'
           WHEN f.q_collection IS NOT NULL THEN 'collection' ELSE 'harvest' END current_stage
    FROM v_harvest_flow f JOIN crops c ON c.crop_id = f.crop_id JOIN farmers fa ON fa.farmer_id = f.farmer_id
    ORDER BY f.harvest_date DESC, f.harvest_id DESC`);
}

async function trace(harvestId) {
  const [h] = await q(`SELECT h.*, c.crop_name, c.variety, fa.name farmer_name, fa.contact farmer_contact, fa.location farmer_location
      FROM harvest h JOIN crops c ON c.crop_id = h.crop_id JOIN farmers fa ON fa.farmer_id = h.farmer_id WHERE h.harvest_id = ?`, [harvestId]);
  if (!h) throw new ApiError(404, 'Harvest not found');
  const [flow] = await q('SELECT * FROM v_harvest_flow WHERE harvest_id = ?', [harvestId]);
  const col = await q('SELECT * FROM collection WHERE harvest_id = ?', [harvestId]);
  const sto = await q(`SELECT s.* FROM storage s JOIN collection c ON c.collection_id = s.collection_id WHERE c.harvest_id = ?`, [harvestId]);
  const tra = await q(`SELECT t.* FROM transportation t JOIN storage s ON s.storage_id = t.storage_id JOIN collection c ON c.collection_id = s.collection_id WHERE c.harvest_id = ?`, [harvestId]);
  const dis = await q(`SELECT d.* FROM distribution d JOIN transportation t ON t.transport_id = d.transport_id JOIN storage s ON s.storage_id = t.storage_id JOIN collection c ON c.collection_id = s.collection_id WHERE c.harvest_id = ?`, [harvestId]);
  const ret = await q(`SELECT r.* FROM retail r JOIN distribution d ON d.distribution_id = r.distribution_id JOIN transportation t ON t.transport_id = d.transport_id JOIN storage s ON s.storage_id = t.storage_id JOIN collection c ON c.collection_id = s.collection_id WHERE c.harvest_id = ?`, [harvestId]);
  const s = (k, label, qty, records, summ) => ({ key: k, label, reached: records.length > 0 || k === 'farm', quantity_kg: qty === null ? null : r2(qty), records, summary: summ });
  const list = [
    s('farm', 'FARM', null, [], `${h.farmer_name} · ${h.farmer_location}`),
    s('harvest', 'HARVEST', flow.q_harvest, [h], `${h.crop_name}${h.variety ? ' (' + h.variety + ')' : ''} · Grade ${h.quality} · ${h.harvest_date}`),
    s('collection', 'COLLECTION', flow.q_collection, col, col[0] ? `${col[0].collection_center} · ${col[0].collection_date}` : 'Not yet collected'),
    s('storage', 'STORAGE', flow.q_storage, sto, sto[0] ? `${sto[0].storage_location} · ${sto[0].temperature ?? '–'}°C / ${sto[0].humidity ?? '–'}% RH` : 'Not yet stored'),
    s('transport', 'TRANSPORT', flow.q_transport, tra, tra[0] ? `${tra[0].source} → ${tra[0].destination} · ${tra[0].vehicle_number}` : 'Not yet dispatched'),
    s('distribution', 'DISTRIBUTION', flow.q_distribution, dis, dis[0] ? `${dis[0].distributor} · ${dis[0].distribution_date}` : 'Not yet distributed'),
    s('retail', 'RETAIL', flow.q_retail, ret, ret[0] ? `${ret[0].retailer} · ₹${ret[0].selling_price}/kg · ${ret[0].sale_date}` : 'Not yet sold')
  ];
  let prev = null, worst = null;
  for (const st of list) {
    if (st.key === 'farm') continue;
    if (st.quantity_kg !== null && prev !== null) {
      st.loss_kg = r2(prev - st.quantity_kg); st.loss_pct = pct(prev - st.quantity_kg, prev);
      if (!worst || st.loss_kg > worst.loss_kg) worst = st;
    }
    if (st.quantity_kg !== null) prev = st.quantity_kg;
  }
  const last = [...list].reverse().find(x => x.quantity_kg !== null);
  return {
    harvest_id: h.harvest_id, crop: h.crop_name, stages: list, current_stage: last.key,
    total_loss_kg: r2(flow.q_harvest - last.quantity_kg), total_loss_pct: pct(flow.q_harvest - last.quantity_kg, flow.q_harvest),
    largest_loss_stage: worst && { stage: worst.key, loss_kg: worst.loss_kg, loss_pct: worst.loss_pct }
  };
}

module.exports = { summary, stageLosses, wastage, prices, demand, storage, transportation, chains, trace, STAGE_ORDER };
