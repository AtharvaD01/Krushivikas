(() => {
  'use strict';

  const form = document.getElementById('farm-profile-form');
  const status = document.getElementById('farm-profile-status');
  const output = document.getElementById('farm-advisory-personalised');
  if (!form || !status || !output) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  async function request(path, options = {}) {
    const token = sessionStorage.getItem('kv_farmer_token');
    if (!token) throw new Error('Please log in as a farmer first.');
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
    let body = {};
    try { body = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body.data || body;
  }

  function soilGuidance(profile) {
    const items = [];
    const ph = profile?.soil_ph == null ? null : Number(profile.soil_ph);
    const n = profile?.nitrogen_kg_ha == null ? null : Number(profile.nitrogen_kg_ha);
    const p = profile?.phosphorus_kg_ha == null ? null : Number(profile.phosphorus_kg_ha);
    const k = profile?.potassium_kg_ha == null ? null : Number(profile.potassium_kg_ha);
    const oc = profile?.organic_carbon_pct == null ? null : Number(profile.organic_carbon_pct);

    if (ph !== null && Number.isFinite(ph)) {
      if (ph < 5.5) items.push(`Recorded soil pH ${ph}: strongly acidic; discuss lime requirement with a soil laboratory or local agriculture officer before applying amendments.`);
      else if (ph < 6.0) items.push(`Recorded soil pH ${ph}: mildly acidic; check the laboratory's crop-specific interpretation before changing pH.`);
      else if (ph <= 7.5) items.push(`Recorded soil pH ${ph}: within a commonly suitable range for banana; confirm with local soil-test recommendations.`);
      else items.push(`Recorded soil pH ${ph}: alkaline; check nutrient availability and obtain a laboratory recommendation before applying amendments.`);
    }
    if (n !== null && Number.isFinite(n)) items.push(`Soil-test nitrogen: ${n} kg/ha. Interpret against the lab's rating and crop recommendation; this number alone does not prescribe a fertiliser dose.`);
    if (p !== null && Number.isFinite(p)) items.push(`Soil-test phosphorus: ${p} kg/ha. Follow the test report's available-P method and local banana recommendation.`);
    if (k !== null && Number.isFinite(k)) items.push(`Soil-test potassium: ${k} kg/ha. Potassium is important for banana, but application rates must be based on the report, crop stage and local guidance.`);
    if (oc !== null && Number.isFinite(oc)) items.push(`Soil-test organic carbon: ${oc}%. Use the laboratory's soil-rating scale to interpret this value.`);
    if (!items.length) items.push('No soil-test values recorded. Enter results from a real soil report; soil type alone cannot determine pH, NPK or organic carbon.');
    return items;
  }

  function bananaStageGuidance(profile) {
    const crop = String(profile?.primary_crop || '').toLowerCase();
    if (!crop.includes('banana')) {
      return 'Your primary crop is not recorded as banana. Select Banana in the farm profile to receive the banana-specific section.';
    }
    const date = profile?.planting_date ? new Date(`${profile.planting_date}T00:00:00`) : null;
    const ageDays = date && !Number.isNaN(date.getTime())
      ? Math.floor((Date.now() - date.getTime()) / 86400000) : null;
    if (ageDays === null) return 'Add the planting date to estimate crop age. Stage guidance remains general until the date and field conditions are known.';
    if (ageDays < 45) return 'Early establishment: check transplant survival, root-zone moisture, drainage and plant stand. Avoid waterlogging and base nutrient applications on the local schedule and soil report.';
    if (ageDays < 150) return 'Vegetative growth: monitor leaf production, uniform growth, moisture and nutrient symptoms. Split nutrient applications according to the local banana recommendation and irrigation conditions.';
    if (ageDays < 240) return 'Developing canopy: maintain even root-zone moisture, monitor leaf health and pseudostem growth, and inspect regularly for pests and disease symptoms.';
    return 'Possible later growth stage: confirm whether the crop is approaching flowering or bunch development in the field. Support and nutrient management should follow cultivar-specific local guidance.';
  }

  function render(profile, records, weather, weatherError) {
    const soil = soilGuidance(profile);
    const banana = bananaStageGuidance(profile);
    const cards = [
      ['Banana growth stage', banana],
      ['Soil-test intelligence', soil.join(' ')],
      ['Water and irrigation', profile?.irrigation_method
        ? `Recorded method: ${escapeHtml(profile.irrigation_method)}. Adjust irrigation using root-zone moisture, crop stage, drainage and rainfall; this portal has no direct soil-moisture sensor reading.`
        : 'Add your irrigation method. Irrigation guidance will remain general until farm conditions are recorded.'],
      ['Field monitoring', 'Inspect leaves, roots, pseudostem, drainage and pests regularly. Record affected plants and dates. Visual symptoms can have multiple causes; seek expert confirmation before pesticide use.'],
    
    ];

    output.innerHTML = `<h3>Personalised farm intelligence</h3><div class="farm-advisory-grid">${cards.map(([title, body]) => `<article class="farm-advisory-card"><h4>${title}</h4><p>${Array.isArray(body) ? body.map(escapeHtml).join(' ') : body}</p></article>`).join('')}</div><p class="farm-advisory-disclaimer">${Array.isArray(records) && records.length ? `${records.length} recent harvest record(s) available. ` : 'No recent harvest records returned. '}Soil values are user-entered soil-test results, not sensor measurements. Weather values are forecasts for a matched area, not farm-gate observations. Recommendations are rule-based guidance, not a laboratory diagnosis or a trained predictive model.</p>`;
  }

  async function load() {
    let data;
    try {
      data = await request('/api/farm-profile');
    } catch (error) {
      status.textContent = error.message;
      output.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
      return;
    }

    const profile = data.profile || {};
    const fields = [
      'farm_size_acres', 'soil_type', 'irrigation_method', 'primary_crop',
      'crop_variety', 'planting_date', 'soil_ph', 'nitrogen_kg_ha',
      'phosphorus_kg_ha', 'potassium_kg_ha', 'organic_carbon_pct',
      'soil_test_date', 'soil_test_source'
    ];
    for (const name of fields) {
      const input = form.elements.namedItem(name);
      if (input && profile[name] != null) input.value = String(profile[name]).slice(0, 10);
    }

    let weather = null;
    let weatherError = '';
    try {
      weather = await request('/api/farm-weather');
    } catch (error) {
      weatherError = error.message;
    }
    render(profile, data.recordedCrops, weather, weatherError);
    status.textContent = data.profile ? 'Saved farm profile loaded.' : 'Add your farm details and save to get started.';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.textContent = 'Saving farm and soil-test data…';
    try {
      await request('/api/farm-profile', {
        method: 'PUT',
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries()))
      });
      await load();
      status.textContent = 'Farm profile saved successfully.';
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });

  load();
})();
