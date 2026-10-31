/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Sensor Widget Component
   Simulates and displays live sensor readings
   ═══════════════════════════════════════════════════ */

const sensorWidget = {

  /* ── Current readings ── */
  readings: {
    soil: null,
    rain: null,
    ldr:  null,
  },

  /* ── Sensor configuration metadata ── */
  config: [
    {
      key:   'soil',
      label: '🌱 Soil Moisture',
      unit:  '',
      thresholds: { good: [2500, 3600], moderate: [2800, 3800] },
    },
    {
      key:   'rain',
      label: '☔ Rain Sensor',
      unit:  '',
      thresholds: { good: [0, 3000], moderate: [2500, 3500] },
    },
    {
      key:   'ldr',
      label: '☀ Light Intensity',
      unit:  '',
      thresholds: { good: [1800, 4096], moderate: [1200, 1800] },
    },
  ],


  /* ── Populate readings from live sensor store ── */
  setReadingsFromStore(store) {
    if (!store) return this.readings;

    // Map device fields to widget readings
    if (store.soil != null) this.readings.soil = store.soil;
    if (store.rain != null) this.readings.rain = store.rain;
    if (store.ldr  != null) this.readings.ldr  = store.ldr;

    return this.readings;
  },


  /* ── Determine status class for a sensor value ── */
  getStatus(cfg, val) {
    const [gMin, gMax] = cfg.thresholds.good;
    const [mMin, mMax] = cfg.thresholds.moderate;

    if (val >= gMin && val <= gMax)  return 'good';
    if (val >= mMin && val <= mMax)  return 'moderate';
    return 'critical';
  },

  /* ── Status label text ── */
  statusLabel(status) {
    return { good: 'OPTIMAL', moderate: 'MODERATE', critical: 'CRITICAL' }[status] || '—';
  },

  /* ── Render all sensor cards ── */
  render(containerId = 'sensor-grid') {
    const container = document.getElementById(containerId);
    if (!container) return;

    /* Render using current readings (populated by sensorStore subscription) */
    container.innerHTML = this.config.map(cfg => {
      const raw    = this.readings[cfg.key];
      const val    = raw != null ? raw : 0;
      const status = this.getStatus(cfg, val);
      const disp   = cfg.decimals ? val.toFixed(cfg.decimals) : val;

      return `
        <div class="sensor-card ${status}" title="${cfg.label}: ${disp}${cfg.unit}">
          <span class="sensor-label">${cfg.label}</span>
          <div class="sensor-value">${disp}</div>
          <div class="sensor-unit">${cfg.unit}</div>
          <span class="sensor-status ${status}">${this.statusLabel(status)}</span>
        </div>
      `;
    }).join('');
  },

  /* ── Refresh readings and update DOM ── */
  refresh(containerId = 'sensor-grid') {
    this.render(containerId);
    soilEngine.applySensorData(this.readings);
  },

  /* ── Get current readings snapshot ── */
  getReadings() {
    return helpers.clone(this.readings);
  },

};
