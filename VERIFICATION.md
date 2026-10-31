# Krushivikas replacement frontend — verification record

## Successfully checked in this environment

- Started from the uploaded `Krushivikas-main.zip` and retained its original source tree.
- Replaced all four original HTML entry files with the new interface shell; existing backend and SQL files were not edited.
- New frontend works with the existing Express same-origin allow-list (`/css`, `/js`, `/assets`, `/firebase`), so there is no need to change `backend/server.js`.
- All seven independent new JS modules pass `node --check` syntax parsing.
- Browser-run frontend smoke test exercised 15 distinct navigation views and mobile menu, with no JavaScript exceptions (Chromium DOM injection test).
- Additional browser-run functional test used **test-only, controlled API responses** to exercise farmer, buyer, reviewer, marketplace, farm-journal, checkout, modal forms, review decisions and soil-advisory flows. No JavaScript exceptions in the final pass.
- Rendered actual supplied imagery in desktop and mobile viewport screenshot inspections.
- Verified media file paths and original backend/database/ML file checksums against the original ZIP.
- Original landscape field video and both supplied portrait MP4 files are referenced in the editorial experience.

## Not verified as live end-to-end workflows

- Node dependency installation failed to complete in the sandbox (package registry access/timeouts). No Express process was started as part of the final integration test.
- A MySQL instance with the actual Krushivikas schema and records was not accessible. Database reads and writes, JWT issuance, transaction order updates and persistent CRUD operations **have not been live-tested** here.
- The Python TensorFlow crop model and joblib price forecast were not started; model inference and the endpoint bridge **have not been live-tested** here.
- Live Firebase, government mandi API and external Open-Meteo requests require external connectivity/configuration and **have not been confirmed** in this environment.
- Cross-browser performance testing on actual mobile hardware and real-user acceptance testing remain open.

## Backend-related findings from source inspection

1. Original `backend/server.js` serves the frontend itself. This package does **not** require a second frontend server.
2. The public marketplace listing and verified trace endpoints are distinct from login-restricted buyer/farmer actions.
3. The generic agricultural CRUD factory routes are not access-controlled. This is an **existing backend issue** and remains unchanged per the requested boundary.
4. Original reviewer evidence uploads and verification endpoints require reviewer JWTs.
5. Farmer registration needs an existing verified farmer record and one-time claim code.
6. Experimental banana price prediction has a hard-coded Linux venv path and explicitly rejects stale observations as current market forecasts.
7. The provided LLM client module directly targets an external provider without a secure backend proxy; it is preserved but is **not represented as a working new UI integration**.

## Real-world predeployment acceptance checks

1. Install dependencies with `cd backend && npm ci` and configure `.env`.
2. Import/upgrade a backed-up MySQL database and validate `/api/health` returns `database: connected`.
3. Exercise buyer, farmer and reviewer account flows with real credentials and role restrictions.
4. Exercise farmer profile save, weather, input/irrigation/expense logs and harvest-plan creation/update against real SQL.
5. Create a farmer listing from their harvest, place a buyer order, update its status and verify inventory and order values in MySQL.
6. Submit harvest evidence as reviewer, approve and verify it, then confirm the public trace route and QR work.
7. Start both Python model services and verify the results of a known test image and forecast job.
8. Verify Firebase sensor rules and government market-price API credentials.
9. Run responsive and accessibility checks on deployed browsers and genuine hardware.

The design and source are ready to try with your environment. **Do not mistake the browser test fixtures for proof of a live backend connection.**
