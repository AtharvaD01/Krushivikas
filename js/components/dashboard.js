/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Dashboard Controller
   Orchestrates the full diagnostic workflow:
   input → analysis → AI → report
   ═══════════════════════════════════════════════════ */

const dashboard = {

  sessionId: null,
  startTime: null,

  /* ── Initialise the dashboard ── */
  init() {
    this.sessionId = helpers.generateSessionId();
    this.startTime = new Date();

    /* Update topbar */
    const sidDisplay = document.getElementById('session-id-display');
    if (sidDisplay) sidDisplay.textContent = this.sessionId;

    this._startClock();

    /* Render sensors */
    sensorWidget.render('sensor-grid');
    soilEngine.applySensorData(sensorWidget.getReadings());
    this._updateDeviceStatus(false);


    if (window.sensorStore) {
      window.sensorStore.subscribeStore((data) => {
        const isLive = data.soil != null || data.rain != null || data.ldr != null;

        // Push live values into the widget cards
        sensorWidget.setReadingsFromStore(data);
        sensorWidget.render('sensor-grid');

        this._updateDeviceStatus(isLive);
      });
    }


    /* Render input form */
    inputPanel.render('input-form');

    /* Wire refresh sensors button */
    const refreshBtn = document.getElementById('refresh-sensors');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        sensorWidget.refresh('sensor-grid');
        soilEngine.applySensorData(sensorWidget.getReadings());
        this._flashBtn(refreshBtn);
      });
    }

    /* Wire analyze button */
    const analyzeBtn = document.getElementById('run-analysis-btn');
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', () => this.runAnalysis());
    }
  },

  /* ── Live clock in topbar ── */
  _startClock() {
    const el = document.getElementById('session-time');
    if (!el) return;
    const update = () => {
      el.textContent = helpers.formatTimestamp(new Date());
    };
    update();
    setInterval(update, 30000);
  },

  /* ── Visual feedback on button ── */
  _flashBtn(btn) {
    btn.style.transform = 'rotate(360deg)';
    btn.style.transition = 'transform .5s ease';
    setTimeout(() => {
      btn.style.transform = '';
      btn.style.transition = '';
    }, 600);
  },

  /* ── Device status from Firebase listener ── */
  _updateDeviceStatus(isLive) {
    const status = document.getElementById('device-status');
    if (!status) return;

    const dot = status.querySelector('.status-dot');
    const label = status.querySelector('.status-label');

    if (dot) {
      dot.classList.toggle('waiting', !isLive);
      dot.classList.toggle('connected', isLive);
    }

    if (label) label.textContent = isLive ? 'SENSORS LIVE' : 'AWAITING SENSORS';
  },

  /* ── Show / hide right-panel states ── */
  _showState(stateId) {
    ['idle-state', 'analysis-loader', 'report-output'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === stateId) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  },

  /* ── Run the full analysis pipeline ── */
  async runAnalysis() {
    this._showState('analysis-loader');
    this._runLoaderSequence();

    /* Collect user inputs */
    const inputs = inputPanel.getValues();

    /* Apply inputs to soil engine */
    soilEngine.reset();
    Object.values(inputs).forEach(v => {
      if (typeof v === 'string') soilEngine.applyObservation(v);
    });

    /* Apply sensor data */
    const sensorReadings = sensorWidget.getReadings();
    soilEngine.applySensorData(sensorReadings);

    /* Run engine computations */
    const profile = soilEngine.generateProfile();
    const model   = soilEngine.getModel();

    /* Build sub-reports */
    const classification = soilClassifier.buildReport(inputs, profile.soilType);
    const health         = this._buildHealthReport(model, profile.healthScore);
    const riskReport     = riskEngine.buildReport(model, sensorReadings);
    const cropReport     = cropEngine.buildReport(profile.soilType, health.score, model);

    /* Build AI payload */
    const diagnosticData = {
      inputs,
      classification,
      health,
      risks:    riskReport,
      crops:    cropReport,
      sensors:  sensorReadings,
      recommendations: window.sensorStore ? window.sensorStore.getRecommendations() : [],
    };

    /* Call AI service */
    const aiResult = await aiService.analyze(diagnosticData);

    /* Save to archive */
    storageService.save({
      sessionId:  this.sessionId,
      soilType:   classification.soilLabel,
      healthScore: health.score,
      riskLevel:   riskReport.summary.level,
      crops:       cropReport.recommended,
    });

    /* Render report */
    this._showState('report-output');
    reportPanel.render('report-output', {
      profile,
      classification,
      health,
      riskReport,
      cropReport,
      aiResult,
      sensors:   sensorReadings,
      sessionId: this.sessionId,
    });
  },

  /* ── Build health report from model + engine score ── */
  _buildHealthReport(model, score) {
    /* Compute individual indicators (capped at 20 each) */
    const indicators = {
      organic:   Math.min(20, Math.max(0, model.organic   * 2 + model.microbial)),
      structure: Math.min(20, Math.max(0, model.structure * 2 + model.root)),
      water:     Math.min(20, Math.max(0, model.water     * 2 + 2)),
      biology:   Math.min(20, Math.max(0, model.biology   * 2 + model.microbial)),
      fertility: Math.min(20, Math.max(0, model.fertility * 2 + model.organic)),
    };

    const deficiencies = [];
    if (model.organic   < 1) deficiencies.push('Low organic carbon');
    if (model.biology   < 1) deficiencies.push('Poor biological activity');
    if (model.structure < 0) deficiencies.push('Soil compaction present');
    if (model.water     < 0) deficiencies.push('Low moisture retention');
    if (model.fertility < 0) deficiencies.push('Nutrient deficiency risk');

    const restoration = [];
    if (model.organic   < 2) restoration.push('Apply compost or farmyard manure');
    if (model.biology   < 2) restoration.push('Increase microbial activity with organic inputs');
    if (model.structure < 1) restoration.push('Introduce deep root crops to break compaction');
    if (model.water     < 1) restoration.push('Use mulching to conserve soil moisture');
    if (model.fertility < 1) restoration.push('Introduce legume-based crop rotation');

    const rating = (() => {
      if (score >= 80) return 'Excellent agricultural soil';
      if (score >= 60) return 'Healthy productive soil';
      if (score >= 40) return 'Moderate soil health';
      if (score >= 20) return 'Degraded soil';
      return 'Severely degraded soil';
    })();

    return { score, rating, indicators, deficiencies, restoration };
  },

  /* ── Animated loader log ── */
  async _runLoaderSequence() {
    const subEl = document.getElementById('loader-sub');
    const logEl = document.getElementById('loader-log');

    if (logEl) logEl.innerHTML = '';

    const steps = KV_CONSTANTS.ANALYSIS_STEPS;

    for (let i = 0; i < steps.length; i++) {
      await helpers.sleep(KV_CONSTANTS.STEP_DELAY);

      if (subEl) subEl.textContent = steps[i];

      if (logEl && i > 0) {
        const line = document.createElement('div');
        line.className = 'log-line';
        line.textContent = steps[i - 1].replace('...', ' ✓');
        logEl.appendChild(line);

        /* Keep log scrolled to bottom */
        logEl.scrollTop = logEl.scrollHeight;
      }
    }
  },

  /* ── Reset dashboard to idle ── */
  resetDashboard() {
    inputPanel.reset();
    soilEngine.reset();
    this._showState('idle-state');

    /* Scroll to top of right panel */
    const rightPanel = document.getElementById('right-panel');
    if (rightPanel) rightPanel.scrollTop = 0;
  },

};
