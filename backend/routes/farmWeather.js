'use strict';

const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

router.use(requireRole('farmer'));

router.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.query(
    `SELECT f.location
     FROM farmer_accounts fa
     JOIN farmers f ON f.farmer_id = fa.farmer_id
     WHERE fa.user_id = ?
     LIMIT 1`,
    [req.auth.userId]
  );

  if (!rows.length || !rows[0].location) {
    return res.status(404).json({ error: 'Farm location is not available in your profile.' });
  }

  const location = String(rows[0].location).trim();
  const geoUrl = new URL('https://geocoding-api.open-meteo.com/v1/search');
  geoUrl.search = new URLSearchParams({
  name: location.split(',')[0].trim(),
  count: '10',
  language: 'en',
  format: 'json',
  countryCode: 'IN'
}).toString();

  const geoResponse = await fetch(geoUrl, { signal: AbortSignal.timeout(8000) });
  if (!geoResponse.ok) {
    return res.status(502).json({ error: 'Weather location lookup is temporarily unavailable.' });
  }

  const geo = await geoResponse.json();
  const results = Array.isArray(geo.results) ? geo.results : [];
const place =
  results.find(result =>
    result.country_code === 'IN' &&
    result.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() ===
    location.split(',')[0].trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  ) ||
  results.find(result => result.country_code === 'IN') ||
  null;
  if (!place) {
    return res.status(404).json({ error: 'Could not locate your farm area for a weather forecast.' });
  }

  const forecastUrl = new URL('https://api.open-meteo.com/v1/forecast');
  forecastUrl.search = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum',
    forecast_days: '5',
    timezone: 'auto'
  });

  const forecastResponse = await fetch(forecastUrl, { signal: AbortSignal.timeout(10000) });
  if (!forecastResponse.ok) {
    return res.status(502).json({ error: 'Weather forecast is temporarily unavailable.' });
  }

  const forecast = await forecastResponse.json();
  res.set('Cache-Control', 'private, max-age=1800');
  res.json({
    data: {
      location: {
        name: place.name,
        admin1: place.admin1 || null,
        country: place.country || null,
        latitude: place.latitude,
        longitude: place.longitude
      },
      source: 'Open-Meteo',
      retrievedAt: new Date().toISOString(),
      daily: forecast.daily || null,
      note: 'Forecast data for the matched area; it is not a field sensor reading.'
    }
  });
}));

module.exports = router;
