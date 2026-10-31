'use strict';

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router.use(requireRole('farmer'));

async function getFarmerId(userId) {
  const [rows] = await db.query(
    'SELECT farmer_id FROM farmer_accounts WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows.length ? Number(rows[0].farmer_id) : null;
}

router.get('/', asyncHandler(async (req, res) => {
  const farmerId = await getFarmerId(req.auth.userId);
  if (!farmerId) return res.status(404).json({ error: 'No farmer profile is linked to this account.' });

  const [farmers] = await db.query(
    'SELECT farmer_id, name, location FROM farmers WHERE farmer_id = ? LIMIT 1',
    [farmerId]
  );
  const [profiles] = await db.query(
    `SELECT farm_size_acres, soil_type, irrigation_method, primary_crop, crop_variety,
            planting_date, soil_ph, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha,
            organic_carbon_pct, soil_test_date, soil_test_source, updated_at
     FROM farmer_farm_profiles WHERE farmer_id = ? LIMIT 1`,
    [farmerId]
  );
  const [recordedCrops] = await db.query(
    `SELECT c.crop_name, c.variety, h.quantity, h.quality, h.harvest_date, h.location
     FROM harvest h LEFT JOIN crops c ON c.crop_id = h.crop_id
     WHERE h.farmer_id = ? ORDER BY h.harvest_date DESC LIMIT 10`,
    [farmerId]
  );

  res.json({ data: { farmer: farmers[0] || null, profile: profiles[0] || null, recordedCrops } });
}));

router.put('/', asyncHandler(async (req, res) => {
  const farmerId = await getFarmerId(req.auth.userId);
  if (!farmerId) return res.status(404).json({ error: 'No farmer profile is linked to this account.' });

  const body = req.body || {};
  const numeric = (key, min, max) => {
    const raw = body[key];
    if (raw === '' || raw == null) return null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw Object.assign(new Error(`Invalid value for ${key}.`), { status: 400 });
    }
    return value;
  };

  const size = numeric('farm_size_acres', 0.01, 1000000);
  const ph = numeric('soil_ph', 0, 14);
  const n = numeric('nitrogen_kg_ha', 0, 1000000);
  const p = numeric('phosphorus_kg_ha', 0, 1000000);
  const k = numeric('potassium_kg_ha', 0, 1000000);
  const oc = numeric('organic_carbon_pct', 0, 100);

  const soils = ['black', 'alluvial', 'red', 'laterite', 'sandy', 'clay', 'loamy', 'other'];
  const irrigations = ['drip', 'sprinkler', 'flood', 'rainfed', 'other'];
  const soil = body.soil_type || null;
  const irrigation = body.irrigation_method || null;
  const crop = String(body.primary_crop || '').trim() || null;
  const variety = String(body.crop_variety || '').trim() || null;
  const plantingDate = String(body.planting_date || '').trim() || null;
  const soilTestDate = String(body.soil_test_date || '').trim() || null;
  const soilTestSource = String(body.soil_test_source || '').trim() || null;

  if (soil && !soils.includes(soil)) throw Object.assign(new Error('Choose a valid soil type.'), { status: 400 });
  if (irrigation && !irrigations.includes(irrigation)) throw Object.assign(new Error('Choose a valid irrigation method.'), { status: 400 });
  if ((crop && crop.length > 100) || (variety && variety.length > 100) || (soilTestSource && soilTestSource.length > 150)) {
    throw Object.assign(new Error('Crop, variety, or soil-test source is too long.'), { status: 400 });
  }

  const validDate = value => !value || (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    value <= new Date().toISOString().slice(0, 10)
  );
  if (!validDate(plantingDate) || !validDate(soilTestDate)) {
    throw Object.assign(new Error('Enter valid dates that are not in the future.'), { status: 400 });
  }

  await db.query(
    `INSERT INTO farmer_farm_profiles
      (farmer_id, farm_size_acres, soil_type, irrigation_method, primary_crop, crop_variety,
       planting_date, soil_ph, nitrogen_kg_ha, phosphorus_kg_ha, potassium_kg_ha,
       organic_carbon_pct, soil_test_date, soil_test_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       farm_size_acres = VALUES(farm_size_acres), soil_type = VALUES(soil_type),
       irrigation_method = VALUES(irrigation_method), primary_crop = VALUES(primary_crop),
       crop_variety = VALUES(crop_variety), planting_date = VALUES(planting_date),
       soil_ph = VALUES(soil_ph), nitrogen_kg_ha = VALUES(nitrogen_kg_ha),
       phosphorus_kg_ha = VALUES(phosphorus_kg_ha), potassium_kg_ha = VALUES(potassium_kg_ha),
       organic_carbon_pct = VALUES(organic_carbon_pct), soil_test_date = VALUES(soil_test_date),
       soil_test_source = VALUES(soil_test_source)`,
    [farmerId, size, soil, irrigation, crop, variety, plantingDate, ph, n, p, k, oc, soilTestDate, soilTestSource]
  );

  res.json({ data: { saved: true } });
}));

module.exports = router;
