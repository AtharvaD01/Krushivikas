# Krushivikas — New frontend, complete original backend

This archive is the **whole Krushivikas application**. Open the project's `index.html` through the existing Express server. The original database, migrations, APIs, authentication logic, ML models, Python prediction service, Firebase configuration and operational scripts are included and have not been rewritten.

## What has changed

The four browser entry files (`index.html`, `farmer-portal.html`, `banana-marketplace.html`, `trace.html`) now launch the new 2026 interface. They use a fresh frontend codebase at:

- `css/krushivikas-2026.css` — dark editorial visual system, desktop/tablet/mobile layouts
- `js/kv-2026/core.js` — navigation, network client, auth/session, shared components
- `js/kv-2026/editorial.js` — cinematic homepage and platform storytelling
- `js/kv-2026/commerce.js` — login/registration, marketplace, orders
- `js/kv-2026/farm.js` — farm profile, weather, farm journal and harvest plans
- `js/kv-2026/intelligence.js` — banana disease ML, mandi prices, price prediction, public trace
- `js/kv-2026/network.js` — reviewer verification, supply-chain CRUD, analytics, Firebase sensors, manual soil observations
- `js/kv-2026/bootstrap.js` — route composition and browser interactions
- `assets/brand/` — the photos and portrait film clips you supplied
- `assets/CP.mp4` — the original landscape field film, used for the homepage hero

Older browser JS/CSS files are retained **only for archival compatibility**; the new pages do not import them. No React, bundler, or separate frontend server is needed. The existing Express server serves this frontend and the unchanged `/api` routes at the same origin.

## 1. Configure MySQL

Use the existing MySQL schema from `database/schema.sql` **only when setting up a fresh database**. That file may recreate tables and should NOT be rerun against a database containing real records without reviewing it and taking a backup.

For a fresh installation, create the database and inspect/apply the original schema and relevant migrations in the `database/` directory. Migrations cover farm profiles, management records, marketplace, account claims, and agricultural intelligence.

`database/seed.sql` contains *demonstration* records. Do not import it into a production database expecting genuine activity.

## 2. Configure Express and authentication

```bash
cd backend
npm ci
```

Copy `backend/.env.example` to `backend/.env` and fill in the credentials for your local environment, for example:

```ini
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_MYSQL_PASSWORD
DB_NAME=agricultural_supply_chain
DB_PORT=3306
PORT=5001
AUTH_TOKEN_SECRET=REPLACE_WITH_YOUR_OWN_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
REVIEWER_PASSWORD=SET_YOUR_OWN_SECURE_REVIEWER_PASSWORD
# Optional: government mandi data
DATA_GOV_IN_API_KEY=YOUR_KEY
```

Do not commit `.env` with real passwords. The JWT secret must be at least 32 characters. `REVIEWER_PASSWORD` is only needed for reviewer authentication. Farmer registration requires a valid claim code, issued by `backend/scripts_issue_farmer_claim.js` to a farmer profile already in the database.

Start the unchanged server:

```bash
npm start
```

Then open **http://localhost:5001/**. No Live Server, no `npm run dev`, and no separate React app.

To check that the API can reach MySQL, visit **http://localhost:5001/api/health**. A healthy response reads `{"status":"ok","database":"connected"}`. `database: "unavailable"` means the SQL service is not ready; frontend pages will report a real connection error rather than invent results.

## 3. Optional Python ML services

### Banana disease detection

The existing Express endpoint `/api/disease-detection/predict` forwards uploaded leaf images to the Python service on `127.0.0.1:8000`. Install the Python dependencies required by `disease-detection/service/predict_api.py` (Flask, TensorFlow, Pillow, NumPy) in an appropriate Python environment, then run the service from your project root:

```bash
python disease-detection/service/predict_api.py
```

Test `http://127.0.0.1:8000/health` and ensure `model_loaded` is true. The frontend shows a useful error if the ML service is not running. Models remain intact in `disease-detection/models/`.

### Banana price prediction

The backend currently expects a Python virtual environment at `price-prediction/.venv/bin/python` (Linux/macOS path) and the original scikit-learn/joblib/pandas model dependencies. Create the environment at that expected path on a compatible host. On Windows, the original hard-coded path is incompatible with the normal `.venv/Scripts/python.exe` layout: adapting it would require a backend modification, which was deliberately **not** made here. Price history can still load independently from the existing CSV.

### Firebase sensor readings

Open **Workspace → Live sensors** using a farmer account. This reads the original Firebase Realtime Database `latest/` path via the existing Firebase configuration and the compatible Firebase browser SDK. It requires network access and Firebase rules that permit the desired read. Unavailable sensor readings are not fabricated.

### LLM functionality

The original source includes `js/services/aiService.js` with a browser-side Claude endpoint. **The uploaded backend has no authenticated LLM API route or secure server-side API-key integration**. The original source remains in the archive, but this new frontend does not make unsafe direct browser calls to an LLM and does not pretend an LLM analysis was produced. The Soil Advisory page provides clearly labeled, local rule-based interpretations. To add a true LLM workflow, a secure backend endpoint would be needed; backend edits were out of scope.

## Navigation / user roles

**Public:** Home, platform, marketplace browsing, market intelligence, banana crop diagnosis, soil advisory, public verified-harvest tracing, operational analytics.

**Buyer:** buyer registration/login; purchase listings through the existing transactional endpoint; view and cancel eligible orders.

**Farmer:** verified claim-code registration/login; farm profile and soil tests; five-day weather forecasts; input/irrigation/expense/harvest-plan recording; own listings from harvests; manage orders; Firebase sensor view.

**Reviewer:** password login; approve/reject pending harvests; upload GPS/image evidence; inspect authenticated evidence; verify eligible approved harvests.

**Operations:** authenticated UI for the existing farmer/crop/harvest/collection/storage/transport/distribution/retail/wastage/demand/market-prices CRUD endpoints. The underlying generic CRUD routes in this original backend **do not enforce role access**; do not expose the server to the public internet without hardening them.

**Public trace:** `/trace.html?id=123` remains supported for the QR URLs generated by the backend. Only approved AND verified harvests are returned by the public endpoint.

## Verification and known boundaries

See `VERIFICATION.md` for the precise checks performed and the services that could not be end-to-end exercised in the build environment. Run the dependency-free source integrity test with:

```bash
node tests/verify-frontend.cjs
```

This test checks source assets, JavaScript syntax, HTML entry files, and the presence of unchanged backend/database and ML files; it is **not a replacement for a running database integration test**.
