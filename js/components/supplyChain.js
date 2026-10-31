/* KRUSHIVIKAS — Supply Chain Intelligence view.
   Self-contained: injects a "SUPPLY CHAIN" button into the existing topbar and a panel that reuses the
   existing design system. Reads all data from KrushiAPI (Express → MySQL). Does not touch sensor/Firebase code. */
(function () {
  const API = window.KrushiAPI;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v, d = 0) => (v == null ? '–' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d }));
  const kg = v => (v == null ? '–' : num(v) + ' kg');
  const inr = v => (v == null ? '–' : '₹' + num(v, 2));
  const sevClass = p => (p >= 8 ? 'critical' : p >= 4 ? '' : 'good');
  const TABS = [['overview', 'OVERVIEW'], ['trace', 'TRACE'], ['wastage', 'WASTAGE'], ['prices', 'PRICES'], ['demand', 'DEMAND'], ['storage', 'STORAGE'], ['transport', 'TRANSPORT'], ['entry', 'DATA ENTRY'], ['approval', 'HARVEST APPROVAL']];
  let active = 'overview', view, body;

  const loading = () => '<div class="sc-loading">LOADING DATA…</div>';
  const errBox = e => `<div class="sc-msg err">⚠ ${esc(e.message)}${e.offline ? '' : ''}</div>`;
  const empty = t => `<div class="sc-msg info">${esc(t)}</div>`;
  const card = (label, inner, cls = '') => `<div class="report-card ${cls}"><div class="card-label"><span class="card-label-icon">◈</span>${label}</div>${inner}</div>`;
  const kpi = (label, val, sub, cls = '') => card(label, `<div class="card-value-large ${cls}">${val}</div><div class="card-sub">${sub || ''}</div>`);

  function bars(rows, { valueKey = 'quantity_kg', fmt = kg, pctKey } = {}) {
    if (!rows.length) return empty('No data recorded yet.');
    const max = Math.max(...rows.map(r => r[valueKey] || 0), 1);
    return `<div class="sc-bars">${rows.map(r => `<div class="sc-bar-row"><span class="lbl" title="${esc(r.label)}">${esc(r.label)}</span>
      <div class="sc-bar-track"><div class="sc-bar-fill ${pctKey ? sevClass(r[pctKey]) : ''}" style="width:${((r[valueKey] || 0) / max) * 100}%"></div></div>
      <span class="val">${fmt(r[valueKey])}${pctKey && r[pctKey] != null ? ' · ' + r[pctKey] + '%' : ''}</span></div>`).join('')}</div>`;
  }
  function spark(points) {
    if (points.length < 2) return '';
    const w = 300, h = 44, min = Math.min(...points), max = Math.max(...points), rng = max - min || 1;
    const pts = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - 4 - ((p - min) / rng) * (h - 8)}`).join(' ');
    return `<svg class="sc-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline fill="none" stroke="var(--amber)" stroke-width="2" points="${pts}"/></svg>`;
  }
  const changeCell = (c, p) => (c == null ? '–' : `<span class="${c >= 0 ? 'up' : 'down'}">${c >= 0 ? '▲' : '▼'} ${Math.abs(c).toFixed(2)} (${p}%)</span>`);

  /* ───── Tabs ───── */
  const tabs = {
    async overview() {
      const [s, sl] = await Promise.all([API.dashboard.summary(), API.dashboard.stageLosses()]);
      if (!s.total_supply_chains) return empty('The database is empty. Run database/seed.sql or add harvest records.');
      const lg = sl.largest_loss_stage;
      return `<div class="sc-kpis">
        ${kpi('TOTAL CROPS', num(s.total_crops), 'tracked varieties')}
        ${kpi('HARVESTED', kg(s.total_harvested_kg), `${s.total_supply_chains} harvest lots`)}
        ${kpi('COLLECTED', kg(s.total_collected_kg), 'received at centres')}
        ${kpi('STORED', kg(s.total_stored_kg), 'in storage facilities')}
        ${kpi('TRANSPORTED', kg(s.total_transported_kg), 'moved to distribution')}
        ${kpi('DISTRIBUTED', kg(s.total_distributed_kg), 'received by distributors')}
        ${kpi('SOLD AT RETAIL', kg(s.total_sold_kg), 'recorded sales')}
        ${kpi('RECORDED WASTAGE', kg(s.total_wastage_kg), `${s.wastage_percentage}% of harvest`, sevClass(s.wastage_percentage))}
        ${kpi('AVG BANANA MANDI PRICE', inr(s.avg_market_price), 'latest available official/demo records')}
        ${kpi('RECORDED DEMAND', kg(s.current_demand_kg), s.current_demand_kg == null ? 'no verified demand data imported' : 'recorded estimates; not mandi arrivals')}
        ${kpi('ACTIVE CHAINS', num(s.active_supply_chains), 'not yet sold at retail')}
        ${kpi('STORAGE LOSS', kg(s.storage_loss_kg), 'collection → storage', 'moderate')}
        ${kpi('TRANSPORT LOSS', kg(s.transportation_loss_kg), 'storage → transport', 'moderate')}
      </div>
      <div class="report-grid">
        ${card('LOSS BY STAGE (COMPLETED HANDOFFS)', bars(sl.stages.map(x => ({ label: x.stage, quantity_kg: x.loss_kg, loss_pct: x.loss_pct })), { pctKey: 'loss_pct' }))}
        ${card('BIGGEST LEAK', lg ? `<div class="card-value-large critical" style="text-transform:capitalize">${esc(lg.stage)}</div>
            <div class="card-sub">${kg(lg.loss_kg)} lost (${lg.loss_pct}% of what entered the stage). Completed chains lose ${s.completed_chain_loss_pct}% farm→retail.</div>` : empty('Not enough stage data.'), 'highlight')}
      </div>`;
    },

    async trace() {
      const list = await API.dashboard.chains();
      if (!list.length) return empty('No harvest records yet.');
      const fill = term => {
        const t = (term || '').toLowerCase(), sel = $('#sc-trace-sel'); if (!sel) return;
        const hit = list.filter(c => !t || `${c.harvest_id} ${c.crop_name} ${c.farmer} ${c.location} ${c.harvest_date} ${c.current_stage}`.toLowerCase().includes(t));
        sel.innerHTML = hit.map(c => `<option value="${c.harvest_id}">#${c.harvest_id} · ${esc(c.crop_name)} · ${esc(c.farmer)} · ${esc(c.harvest_date)} [${c.current_stage}]</option>`).join('');
        if (hit.length) loadTrace(sel.value); else $('#sc-trace-out').innerHTML = empty('No lots match your search.');
      };
      setTimeout(() => { const sel = $('#sc-trace-sel'); if (!sel) return; sel.onchange = () => loadTrace(sel.value); $('#sc-trace-q').oninput = e => fill(e.target.value); fill(''); }, 0);
      return `<div class="sc-toolbar"><span class="card-label" style="margin:0">FIND LOT</span>
        <input class="sc-input" id="sc-trace-q" placeholder="Search crop, farmer, location, stage…" style="min-width:240px"/>
        <select class="sc-select" id="sc-trace-sel"></select></div><div id="sc-trace-out">${loading()}</div>`;
    },

    async wastage() {
      const groups = [['stage', 'Stage'], ['crop', 'Crop'], ['location', 'Farm location'], ['date', 'Month'], ['storage', 'Storage facility'], ['transportation', 'Vehicle']];
      const [crops] = await Promise.all([API.crops.list({ limit: 200 })]);
      setTimeout(() => { const g = $('#sc-wg'); if (g) { g.onchange = () => loadWastage(g.value); loadWastage(g.value); }
        bindForm('sc-wform', API.wastage.create, 'Wastage recorded.'); }, 0);
      return `<div class="sc-toolbar"><span class="card-label" style="margin:0">ANALYSE BY</span>
          <select class="sc-select" id="sc-wg">${groups.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
        <div id="sc-wout">${loading()}</div>
        ${card('RECORD WASTAGE', formHtml('sc-wform', [
          ['crop_id', 'CROP', 'select', crops.map(c => [c.crop_id, c.crop_name + (c.variety ? ' – ' + c.variety : '')])],
          ['stage', 'STAGE', 'select', ['harvest', 'collection', 'storage', 'transportation', 'distribution', 'retail'].map(s => [s, s])],
          ['quantity_wasted', 'QUANTITY (KG)', 'number'], ['reason', 'REASON', 'text'], ['recorded_date', 'DATE', 'date']]))}`;
    },

    async prices() {
      const [crops, p, predictionResult] = await Promise.all([
        API.crops.list({ limit: 200 }),
        API.dashboard.prices(),
        fetch('/api/price-prediction')
          .then(async r => {
            const json = await r.json();
            if (!r.ok) throw new Error(json.message || 'Prediction service unavailable');
            return json;
          })
          .catch(error => ({ status: 'error', message: error.message }))
      ]);
      const nationwideMandiCard = card('NATIONWIDE GOVERNMENT MANDI PRICES', `
        <div id="sc-nationwide-mandi">
          <p class="card-sub">Source: Government of India · data.gov.in / AGMARKNET. Prices are shown in the source's reported units; no unit conversion is assumed.</p>
          <div class="sc-toolbar sc-mandi-filters">
            <input class="sc-input" id="sc-mandi-state" list="sc-mandi-state-options" placeholder="State (e.g. Maharashtra)" aria-label="Filter by state">
            <datalist id="sc-mandi-state-options">
              <option value="Maharashtra"><option value="Gujarat"><option value="Rajasthan">
              <option value="Madhya Pradesh"><option value="Uttar Pradesh"><option value="Karnataka">
              <option value="Tamil Nadu"><option value="West Bengal"><option value="Punjab">
              <option value="Haryana"><option value="Andhra Pradesh"><option value="Telangana">
              <option value="Bihar"><option value="Odisha"><option value="Kerala">
              <option value="Assam"><option value="Chhattisgarh"><option value="Jharkhand">
              <option value="Himachal Pradesh"><option value="Uttarakhand"><option value="Delhi">
            </datalist>
            <input class="sc-input" id="sc-mandi-district" placeholder="District" aria-label="Filter by district">
            <input class="sc-input" id="sc-mandi-commodity" list="sc-mandi-commodity-options" placeholder="Commodity" aria-label="Filter by commodity">
            <datalist id="sc-mandi-commodity-options">
              <option value="Onion"><option value="Potato"><option value="Tomato">
              <option value="Wheat"><option value="Rice"><option value="Soyabean">
              <option value="Cotton"><option value="Maize"><option value="Bajra">
              <option value="Banana"><option value="Apple"><option value="Grapes">
              <option value="Pomegranate"><option value="Turmeric"><option value="Chilli">
              <option value="Garlic"><option value="Cabbage"><option value="Cauliflower">
              <option value="Green Gram"><option value="Bengal Gram">
            </datalist>
            <input class="sc-input" id="sc-mandi-market" placeholder="Market" aria-label="Filter by market">
          </div>
          <div class="sc-toolbar sc-mandi-actions">
            <button type="button" class="sc-mandi-btn" id="sc-mandi-apply">Apply filters</button>
            <button type="button" class="sc-mandi-btn" id="sc-mandi-reset">Reset</button>
            <button type="button" class="sc-mandi-btn" id="sc-mandi-refresh">Refresh</button>
          </div>
          <p class="card-sub" id="sc-mandi-status" aria-live="polite">Preparing nationwide mandi data…</p>
          <div id="sc-mandi-results"><div class="sc-loading">LOADING MANDI PRICES…</div></div>
          <div class="sc-toolbar sc-mandi-pagination">
            <button type="button" class="sc-mandi-btn" id="sc-mandi-prev" disabled>Previous</button>
            <span class="card-sub" id="sc-mandi-page">Page 1</span>
            <button type="button" class="sc-mandi-btn" id="sc-mandi-next" disabled>Next</button>
          </div>
          <p class="card-sub">Arrival date is reported by the market and may not be today's date. Always check the displayed date before comparing prices.</p>
        </div>
      `, 'highlight');

      const prediction = predictionResult.status === 'success' ? predictionResult.data : null;
      const predictionCard = card('BANANA PRICE PREDICTION', prediction ? `
        <div class="card-value-large">${inr(prediction.experimental_forecast)}</div>
        <div class="card-sub">Experimental estimate · ${esc(prediction.region || 'Region not specified')}</div>
        <div class="card-sub">Last observed: ${esc(prediction.last_observed_date || 'Unknown')} · ${inr(prediction.last_observed_modal_price)}</div>
        <div class="card-sub">Forecast date: ${esc(prediction.forecast_date || 'Unknown')}</div>
        <div class="sc-msg ${prediction.stale ? 'err' : 'info'}">${esc(prediction.warning || 'Model estimate; actual prices may differ.')}</div>
        ${prediction.evaluation ? `<div class="card-sub">Historical test MAE: ${inr(prediction.evaluation.test_mae)} · RMSE: ${inr(prediction.evaluation.test_rmse)}</div>` : ''}
      ` : empty('Prediction unavailable: ' + (predictionResult.message || 'prediction service did not return a valid result.')), 'highlight');

      const historyCard = card('BANANA PRICE HISTORY · MAHARASHTRA', `
        <p class="card-sub">CEDA Agmarknet observations · Interactive historical market series</p>
        <div class="sc-history-toolbar">
          <div class="sc-history-periods" role="group" aria-label="Historical chart time range">
            <button type="button" data-range="1M">1M</button>
            <button type="button" data-range="3M">3M</button>
            <button type="button" data-range="6M">6M</button>
            <button type="button" data-range="1Y">1Y</button>
            <button type="button" data-range="3Y">3Y</button>
            <button type="button" data-range="5Y">5Y</button>
            <button type="button" data-range="ALL" class="active">ALL</button>
          </div>
          <span class="sc-history-unit">Unit: source price units · unverified</span>
        </div>
        <div class="sc-kpis sc-history-kpis">
          <div><div class="card-sub">OBSERVATIONS IN RANGE</div><div class="card-value-large" id="sc-history-count">—</div></div>
          <div><div class="card-sub">LOWEST MODAL VALUE</div><div class="card-value-large" id="sc-history-low">—</div></div>
          <div><div class="card-sub">HIGHEST MODAL VALUE</div><div class="card-value-large" id="sc-history-high">—</div></div>
        </div>
        <div id="sc-history-detail" class="sc-history-detail">
          <span>Select a point on the chart</span><strong>—</strong>
        </div>
        <div class="sc-history-legend"><span><i class="sc-legend-modal"></i>Modal price</span><span><i class="sc-legend-range"></i>Min–max range</span></div>
        <div id="sc-banana-history-chart" class="sc-history-chart"><div class="sc-loading">LOADING HISTORICAL DATA…</div></div>
        <p class="card-sub">Source: CEDA Agmarknet API. Missing dates are not interpolated. No currency or weight unit is assumed. The latest available observation is 30 Oct 2025; no 2026 observations are available in this dataset.</p>
        <div id="sc-history-error" class="sc-msg info" hidden></div>
      `, 'highlight');

      setTimeout(async () => {
        const host = document.getElementById('sc-banana-history-chart');
        if (!host) return;
        try {
          const response = await fetch('/api/price-prediction/history');
          const result = await response.json();
          if (!response.ok || result.status !== 'success') {
            throw new Error(result.message || 'Historical data could not be loaded.');
          }

          const rows = (result.data || []).filter(r =>
            /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') &&
            Number.isFinite(Number(r.modal_price)) && Number(r.modal_price) > 0
          ).sort((a, b) => a.date.localeCompare(b.date));
          if (!rows.length) throw new Error('No valid historical observations were found.');

          const fmt = n => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
          const parseDate = d => new Date(`${d}T00:00:00Z`);
          const detail = document.getElementById('sc-history-detail');
          const countEl = document.getElementById('sc-history-count');
          const lowEl = document.getElementById('sc-history-low');
          const highEl = document.getElementById('sc-history-high');
          const buttons = [...document.querySelectorAll('.sc-history-periods [data-range]')];

          function draw(range) {
            const latest = parseDate(rows[rows.length - 1].date);
            const cutoff = new Date(latest);
            if (range !== 'ALL') {
              const match = range.match(/^(\d+)([MY])$/);
              const n = Number(match[1]);
              if (match[2] === 'M') cutoff.setUTCMonth(cutoff.getUTCMonth() - n);
              else cutoff.setUTCFullYear(cutoff.getUTCFullYear() - n);
            } else {
              cutoff.setTime(parseDate(rows[0].date).getTime());
            }

            const data = rows.filter(r => parseDate(r.date) >= cutoff && parseDate(r.date) <= latest);
            if (!data.length) {
              host.innerHTML = '<div class="sc-msg info">No observations available for this period.</div>';
              return;
            }

            buttons.forEach(b => {
              const active = b.dataset.range === range;
              b.classList.toggle('active', active);
              b.setAttribute('aria-pressed', String(active));
            });

            const values = data.map(r => Number(r.modal_price));
            const low = Math.min(...values), high = Math.max(...values);
            countEl.textContent = data.length.toLocaleString('en-IN');
            lowEl.textContent = fmt(low);
            highEl.textContent = fmt(high);

            const W = 1000, H = 360, L = 78, R = 24, T = 24, B = 52;
            const plotW = W - L - R, plotH = H - T - B;
            const bounds = data.flatMap(r => [Number(r.modal_price), Number(r.min_price), Number(r.max_price)])
              .filter(v => Number.isFinite(v) && v > 0);
            const minY = Math.min(...bounds), maxY = Math.max(...bounds);
            const pad = Math.max((maxY - minY) * .08, 1);
            const yMin = Math.max(0, minY - pad), yMax = maxY + pad;
            const x = i => L + (i / Math.max(data.length - 1, 1)) * plotW;
            const y = v => T + ((yMax - v) / (yMax - yMin || 1)) * plotH;
            const line = data.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(Number(r.modal_price)).toFixed(2)}`).join(' ');

            const top = data.map((r, i) => Number(r.max_price) > 0 && Number.isFinite(Number(r.max_price)) ? `${x(i)},${y(Number(r.max_price))}` : null).filter(Boolean);
            const bottom = data.map((r, i) => Number(r.min_price) > 0 && Number.isFinite(Number(r.min_price)) ? `${x(i)},${y(Number(r.min_price))}` : null).filter(Boolean).reverse();
            const band = top.length > 1 && bottom.length > 1 ? top.concat(bottom).join(' ') : '';

            const grid = Array.from({length: 5}, (_, i) => {
              const v = yMin + (yMax - yMin) * i / 4, yy = y(v);
              return `<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" class="sc-chart-grid"/><text x="${L-12}" y="${yy+4}" text-anchor="end" class="sc-chart-label">${fmt(v)}</text>`;
            }).join('');

            const tickIndices = [];
            const targetTicks = 6;
            for (let i = 0; i < targetTicks; i++) {
              const idx = Math.round(i * (data.length - 1) / (targetTicks - 1));
              if (!tickIndices.includes(idx)) tickIndices.push(idx);
            }
            const ticks = tickIndices.map(i => {
              const d = data[i].date;
              const label = range === '1M' || range === '3M' || range === '6M'
                ? `${d.slice(8,10)} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(d.slice(5,7))-1]} ${d.slice(0,4)}`
                : range === '1Y' ? `${d.slice(5,7)}/${d.slice(0,4)}` : d.slice(0,4);
              return `<text x="${x(i)}" y="${H-20}" text-anchor="${i === 0 ? 'start' : i === data.length-1 ? 'end' : 'middle'}" class="sc-chart-label">${label}</text>`;
            }).join('');

            const points = data.map((r, i) =>
              `<circle tabindex="0" role="button" aria-label="${r.date}, modal ${fmt(r.modal_price)}" data-index="${i}" cx="${x(i)}" cy="${y(Number(r.modal_price))}" r="4" class="sc-chart-point"><title>${r.date} · Modal: ${fmt(r.modal_price)}</title></circle>`
            ).join('');

            host.innerHTML = `<div class="sc-chart-scroll"><svg class="sc-history-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Interactive historical banana prices from ${data[0].date} to ${data[data.length-1].date}">${grid}${band ? `<polygon points="${band}" class="sc-chart-band"/>` : ''}<path d="${line}" class="sc-chart-line"/>${points}${ticks}</svg></div><div class="sc-history-footer"><span>${data[0].date}</span><span>${data[data.length-1].date}</span></div>`;

            function showPoint(i) {
              const r = data[i];
              detail.innerHTML = `<span>${r.date}</span><strong>Modal: ${fmt(r.modal_price)}</strong><span>Min: ${Number(r.min_price) > 0 ? fmt(r.min_price) : 'N/A'}</span><span>Max: ${Number(r.max_price) > 0 ? fmt(r.max_price) : 'N/A'}</span>`;
              host.querySelectorAll('.sc-chart-point').forEach((pt, j) => pt.classList.toggle('selected', j === i));
            }
            host.querySelectorAll('.sc-chart-point').forEach(pt => {
              const i = Number(pt.dataset.index);
              pt.addEventListener('click', () => showPoint(i));
              pt.addEventListener('focus', () => showPoint(i));
              pt.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showPoint(i); }
              });
            });
            showPoint(data.length - 1);
          }

          buttons.forEach(b => b.addEventListener('click', () => draw(b.dataset.range)));
          draw('ALL');
        } catch (error) {
          host.innerHTML = '<div class="sc-msg err">Could not render historical chart.</div>';
          const errorBox = document.getElementById('sc-history-error');
          if (errorBox) { errorBox.hidden = false; errorBox.textContent = error.message; }
        }
      }, 0);

      const byCrop = {};
      p.history.forEach(h => (byCrop[h.crop_name] ||= []).push(h.avg_price));
      setTimeout(() => {
        if (window.KrushiNationwideMandi) {
          window.KrushiNationwideMandi.init();
        }
      }, 0);

      return `${nationwideMandiCard}\n        ${predictionCard}\n        ${historyCard}
        <div class="report-grid">${Object.entries(byCrop).map(([name, pts]) => {
          const cur = pts[pts.length - 1], prev = pts[pts.length - 2], ch = prev ? cur - prev : null;
          return card(name.toUpperCase() + ' · AVG PRICE TREND', `<div class="card-value-large">${inr(cur)}</div><div class="card-sub">${changeCell(ch, prev ? ((ch / prev) * 100).toFixed(1) : 0)} vs previous</div>${spark(pts)}`);
        }).join('') || empty('No price data yet.')}</div>
        ${card('LATEST BANANA MANDI PRICES', p.latest.length ? `<div class="sc-scroll"><table class="sc-table"><tr><th>STATE / DISTRICT</th><th>MARKET</th><th>VARIETY / GRADE</th><th class="num">MIN–MAX ₹/KG</th><th class="num">MODAL ₹/KG</th><th class="num">ARRIVALS (QTL)</th><th>DATE / SOURCE</th></tr>
          ${p.latest.map(r => `<tr><td>${esc([r.state, r.district].filter(Boolean).join(' / ') || 'Location not reported')}</td><td>${esc(r.market)}</td><td>${esc([r.variety, r.grade].filter(Boolean).join(' / ') || 'Not reported')}</td><td class="num">${r.min_price == null || r.max_price == null ? '–' : `${inr(r.min_price)} – ${inr(r.max_price)}`}</td><td class="num">${inr(r.price)}</td><td class="num">${r.arrivals_quintal == null ? '–' : num(r.arrivals_quintal, 2)}</td><td>${esc(r.recorded_date)}<br><small>${esc(r.source || 'Source not recorded')} · ${esc(r.data_status || 'unknown')}</small></td></tr>`).join('')}</table></div>` : empty('No banana mandi records loaded. Import the official data.gov.in / AGMARKNET CSV to populate this view.'))}
        ${card('DATA PROVENANCE', '<p>Market observations are imported from the Government of India data.gov.in / AGMARKNET dataset. Prices are converted from ₹/quintal to ₹/kg; arrivals remain in quintals. Synthetic mixed-crop prices are not retained.</p>')}`;
    },

    async demand() {
      const [crops, d] = await Promise.all([API.crops.list({ limit: 200 }), API.dashboard.demand()]);
      const byCrop = {};
      d.history.forEach(h => (byCrop[h.crop_name] ||= []).push(h.total_demand));
      setTimeout(() => bindForm('sc-dform', API.demand.create, 'Demand recorded.'), 0);
      return `<div class="report-grid">
          ${card('CURRENT DEMAND BY CROP', bars(d.by_crop))}${card('CURRENT DEMAND BY MARKET', bars(d.by_market))}</div>
        <div class="report-grid">${Object.entries(byCrop).map(([n, pts]) => card(n.toUpperCase() + ' · DEMAND HISTORY', `<div class="card-value-large">${kg(pts[pts.length - 1])}</div><div class="card-sub">weekly, all markets</div>${spark(pts)}`)).join('')}</div>
        ${card('RECORD AN ESTIMATED DEMAND OBSERVATION', `<p>Enter only a clearly identified estimate from a buyer or market contact. Official mandi arrivals and prices are not a direct measurement of demand.</p>${formHtml('sc-dform', [['crop_id', 'CROP', 'select', crops.map(c => [c.crop_id, c.crop_name])], ['market', 'MARKET', 'text'], ['demand_quantity', 'ESTIMATED DEMAND (KG)', 'number'], ['demand_date', 'DATE', 'date']])}`)}`;
    },

    async storage() {
      const rows = await API.dashboard.storage();
      if (!rows.length) return empty('No storage records yet.');
      const cls = { ok: 'low', warning: 'moderate', critical: 'high' };
      const flagged = rows.filter(r => r.status !== 'ok').length;
      return `<div class="sc-kpis">${kpi('STORAGE LOTS', rows.length, 'monitored')}${kpi('FLAGGED', flagged, 'temperature / humidity / loss issues', flagged ? 'moderate' : 'good')}</div>
        ${card('STORAGE CONDITIONS & LOSS', `<div class="sc-scroll"><table class="sc-table"><tr><th>FACILITY</th><th>CROP</th><th class="num">TEMP °C</th><th class="num">RH %</th><th class="num">DAYS</th><th class="num">LOSS</th><th>STATUS</th></tr>
          ${rows.map(r => `<tr><td>${esc(r.storage_location)}</td><td>${esc(r.crop_name)}</td><td class="num">${r.temperature ?? '–'}</td><td class="num">${r.humidity ?? '–'}</td><td class="num">${r.duration_days}</td>
            <td class="num ${r.loss_pct >= 8 ? 'down' : ''}">${kg(r.loss_kg)} (${r.loss_pct}%)</td>
            <td><div class="risk-item ${cls[r.status]}" style="padding:4px 8px"><span class="risk-dot"></span>${r.issues.length ? esc(r.issues.join('; ')) : 'Within ideal range'}</div></td></tr>`).join('')}</table></div>`)}`;
    },

    async entry() {
      const keys = Object.keys(ENTITIES);
      setTimeout(() => { const sel = $('#sc-ent'); if (sel) { sel.onchange = () => loadEntity(sel.value); loadEntity(sel.value); } }, 0);
      return `<div class="sc-toolbar"><span class="card-label" style="margin:0">RECORD TYPE</span>
        <select class="sc-select" id="sc-ent">${keys.map(k => `<option value="${k}">${ENTITIES[k].label}</option>`).join('')}</select></div><div id="sc-ent-out">${loading()}</div>`;
    },

    async transport() {
      const rows = await API.dashboard.transportation();
      if (!rows.length) return empty('No transportation records yet.');
      const tot = rows.reduce((a, r) => (a.q += r.quantity_stored, a.l += r.loss_kg, a), { q: 0, l: 0 });
      return `<div class="sc-kpis">${kpi('TRIPS', rows.length, 'recorded')}${kpi('TRANSIT LOSS', kg(tot.l), `${tot.q ? ((tot.l / tot.q) * 100).toFixed(2) : 0}% of dispatched`, 'moderate')}
        ${kpi('AVG DISTANCE', num(rows.reduce((a, r) => a + (r.distance || 0), 0) / rows.length, 0) + ' km', 'per trip')}</div>
        ${card('TRIPS & TRANSPORT EFFICIENCY', `<div class="sc-scroll"><table class="sc-table"><tr><th>ROUTE</th><th>VEHICLE</th><th>CROP</th><th class="num">KG</th><th class="num">KM</th><th class="num">HRS</th><th class="num">KM/H</th><th class="num">LOSS</th><th>FLAGS</th></tr>
          ${rows.map(r => `<tr><td>${esc(r.source)} → ${esc(r.destination)}</td><td>${esc(r.vehicle_number)}</td><td>${esc(r.crop_name)}</td><td class="num">${num(r.quantity_transported)}</td><td class="num">${r.distance ?? '–'}</td>
            <td class="num">${r.transport_duration ?? '–'}</td><td class="num">${r.avg_speed_kmh ?? '–'}</td><td class="num ${r.loss_pct >= 5 ? 'down' : ''}">${r.loss_pct}%</td><td>${r.flags.length ? esc(r.flags.join('; ')) : '–'}</td></tr>`).join('')}</table></div>`)}`;
    },

async approval() {
      const tokenKey = 'kv_reviewer_token';
      let token = sessionStorage.getItem(tokenKey);

      const loginForm = () => `
        <div class="report-grid">
          <div class="report-card highlight">
            <div class="card-label">REVIEWER ACCESS</div>
            <h2>Harvest Approval</h2>
            <p class="card-sub">Sign in to review submitted harvest records.</p>
            <form id="sc-reviewer-login" class="sc-form">
              <label>REVIEWER PASSWORD
                <input class="sc-input" type="password" name="password"
                  required maxlength="200" autocomplete="current-password">
              </label>
              <button class="btn-secondary" type="submit">SIGN IN</button>
            </form>
            <div id="sc-reviewer-login-msg" style="margin-top:12px"></div>
          </div>
        </div>`;

      if (!token) {
        setTimeout(() => {
          const form = $('#sc-reviewer-login');
          if (!form) return;
          form.onsubmit = async event => {
            event.preventDefault();
            const msg = $('#sc-reviewer-login-msg');
            const button = form.querySelector('button');
            button.disabled = true;
            try {
              const password = new FormData(form).get('password');
              const result = await API.reviewer.login(password);
              sessionStorage.setItem(tokenKey, result.token);
              await show('approval');
            } catch (e) {
              msg.innerHTML = errBox(e);
            } finally {
              button.disabled = false;
              form.reset();
            }
          };
        }, 0);
        return loginForm();
      }

      let records, approvedRecords;
      try {
        [records, approvedRecords] = await Promise.all([
          API.reviewer.pending(token),
          API.reviewer.approved(token)
        ]);
      } catch (e) {
        if (e.status === 401 || e.status === 403) {
          sessionStorage.removeItem(tokenKey);
          setTimeout(() => show('approval'), 0);
          return empty('Your reviewer session expired. Please sign in again.');
        }
        throw e;
      }

      setTimeout(() => {
        document.querySelectorAll('[data-verify-harvest]').forEach(button => {
          button.onclick = async () => {
            const id = Number(button.dataset.verifyHarvest);
            if (!confirm(`Confirm you inspected the photo and GPS evidence for harvest #${id} and want to mark it verified?`)) return;
            button.disabled = true;
            try {
              await API.reviewer.verify(id, token);
              await show('approval');
            } catch (e) {
              alert(e.message);
              button.disabled = false;
            }
          };
        });

        document.querySelectorAll('[data-harvest-qr]').forEach(async button => {
          button.onclick = async () => {
            const id = Number(button.dataset.harvestQr);
            button.disabled = true;
            try {
              const result = await API.dashboard.publicTraceQR(id);
              const data = result.data || result;
              const popup = window.open('', '_blank');
              if (!popup) {
                alert('Allow pop-ups to preview the QR code.');
                return;
              }
              const safeUrl = String(data.url || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
              const safeQr = String(data.qr || '');
              if (!safeQr.startsWith('data:image/')) throw new Error('The server returned an invalid QR image.');
              popup.document.write(`<!doctype html><html><head><title>Harvest #${id} QR</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px Arial,sans-serif;text-align:center;padding:24px}img{width:min(320px,90vw);height:auto}a{display:block;margin:16px}</style></head><body><h2>Harvest #${id} Traceability QR</h2><img alt="Harvest traceability QR" src="${safeQr}"><p><a href="${safeUrl}" target="_blank" rel="noopener">Open public traceability page</a></p><a id="download" download="harvest-${id}-qr.png" href="${safeQr}">Download QR PNG</a></body></html>`);
              popup.document.close();
            } catch (e) {
              alert(e.message);
            } finally {
              button.disabled = false;
            }
          };
        });
      }, 0);

      setTimeout(() => {
        const logout = $('#sc-reviewer-logout');
        if (logout) logout.onclick = () => {
          sessionStorage.removeItem(tokenKey);
          show('approval');
        };

        document.querySelectorAll('[data-evidence-harvest]').forEach(async img => {
          const id = img.dataset.evidenceHarvest;
          const status = document.querySelector(`[data-evidence-status="${id}"]`);
          try {
            const url = await API.getReviewerPhotoUrl(id, token);
            img.src = url;
            img.style.display = 'block';
            if (status) status.remove();
          } catch (_) {
            if (status) status.textContent = 'Photo unavailable';
          }
        });

        document.querySelectorAll('[data-review-action]').forEach(button => {
          button.onclick = async () => {
            const id = Number(button.dataset.id);
            const action = button.dataset.reviewAction;
            const noteField = $(`#sc-review-note-${id}`);
            const notes = noteField ? noteField.value.trim() : '';
            if (!confirm(`${action === 'approve' ? 'Approve' : 'Reject'} harvest #${id}?`)) return;

            button.disabled = true;
            try {
              if (action === 'approve') await API.reviewer.approve(id, notes, token);
              else await API.reviewer.reject(id, notes, token);
              await show('approval');
            } catch (e) {
              alert(e.message);
              button.disabled = false;
            }
          };
        });
      }, 0);

      const table = records.length ? `
        <div class="sc-scroll"><table class="sc-table">
          <thead><tr><th>ID</th><th>FARMER</th><th>CROP</th><th>QUANTITY</th>
          <th>QUALITY</th><th>HARVEST DATE</th><th>LOCATION</th>
          <th>EVIDENCE</th><th>GPS</th><th>VERIFICATION</th>
          <th>REVIEW NOTES</th><th>ACTIONS</th></tr></thead>
          <tbody>${records.map(r => `<tr>
            <td>#${r.harvest_id}</td>
            <td>${esc(r.farmer_name)}</td>
            <td>${esc(r.crop_name)}</td>
            <td>${kg(r.quantity)}</td>
            <td>${esc(r.quality)}</td>
            <td>${esc(r.harvest_date)}</td>
            <td>${esc(r.location)}</td>
            <td>${r.evidence_photo
              ? `<img data-evidence-harvest="${r.harvest_id}" alt="Harvest evidence #${r.harvest_id}" style="display:none;width:110px;max-height:90px;object-fit:cover;border-radius:6px"><span data-evidence-status="${r.harvest_id}">Loading photo…</span>`
              : 'No photo submitted'}</td>
            <td>${r.gps_latitude != null && r.gps_longitude != null
              ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(r.gps_latitude + ',' + r.gps_longitude)}" target="_blank" rel="noopener noreferrer">${esc(r.gps_latitude)}, ${esc(r.gps_longitude)}</a>`
              : 'No GPS data'}</td>
            <td>${esc(r.verification_status || 'pending')}</td>
            <td><input class="sc-input" id="sc-review-note-${r.harvest_id}"
              maxlength="500" placeholder="Optional note"></td>
            <td><div class="sc-toolbar">
              <button class="btn-secondary" data-review-action="approve" data-id="${r.harvest_id}">✓ APPROVE</button>
              <button class="btn-secondary" data-review-action="reject" data-id="${r.harvest_id}">✕ REJECT</button>
            </div></td>
          </tr>`).join('')}</tbody>
        </table></div>` : empty('No pending harvests. All submitted records have been reviewed.');

      return `
        <div class="sc-toolbar" style="justify-content:space-between">
          <div><div class="card-label">REVIEW WORKSPACE</div>
            <h2 style="margin:6px 0">Harvest Approval</h2>
            <p class="card-sub">${records.length} pending record(s) awaiting review</p>
          </div>
          <button class="btn-secondary" id="sc-reviewer-logout">SIGN OUT</button>
        </div>
        ${card('PENDING HARVEST RECORDS', table)}
        ${card('APPROVED HARVESTS · TRACEABILITY QR', approvedRecords.length ? `
          <div class="sc-scroll"><table class="sc-table">
            <thead><tr><th>ID</th><th>FARMER</th><th>CROP</th><th>GPS</th><th>PHOTO</th><th>VERIFICATION</th><th>TRACEABILITY</th></tr></thead>
            <tbody>${approvedRecords.map(r => `<tr>
              <td>#${r.harvest_id}</td>
              <td>${esc(r.farmer_name)}</td>
              <td>${esc(r.crop_name)}${r.variety ? ' · ' + esc(r.variety) : ''}</td>
              <td>${r.gps_latitude != null && r.gps_longitude != null ? `<a href="https://www.google.com/maps?q=${encodeURIComponent(r.gps_latitude + ',' + r.gps_longitude)}" target="_blank" rel="noopener noreferrer">${esc(r.gps_latitude)}, ${esc(r.gps_longitude)}</a>` : 'Missing GPS'}</td>
              <td>${r.evidence_photo ? 'Submitted' : 'Missing photo'}</td>
              <td>${esc(r.verification_status || 'pending')}</td>
              <td>${r.verification_status === 'verified'
                ? `<button class="btn-secondary" data-harvest-qr="${r.harvest_id}">PREVIEW / DOWNLOAD QR</button>`
                : (r.evidence_photo && r.gps_latitude != null && r.gps_longitude != null
                  ? `<button class="btn-secondary" data-verify-harvest="${r.harvest_id}">VERIFY EVIDENCE</button>`
                  : 'Photo and GPS required')}</td>
            </tr>`).join('')}</tbody>
          </table></div>` : empty('No approved harvests yet.'))}
        <p class="card-sub">Public QR codes are available only after approval and evidence verification. Inspect the photo and GPS before marking a harvest verified.</p>`;
    },
  };

  /* ───── Sub-loaders ───── */
  async function loadTrace(id) {
    const out = $('#sc-trace-out'); if (!out) return; out.innerHTML = loading();
    try {
      const t = await API.dashboard.trace(id);
      const w = t.largest_loss_stage && t.largest_loss_stage.stage;
      const nodes = t.stages.map(s => `<div class="sc-node ${s.reached ? 'reached' : ''} ${w === s.key ? 'worst' : ''}"><div class="n-label">${s.label}</div>
        <div class="n-qty">${s.quantity_kg == null ? '◎' : kg(s.quantity_kg)}</div><div class="n-sub">${esc(s.summary)}</div>
        ${s.loss_kg != null ? `<div class="n-loss">−${num(s.loss_kg)} kg (${s.loss_pct}%)</div>` : ''}</div>`).join('<span class="sc-arrow">→</span>');
      out.innerHTML = `<div class="sc-kpis" style="margin-bottom:16px">
        ${kpi('BATCH / HARVEST ID', '#' + t.harvest_id, t.crop || 'Crop not specified')}
        ${kpi('CURRENT STAGE', String(t.current_stage || 'unknown').replace(/_/g, ' ').toUpperCase(), 'Farm-to-market journey')}
        ${kpi('TOTAL RECORDED LOSS', kg(t.total_loss_kg), `${t.total_loss_pct}% of harvested quantity`, t.total_loss_pct >= 8 ? 'high' : 'moderate')}
      </div><div class="sc-pipeline">${nodes}</div><div class="report-grid" style="margin-top:16px">
        ${card('TOTAL LOSS SO FAR', `<div class="card-value-large ${sevClass(t.total_loss_pct)}">${kg(t.total_loss_kg)}</div><div class="card-sub">${t.total_loss_pct}% · currently at ${esc(t.current_stage)}</div>`)}
        ${card('LARGEST LOSS', t.largest_loss_stage ? `<div class="card-value-large critical" style="text-transform:capitalize">${esc(t.largest_loss_stage.stage)}</div><div class="card-sub">${kg(t.largest_loss_stage.loss_kg)} (${t.largest_loss_stage.loss_pct}%)</div>` : empty('No losses computed yet.'), 'highlight')}</div>`;
    } catch (e) { out.innerHTML = errBox(e); }
  }
  async function loadWastage(g) {
    const out = $('#sc-wout'); if (!out) return; out.innerHTML = loading();
    try {
      const r = await API.dashboard.wastage(g);
      out.innerHTML = card(`WASTAGE BY ${g.toUpperCase()}`, bars(r.data, { pctKey: r.data.some(x => x.loss_pct != null) ? 'loss_pct' : undefined }));
    } catch (e) { out.innerHTML = errBox(e); }
  }


  /* ───── Data entry: generic add / edit for every supply-chain table ───── */
  const STAGES_ENUM = ['harvest', 'collection', 'storage', 'transportation', 'distribution', 'retail'];
  // field: [name, label, type, extra]; type 'ref' = foreign key dropdown loaded from the API
  const ENTITIES = {
    farmers: { label: 'Farmer', api: () => API.farmers, pk: 'farmer_id', show: ['name', 'location'], fields: [['name', 'NAME', 'text'], ['contact', 'CONTACT', 'text'], ['location', 'LOCATION', 'text']] },
    crops: { label: 'Crop / variety', api: () => API.crops, pk: 'crop_id', show: ['crop_name', 'variety'], fields: [['crop_name', 'CROP', 'text'], ['crop_type', 'TYPE', 'enum', ['vegetable', 'cereal', 'pulse', 'fruit', 'oilseed', 'other']], ['variety', 'VARIETY', 'text']] },
    harvest: { label: 'Harvest', api: () => API.harvest, pk: 'harvest_id', show: ['crop_id', 'quantity', 'harvest_date'], fields: [['farmer_id', 'FARMER', 'ref', 'farmers'], ['crop_id', 'CROP', 'ref', 'crops'], ['quantity', 'QUANTITY (KG)', 'number'], ['quality', 'QUALITY', 'enum', ['A', 'B', 'C']], ['harvest_date', 'HARVEST DATE', 'date'], ['location', 'LOCATION', 'text']] },
    collection: { label: 'Collection', api: () => API.collection, pk: 'collection_id', show: ['harvest_id', 'collection_center', 'quantity_received'], fields: [['harvest_id', 'HARVEST LOT', 'ref', 'harvest'], ['collection_center', 'COLLECTION CENTRE', 'text'], ['quantity_received', 'RECEIVED (KG)', 'number'], ['collection_date', 'DATE', 'date']] },
    storage: { label: 'Storage', api: () => API.storage, pk: 'storage_id', show: ['collection_id', 'storage_location', 'quantity_stored'], fields: [['collection_id', 'COLLECTION', 'ref', 'collection'], ['storage_location', 'FACILITY', 'text'], ['quantity_stored', 'STORED (KG)', 'number'], ['temperature', 'TEMP (°C)', 'number'], ['humidity', 'HUMIDITY (%)', 'number'], ['storage_start', 'START', 'date'], ['storage_end', 'END (OPTIONAL)', 'date']] },
    transportation: { label: 'Transportation', api: () => API.transportation, pk: 'transport_id', show: ['storage_id', 'vehicle_number', 'quantity_transported'], fields: [['storage_id', 'STORAGE', 'ref', 'storage'], ['source', 'SOURCE', 'text'], ['destination', 'DESTINATION', 'text'], ['vehicle_number', 'VEHICLE', 'text'], ['quantity_transported', 'QUANTITY (KG)', 'number'], ['distance', 'DISTANCE (KM)', 'number'], ['transport_date', 'DATE', 'date'], ['transport_duration', 'DURATION (HRS)', 'number']] },
    distribution: { label: 'Distribution', api: () => API.distribution, pk: 'distribution_id', show: ['transport_id', 'distributor', 'quantity_received'], fields: [['transport_id', 'TRANSPORT', 'ref', 'transportation'], ['distributor', 'DISTRIBUTOR', 'text'], ['quantity_received', 'RECEIVED (KG)', 'number'], ['distribution_date', 'DATE', 'date']] },
    retail: { label: 'Retail', api: () => API.retail, pk: 'retail_id', show: ['distribution_id', 'retailer', 'quantity_sold'], fields: [['distribution_id', 'DISTRIBUTION', 'ref', 'distribution'], ['retailer', 'RETAILER', 'text'], ['quantity_sold', 'SOLD (KG)', 'number'], ['selling_price', 'PRICE (₹/KG)', 'number'], ['sale_date', 'DATE', 'date']] },
    'market-prices': { label: 'Market price', api: () => API.marketPrices, pk: 'price_id', show: ['crop_id', 'market', 'price'], fields: [['crop_id', 'CROP', 'ref', 'crops'], ['market', 'MARKET', 'text'], ['price', 'PRICE (₹/KG)', 'number'], ['recorded_date', 'DATE', 'date']] },
    demand: { label: 'Demand', api: () => API.demand, pk: 'demand_id', show: ['crop_id', 'market', 'demand_quantity'], fields: [['crop_id', 'CROP', 'ref', 'crops'], ['market', 'MARKET', 'text'], ['demand_quantity', 'DEMAND (KG)', 'number'], ['demand_date', 'DATE', 'date']] },
    wastage: { label: 'Wastage', api: () => API.wastage, pk: 'wastage_id', show: ['crop_id', 'stage', 'quantity_wasted'], fields: [['crop_id', 'CROP', 'ref', 'crops'], ['stage', 'STAGE', 'enum', STAGES_ENUM], ['quantity_wasted', 'WASTED (KG)', 'number'], ['reason', 'REASON', 'text'], ['recorded_date', 'DATE', 'date']] }
  };
  const REF_API = { farmers: () => API.farmers, crops: () => API.crops, harvest: () => API.harvest, collection: () => API.collection, storage: () => API.storage, transportation: () => API.transportation, distribution: () => API.distribution };
  const REF_LABEL = { farmers: r => `${r.name} (${r.location})`, crops: r => r.crop_name + (r.variety ? ' – ' + r.variety : ''), harvest: r => `Lot #${r.harvest_id} · ${r.quantity} kg · ${r.harvest_date}`,
    collection: r => `Collection #${r.collection_id} · ${r.collection_center}`, storage: r => `Storage #${r.storage_id} · ${r.storage_location}`, transportation: r => `Trip #${r.transport_id} · ${r.vehicle_number} · ${r.source}→${r.destination}`,
    distribution: r => `Distribution #${r.distribution_id} · ${r.distributor}` };

  async function loadEntity(key) {
    const out = $('#sc-ent-out'); if (!out) return; out.innerHTML = loading();
    const E = ENTITIES[key];
    try {
      const refKeys = [...new Set(E.fields.filter(f => f[2] === 'ref').map(f => f[3]))];
      const [recent, ...refLists] = await Promise.all([E.api().list({ limit: 15 }), ...refKeys.map(k => REF_API[k]().list({ limit: 1000 }))]);
      const refs = Object.fromEntries(refKeys.map((k, i) => [k, refLists[i]]));
      const fieldsHtml = E.fields.map(([n, l, t, x]) => {
        let input;
        if (t === 'ref') input = `<select class="sc-select" name="${n}">${refs[x].map(r => `<option value="${r[ENTITIES[x].pk]}">${esc(REF_LABEL[x](r))}</option>`).join('') || '<option value="">(no parent records yet)</option>'}</select>`;
        else if (t === 'enum') input = `<select class="sc-select" name="${n}">${x.map(v => `<option>${esc(v)}</option>`).join('')}</select>`;
        else input = `<input class="sc-input" name="${n}" type="${t}" ${t === 'number' ? 'step="any" min="0"' : ''} ${t === 'date' ? `value="${new Date().toISOString().slice(0, 10)}"` : ''}/>`;
        return `<label>${l}${input}</label>`;
      }).join('');
      const evidenceFields = key === 'harvest' ? `
        <label>HARVEST EVIDENCE PHOTO (JPEG, PNG, WEBP; MAX 5 MB)
          <input class="sc-input" id="sc-harvest-photo" type="file" accept="image/jpeg,image/png,image/webp">
        </label>
        <div class="sc-toolbar">
          <button type="button" class="btn-secondary" id="sc-capture-gps">CAPTURE GPS LOCATION</button>
          <span class="card-sub" id="sc-gps-status">GPS optional; browser permission required.</span>
        </div>
        <input type="hidden" name="gps_latitude" id="sc-gps-latitude">
        <input type="hidden" name="gps_longitude" id="sc-gps-longitude">
      ` : '';
      out.innerHTML = card(`ADD / EDIT ${E.label.toUpperCase()}`, `<div id="sc-edit-note" class="card-sub">Creating a new record. Use EDIT on a row below to update it.</div>
        <form class="sc-form" id="sc-eform" onsubmit="return false">${fieldsHtml}${evidenceFields}<button type="submit" class="btn-secondary" id="sc-esave">SAVE RECORD</button><button type="button" class="btn-secondary hidden" id="sc-ecancel">CANCEL EDIT</button></form><div id="sc-emsg" style="margin-top:10px"></div>`)
        + card(`RECENT ${E.label.toUpperCase()} RECORDS`, recent.length ? `<div class="sc-scroll"><table class="sc-table"><tr><th>ID</th>${E.show.map(c => `<th>${c.toUpperCase()}</th>`).join('')}<th></th></tr>
          ${recent.map(r => `<tr><td>#${r[E.pk]}</td>${E.show.map(c => `<td>${esc(r[c])}</td>`).join('')}<td class="num">${key === 'harvest' ? `<button class="btn-secondary" style="padding:4px 10px" data-evidence-id="${r[E.pk]}">ATTACH EVIDENCE</button> ` : ''}<button class="btn-secondary" style="padding:4px 10px" data-edit="${r[E.pk]}">EDIT</button></td></tr>`).join('')}</table></div>` : empty('No records yet — add the first one above.'));
      const form = $('#sc-eform'), msg = $('#sc-emsg'); let editId = null;
      const reset = () => { editId = null; form.reset(); $('#sc-edit-note').textContent = 'Creating a new record. Use EDIT on a row below to update it.'; $('#sc-ecancel').classList.add('hidden'); };
      $('#sc-ecancel').onclick = reset;

      if (key === 'harvest') {
        const gpsButton = $('#sc-capture-gps');
        const gpsStatus = $('#sc-gps-status');

        gpsButton.onclick = () => {
          if (!navigator.geolocation) {
            gpsStatus.textContent = 'GPS is not supported by this browser.';
            return;
          }

          gpsStatus.textContent = 'Requesting location permission…';
          navigator.geolocation.getCurrentPosition(
            position => {
              form.elements.gps_latitude.value = position.coords.latitude;
              form.elements.gps_longitude.value = position.coords.longitude;
              gpsStatus.textContent =
                `GPS captured: ${position.coords.latitude.toFixed(5)}, ${position.coords.longitude.toFixed(5)}`;
            },
            error => {
              gpsStatus.textContent = error.code === 1
                ? 'Location permission denied. You can continue without GPS.'
                : 'Could not obtain GPS location. Try again or continue without it.';
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          );
        };
      }
      out.querySelectorAll('[data-evidence-id]').forEach(b => {
        b.onclick = async () => {
          const id = b.dataset.evidenceId;
          const token = sessionStorage.getItem('kv_reviewer_token');
          if (!token) {
            alert('Please sign in under HARVEST APPROVAL first, then return here.');
            return;
          }

          const picker = document.createElement('input');
          picker.type = 'file';
          picker.accept = 'image/jpeg,image/png,image/webp';
          picker.onchange = async () => {
            const photo = picker.files && picker.files[0];
            if (!photo) return;
            if (photo.size > 5 * 1024 * 1024) {
              alert('Choose an image smaller than 5 MB.');
              return;
            }

            let latitude = '';
            let longitude = '';
            if (navigator.geolocation && confirm('Capture your current GPS location for this harvest photo?')) {
              try {
                const position = await new Promise((resolve, reject) =>
                  navigator.geolocation.getCurrentPosition(resolve, reject,
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
                );
                latitude = String(position.coords.latitude);
                longitude = String(position.coords.longitude);
              } catch (_) {
                alert('GPS was unavailable. The photo will be uploaded without GPS.');
              }
            }

            b.disabled = true;
            try {
              await API.uploadHarvestEvidence(id, photo, latitude, longitude, token);
              alert(`Evidence uploaded for harvest #${id}.`);
              await loadEntity(key);
            } catch (e) {
              alert(`Evidence upload failed: ${e.message}`);
            } finally {
              b.disabled = false;
            }
          };
          picker.click();
        };
      });

      out.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
        const rec = recent.find(r => String(r[E.pk]) === b.dataset.edit); editId = rec[E.pk];
        E.fields.forEach(([n]) => { if (form.elements[n]) form.elements[n].value = rec[n] ?? ''; });
        $('#sc-edit-note').textContent = `Editing ${E.label} #${editId}.`; $('#sc-ecancel').classList.remove('hidden'); if (form.scrollIntoView) form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      form.addEventListener('submit', async () => {
        const data = Object.fromEntries(new FormData(form));
        const photoInput = key === 'harvest' ? $('#sc-harvest-photo') : null;
        const photo = photoInput && photoInput.files ? photoInput.files[0] : null;
        const latitude = data.gps_latitude || '';
        const longitude = data.gps_longitude || '';
        delete data.gps_latitude;
        delete data.gps_longitude;

        if (editId === null) Object.keys(data).forEach(k => data[k] === '' && delete data[k]);

        const saveButton = $('#sc-esave');
        saveButton.disabled = true;
        msg.textContent = '';

        try {
          if (editId !== null) {
            await E.api().update(editId, data);
            msg.innerHTML = `<div class="sc-msg ok">✓ ${E.label} updated.</div>`;
          } else {
            const result = await E.api().create(data);
            const created = result && result.data !== undefined ? result.data : result;
            const harvestId = created && created.harvest_id;

            if (key === 'harvest' && (photo || latitude !== '' || longitude !== '')) {
              if (!harvestId) {
                throw new Error('Harvest saved, but its ID was not returned. Evidence was not uploaded.');
              }
              if (!photo) {
                throw new Error(`Harvest #${harvestId} was saved, but GPS-only evidence is not yet supported by the upload endpoint.`);
              }

              await API.uploadHarvestEvidence(harvestId, photo, latitude, longitude, sessionStorage.getItem('kv_reviewer_token'));
              msg.innerHTML = `<div class="sc-msg ok">✓ Harvest #${harvestId} and evidence submitted for review.</div>`;
            } else {
              msg.innerHTML = `<div class="sc-msg ok">✓ ${E.label} added.</div>`;
            }
          }

          setTimeout(() => loadEntity(key), 1600);
        } catch (e) {
          msg.innerHTML = `<div class="sc-msg err">⚠ ${esc(e.message)}${e.details ? '<br>' + e.details.map(esc).join('<br>') : ''}</div>`;
        } finally {
          saveButton.disabled = false;
        }
      });
    } catch (e) { out.innerHTML = errBox(e); }
  }


  /* ───── Forms ───── */
  function formHtml(id, fields) {
    return `<form class="sc-form" id="${id}" onsubmit="return false">${fields.map(([n, l, t, opts]) => `<label>${l}${t === 'select'
      ? `<select class="sc-select" name="${n}">${opts.map(([v, txt]) => `<option value="${esc(v)}">${esc(txt)}</option>`).join('')}</select>`
      : `<input class="sc-input" name="${n}" type="${t}" ${t === 'number' ? 'step="any" min="0"' : ''} ${t === 'date' ? `value="${new Date().toISOString().slice(0, 10)}"` : ''}/>`}</label>`).join('')}
      <button type="submit" class="btn-secondary">SAVE RECORD</button></form><div id="${id}-msg" style="margin-top:10px"></div>`;
  }
  function bindForm(id, create, okMsg) {
    const f = document.getElementById(id); if (!f) return;
    f.addEventListener('submit', async () => {
      const msg = document.getElementById(id + '-msg'), data = Object.fromEntries(new FormData(f));
      Object.keys(data).forEach(k => data[k] === '' && delete data[k]);
      try { await create(data); msg.innerHTML = `<div class="sc-msg ok">✓ ${okMsg}</div>`; setTimeout(() => show(active), 900); }
      catch (e) { msg.innerHTML = `<div class="sc-msg err">⚠ ${esc(e.message)}${e.details ? '<br>' + e.details.map(esc).join('<br>') : ''}</div>`; }
    });
  }

  async function show(tab) {
    active = tab;
    view.querySelectorAll('.sc-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    body.innerHTML = loading();
    try { body.innerHTML = await tabs[tab](); }   // one failing tab never breaks the dashboard
    catch (e) { body.innerHTML = errBox(e) + (e.offline ? empty(`API base: ${API.base}`) : ''); }
  }

  function init() {
    const dash = $('#dashboard'), right = $('.topbar-right'); if (!dash || !right) return;
    const btn = document.createElement('button');
    btn.className = 'sc-nav-btn'; btn.id = 'sc-toggle'; btn.textContent = '⛓ SUPPLY CHAIN';
    right.prepend(btn);
    view = document.createElement('div'); view.id = 'sc-view'; view.className = 'hidden';
    view.innerHTML = `<div class="sc-wrap"><div class="report-header"><div class="report-header-left"><span class="report-tag">SUPPLY CHAIN INTELLIGENCE</span>
      <span class="report-title-main">Farm → Market Traceability &amp; Loss Analytics</span><span class="report-timestamp">Live from MySQL via Express API</span></div>
      <div class="report-header-right"><button class="btn-secondary" id="sc-close">← BACK TO SOIL DIAGNOSTICS</button></div></div>
      <div class="sc-tabs">${TABS.map(([k, l]) => `<button class="sc-tab" data-tab="${k}">${l}</button>`).join('')}</div><div id="sc-body"></div></div>`;
    dash.appendChild(view); body = $('#sc-body', view);
    view.querySelectorAll('.sc-tab').forEach(b => b.onclick = () => show(b.dataset.tab));
    const dashboardGrid = $('.dashboard-grid');

const toggle = open => {
  view.classList.toggle('hidden', !open);
  btn.classList.toggle('active', open);

  if (dashboardGrid) {
    dashboardGrid.classList.toggle('hidden', open);
  }

  if (open) {
    document.getElementById('bd-view')?.classList.add('hidden');
    document.getElementById('bd-toggle')?.classList.remove('active');
    show(active);
  }
};

btn.onclick = () => toggle(view.classList.contains('hidden'));
$('#sc-close', view).onclick = () => toggle(false);
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
