require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const db = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const ROOT = path.join(__dirname, '..');           // project root (frontend lives here)
const origins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({ origin: origins.length ? origins : false }));  // same-origin needs no CORS
app.use(express.json({ limit: '100kb' }));

/* ── API ── */
app.use('/api/reviewer-auth', require('./routes/reviewerAuth'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/farm-profile', require('./routes/farmProfile'));
app.use('/api/farm-weather', require('./routes/farmWeather'));
app.use('/api/farm-management', require('./routes/farmManagement'));
app.get('/api/health', async (req, res) => {
  try { await db.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' }); }
  catch (e) { res.status(503).json({ status: 'degraded', database: 'unavailable' }); }
});
app.use('/api/public-trace', require('./routes/publicTrace'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/farmers',       require('./routes/farmers'));
app.use('/api/crops',         require('./routes/crops'));
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/harvest',       require('./routes/harvest'));
app.use('/api/harvest-approval', require('./routes/harvestApproval'));
app.use('/api/harvest-evidence', require('./routes/harvestEvidence'));
app.use('/api/collection',    require('./routes/collection'));
app.use('/api/storage',       require('./routes/storage'));
app.use('/api/transportation',require('./routes/transportation'));
app.use('/api/distribution',  require('./routes/distribution'));
app.use('/api/retail',        require('./routes/retail'));
app.use('/api/nationwide-mandi', require('./routes/nationwideMandi'));
app.use('/api/market-prices', require('./routes/marketPrices'));
app.use('/api/price-prediction', require('./routes/pricePrediction'));
app.use('/api/disease-detection', require('./routes/diseaseDetection'));
app.use('/api/demand',        require('./routes/demand'));
app.use('/api/wastage',       require('./routes/wastage'));
app.use('/api', notFound);

/* ── Frontend (explicit allow-list so backend/.env and database/ are never served) ── */
['css', 'js', 'assets', 'firebase'].forEach(d => app.use('/' + d, express.static(path.join(ROOT, d))));
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.get('/banana-marketplace.html', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'banana-marketplace.html'));
});

app.get('/farmer-portal.html', (req, res) => {
  res.sendFile(require('path').join(__dirname, '..', 'farmer-portal.html'));
});

app.get('/trace.html', (req, res) => res.sendFile(path.join(ROOT, 'trace.html')));

app.use(errorHandler);

const PORT = Number(process.env.PORT || 5001);
app.listen(PORT, async () => {
  console.log(`KRUSHIVIKAS running → http://localhost:${PORT}`);
  try { await db.query('SELECT 1'); console.log('MySQL connected.'); }
  catch (e) { console.warn(`MySQL NOT reachable (${e.code || e.message}). API will return 503 until it is.`); }
});
