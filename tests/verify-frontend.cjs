'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const check=p=>{const absolute=path.join(root,p);assert(fs.existsSync(absolute),`Missing: ${p}`);return fs.readFileSync(absolute,'utf8');};
const names=['core','editorial','commerce','farm','intelligence','network','bootstrap'];
const html=check('index.html');
const pages=['farmer-portal.html','banana-marketplace.html','trace.html'];
const css=check('css/krushivikas-2026.css');
assert(css.includes('.hero')&&css.includes('@media'), 'Stylesheet is incomplete');
for(const page of pages)assert(check(page).includes('/js/kv-2026/bootstrap.js'),`${page} is not linked`);
for(const name of names){const file='js/kv-2026/'+name+'.js';check(file);assert(html.includes('/'+file),`${name} script is not linked`);cp.execFileSync(process.execPath,['--check',path.join(root,file)]);}
for(const p of ['backend/server.js','backend/routes/auth.js','backend/routes/marketplace.js','backend/routes/diseaseDetection.js','backend/config/db.js','database/schema.sql','database/farmer_intelligence_migration.sql','disease-detection/models/banana_disease_model.keras','disease-detection/service/predict_api.py','price-prediction/banana_price_model.joblib','firebase/firebaseConfig.js','assets/CP.mp4','assets/brand/dusk-fields.jpg','assets/brand/terraced-fields.jpg','assets/brand/farm-operations.jpg','assets/brand/leaf-disease.jpg','assets/brand/field-film-01.mp4','assets/brand/field-film-02.mp4'])check(p);
for(const route of ['auth/login','auth/register','auth/register-farmer','reviewer-auth/login','farm-profile','farm-management','farm-weather','marketplace/listings','marketplace/orders','disease-detection/predict','nationwide-mandi','price-prediction','public-trace','harvest-approval','dashboard/summary'])assert(names.some(n=>check(`js/kv-2026/${n}.js`).includes(route)),`Missing API reference: ${route}`);
console.log('OK: HTML pages, new JS modules, source syntax, API references, original backend/database/model files, and all photo/video assets.');
console.log('NOTE: This does not test a running MySQL, Firebase or Python model service.');
