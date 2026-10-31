# KRUSHIVIKAS — Soil Diagnostics + Agricultural Supply Chain Intelligence

The original KRUSHIVIKAS app (landing page → LAUNCH DIAGNOSTIC → soil diagnostic dashboard, Firebase sensors)
is unchanged. A new **⛓ SUPPLY CHAIN** button in the dashboard top bar opens the Supply Chain Intelligence
module, backed by Node.js + Express + MySQL.

```
ESP32 sensors → Firebase → sensorService/sensorStore → existing dashboard      (unchanged)
Browser → fetch() → Express API (:5001) → mysql2 → MySQL                       (new, separate)
```

## Run (from the project root)

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS agricultural_supply_chain CHARACTER SET utf8mb4;"
mysql -u root -p agricultural_supply_chain < database/schema.sql     # drops & recreates the project tables
mysql -u root -p agricultural_supply_chain < database/seed.sql       # DEMO data only
cd backend
npm install
# edit backend/.env and set DB_PASSWORD (backend/.env.example is the template; .env is git-ignored)
npm start
```

Open **http://localhost:5001** (Express serves the frontend too — no Live Server needed).
Landing page → LAUNCH DIAGNOSTIC → dashboard → **⛓ SUPPLY CHAIN**.

If you do use Live Server (:5500), add its origin to `CORS_ORIGINS` in `backend/.env`; `apiService.js` then
calls `http://localhost:5001/api` automatically. Override with `window.KRUSHI_API_BASE` if hosted elsewhere.

## Module tabs
OVERVIEW (KPIs from MySQL) · TRACE (search a lot → Farm→Harvest→Collection→Storage→Transport→Distribution→Retail,
largest-loss stage highlighted) · WASTAGE (by stage / crop / farm location / month / storage facility / vehicle) ·
PRICES · DEMAND · STORAGE (temp/humidity/duration/loss flags) · TRANSPORT (distance, duration, speed, loss) ·
DATA ENTRY (add + edit records in all 11 tables).

## API
`GET/POST /api/{farmers,crops,harvest,collection,storage,transportation,distribution,retail,market-prices,demand,wastage}`
`GET/PUT/PATCH/DELETE /api/<resource>/:id` · `GET /api/health`
`GET /api/dashboard/{summary,stage-losses,wastage?group_by=…,prices,demand,storage,transportation,chains,trace/:harvestId}`

## Notes
- Seed data is generated DEMO data, not real market data.
- Stage loss = input − output, only for lots that actually reached that stage (in-progress lots aren't counted as losses).
- Ideal storage ranges per crop (`backend/services/analyticsService.js` → `IDEAL`) are reference values for flagging; tune them.
- No ML forecasting or route optimisation is implemented (by design). `demand`, `market_prices` and `transportation`
  hold the history/distance/duration those features will need.
- The backend has no authentication yet; add it before exposing the API publicly.
