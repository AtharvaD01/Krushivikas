#!/usr/bin/env node
'use strict';

// Import the Government of India data.gov.in "Current Daily Price of Various Commodities
// from Various Markets (Mandi)" CSV, filtered to Banana. Source prices are INR/quintal;
// price/min_price/max_price are stored as INR/kg. Arrivals remain in source quintals.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

function parseCsv(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); if (row.some(v => v.trim())) rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell.replace(/\r$/, '')); if (row.some(v => v.trim())) rows.push(row); }
  if (rows.length < 2) throw new Error('CSV is empty or contains no data rows.');
  const keys = rows.shift().map(normalizeKey);
  return rows.map(values => Object.fromEntries(keys.map((k, i) => [k, (values[i] || '').trim()])));
}
function normalizeKey(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function first(row, names) { for (const name of names) { const v = row[normalizeKey(name)]; if (v !== undefined && v !== '') return v; } return ''; }
function num(value) { const n = Number(String(value || '').replace(/[,₹\s]/g, '')); return Number.isFinite(n) && n >= 0 ? n : null; }
function sqlDate(value) {
  const s = String(value || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null;
}
async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) throw new Error('Usage: node backend/scripts/import-banana-mandi-csv.js /path/to/official-mandi-data.csv');
  const rows = parseCsv(fs.readFileSync(path.resolve(csvPath), 'utf8'));
  const bananas = rows.filter(r => /^banana(?:\s*-\s*green)?$/i.test(String(first(r, ['commodity','crop','commodityname'])).trim()));
  if (!bananas.length) throw new Error('No rows with commodity=Banana found. No database changes were made. Check the official CSV and its headers.');

  const db = await mysql.createConnection({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD, database: process.env.DB_NAME || 'agricultural_supply_chain' });
  try {
    const [cropRows] = await db.execute("SELECT crop_id FROM crops WHERE LOWER(crop_name) = 'banana' LIMIT 1");
    if (!cropRows.length) throw new Error('Banana crop not found. Run database/banana_only_migration.sql first.');
    const cropId = cropRows[0].crop_id;
    let imported = 0, skipped = 0;
    await db.beginTransaction();
    for (const r of bananas) {
      const state = first(r, ['state','statename']);
      const district = first(r, ['district','districtname']);
      const market = first(r, ['market','mandi','marketname']);
      const date = sqlDate(first(r, ['arrivaldate','arrival_date','date','recordeddate']));
      const modalQtl = num(first(r, ['modalprice','modalpriceperquintal','modal_x0020_price']));
      const minQtl = num(first(r, ['minprice','minimumprice','min_x0020_price']));
      const maxQtl = num(first(r, ['maxprice','maximumprice','max_x0020_price']));
      if (!state || !market || !date || modalQtl === null || modalQtl <= 0) { skipped++; continue; }
      const variety = first(r, ['variety']) || 'Not reported';
      const grade = first(r, ['grade']) || 'Not reported';
      const arrivals = num(first(r, ['arrivalsinqtl','arrivalsquintal','arrivals','arrivalquantity']));
      await db.execute(`INSERT INTO market_prices
        (crop_id, market, state, district, variety, grade, price, min_price, max_price, arrivals_quintal, recorded_date, source, data_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'data.gov.in / AGMARKNET', 'official')
        ON DUPLICATE KEY UPDATE state=VALUES(state), district=VALUES(district), price=VALUES(price),
          min_price=VALUES(min_price), max_price=VALUES(max_price), arrivals_quintal=VALUES(arrivals_quintal),
          source=VALUES(source), data_status='official'`,
        [cropId, market.slice(0,100), state.slice(0,100), district.slice(0,100), variety.slice(0,100), grade.slice(0,50),
          Math.round((modalQtl / 100) * 100) / 100, minQtl === null ? null : Math.round((minQtl / 100) * 100) / 100,
          maxQtl === null ? null : Math.round((maxQtl / 100) * 100) / 100, arrivals, date]);
      imported++;
    }
    await db.commit();
    console.log(`Banana mandi import complete: ${imported} official records imported, ${skipped} rows skipped.`);
    console.log('Source prices were converted from INR/quintal to INR/kg; arrivals remain in quintals.');
    if (!imported) console.warn('No valid banana records were imported. Verify the CSV column headers and values.');
  } catch (err) { await db.rollback(); throw err; }
  finally { await db.end(); }
}
main().catch(err => { console.error(`Import failed: ${err.message}`); process.exitCode = 1; });
