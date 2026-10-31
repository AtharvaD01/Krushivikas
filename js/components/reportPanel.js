/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Report Panel Component
   Renders the full diagnostic report UI with:
   - Health score gauge
   - Classification card
   - Sensor summary
   - Indicators table
   - Risk assessment
   - AI recommendations
   - Crop suitability
   - Recovery timeline
   ═══════════════════════════════════════════════════ */

const reportPanel = {

  /* ── Render full report into container ── */
  render(containerId, { profile, classification, health, riskReport, cropReport, aiResult, sensors, sessionId }) {

    const container = document.getElementById(containerId);
    if (!container) return;

    const timestamp  = helpers.formatTimestamp();
    const scoreClass = helpers.healthClass(health.score);
    const scoreLabel = helpers.healthLabel(health.score);
    const aiData     = aiResult.data;

    container.innerHTML = `

      <!-- REPORT HEADER -->
      ${this._renderHeader(sessionId, timestamp, classification.confidencePct)}

      <!-- ROW 1: HEALTH + CLASSIFICATION -->
      <div class="report-grid">
        ${this._renderHealthCard(health, scoreClass, scoreLabel)}
        ${this._renderClassificationCard(classification)}
      </div>

      <!-- ROW 2: SENSOR SNAPSHOT + INDICATORS -->
      <div class="report-grid">
        ${this._renderSensorCard(sensors)}
        ${this._renderIndicatorsCard(health)}
      </div>

      <!-- ROW 3: RISKS + CROPS -->
      <div class="report-grid">
        ${this._renderRiskCard(riskReport)}
        ${this._renderCropCard(aiData.cropRecommendations, classification.recommendedCrops)}
      </div>

      <!-- ROW 4: AI SUMMARY (full width) -->
      <div class="report-grid wide">
        ${this._renderAISummary(aiData)}
      </div>

      <!-- ROW 5: ACTIONS + TIMELINE -->
      <div class="report-grid">
        ${this._renderActionsCard(aiData.immediateActions)}
        ${this._renderTimelineCard(aiData.recoveryTimeline)}
      </div>

      <!-- ROW 6: FERTILIZER + WATER -->
      <div class="report-grid">
        ${this._renderManagementCard('FERTILIZER PLAN', '⬡', aiData.fertilizerPlan)}
        ${this._renderManagementCard('WATER MANAGEMENT', '◎', aiData.waterManagement)}
      </div>

      <!-- FOOTER ACTIONS -->
      <div class="report-footer">
        <button class="btn-secondary" id="new-diagnostic-btn">
          ↺ NEW DIAGNOSTIC
        </button>
        <button class="btn-secondary" id="export-report-btn">
          ↓ EXPORT REPORT
        </button>
      </div>
    `;

    /* Animate health gauge fill after insert */
    requestAnimationFrame(() => {
      const fill = container.querySelector('.health-gauge-fill');
      if (fill) {
        fill.style.width = '0%';
        setTimeout(() => { fill.style.width = health.score + '%'; }, 100);
      }

      /* Animate indicator bars */
      container.querySelectorAll('.ind-bar-fill').forEach(bar => {
        const target = bar.dataset.target || '0';
        bar.style.width = '0%';
        setTimeout(() => { bar.style.width = target + '%'; }, 200);
      });
    });

    /* Wire up footer buttons */
    const newBtn = container.querySelector('#new-diagnostic-btn');
    if (newBtn) newBtn.addEventListener('click', () => dashboard.resetDashboard());

    const exportBtn = container.querySelector('#export-report-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => this._exportReport(sessionId, profile, classification, health, riskReport, aiData));
  },


  /* ── HEADER ── */
  _renderHeader(sessionId, timestamp, confidencePct) {
    return `
      <div class="report-header">
        <div class="report-header-left">
          <div class="report-tag">◈ SOIL INTELLIGENCE REPORT</div>
          <div class="report-title-main">Diagnostic Analysis</div>
          <div class="report-timestamp">${sessionId}  ·  ${timestamp}</div>
        </div>
        <div class="report-header-right">
          <div class="confidence-badge">
            <span class="pulse-dot green"></span>
            <span class="confidence-label">AI CONFIDENCE</span>
            <span class="confidence-val">${confidencePct}%</span>
          </div>
        </div>
      </div>
    `;
  },


  /* ── HEALTH SCORE CARD ── */
  _renderHealthCard(health, scoreClass, scoreLabel) {
    return `
      <div class="report-card highlight" style="animation-delay:.05s">
        <div class="card-label"><span class="card-label-icon">◈</span> SOIL HEALTH SCORE</div>
        <div class="card-value-large ${scoreClass}">${health.score}</div>
        <div class="card-sub">out of 100 — ${scoreLabel}</div>
        <div class="health-gauge">
          <div class="health-gauge-fill ${scoreClass}" style="width:0%"></div>
        </div>
        <div class="card-sub" style="margin-top:6px">${health.rating}</div>
      </div>
    `;
  },


  /* ── SOIL CLASSIFICATION CARD ── */
  _renderClassificationCard(cl) {
    return `
      <div class="report-card" style="animation-delay:.10s">
        <div class="card-label"><span class="card-label-icon">◧</span> SOIL CLASSIFICATION</div>
        <div style="font-family:'Fraunces',serif; font-size:20px; color:var(--amber-light); margin-bottom:8px">
          ${cl.soilLabel}
        </div>
        <div class="card-sub" style="margin-bottom:12px; line-height:1.6; color:var(--text-secondary); font-size:11px">
          ${cl.soilDescription}
        </div>
        <div style="display:flex; gap:20px; margin-top:10px">
          <div>
            <div class="card-sub">WATER RETENTION</div>
            <div style="font-family:'DM Mono',monospace; font-size:13px; color:var(--text-primary)">
              ${Math.round(cl.textureProfile.waterRetention * 100)}%
            </div>
          </div>
          <div>
            <div class="card-sub">AERATION</div>
            <div style="font-family:'DM Mono',monospace; font-size:13px; color:var(--text-primary)">
              ${Math.round(cl.textureProfile.aeration * 100)}%
            </div>
          </div>
          <div>
            <div class="card-sub">NUTRIENT HOLD</div>
            <div style="font-family:'DM Mono',monospace; font-size:13px; color:var(--text-primary)">
              ${Math.round(cl.textureProfile.nutrientHolding * 100)}%
            </div>
          </div>
        </div>
      </div>
    `;
  },


  /* ── SENSOR SNAPSHOT CARD ── */
  _renderSensorCard(sensors) {
    const rows = [
      { label: 'Soil Moisture',  value: sensors.soil ?? '-' },
      { label: 'Rain Sensor',    value: sensors.rain ?? '-' },
      { label: 'Light Intensity', value: sensors.ldr ?? '-' },
    ];
    const rowsHtml = rows.map(r => `
      <tr>
        <td class="ind-label">${r.label}</td>
        <td style="text-align:right; font-family:'DM Mono',monospace; font-size:11px; color:var(--amber-light)">${r.value}</td>
      </tr>
    `).join('');

    return `
      <div class="report-card" style="animation-delay:.15s">
        <div class="card-label"><span class="card-label-icon">⬡</span> SENSOR READINGS</div>
        <table class="indicators-table">${rowsHtml}</table>
      </div>
    `;
  },


  /* ── HEALTH INDICATORS TABLE ── */
  _renderIndicatorsCard(health) {
    const indicators = [
      { label: 'Organic Carbon',    key: 'organic',   max: 20 },
      { label: 'Soil Structure',    key: 'structure', max: 20 },
      { label: 'Water Retention',   key: 'water',     max: 20 },
      { label: 'Biological Activity', key: 'biology', max: 20 },
      { label: 'Nutrient Fertility',key: 'fertility', max: 20 },
    ];

    const rows = indicators.map(ind => {
      const val = health.indicators[ind.key] || 0;
      const pct = Math.round((val / ind.max) * 100);
      return `
        <tr>
          <td style="font-family:'DM Mono',monospace; font-size:9px; color:var(--text-muted); padding:8px 0; border-bottom:1px solid var(--soil-border)">
            ${ind.label}
          </td>
          <td style="padding:8px 0; border-bottom:1px solid var(--soil-border); text-align:right">
            <div class="ind-bar">
              <div class="ind-bar-track">
                <div class="ind-bar-fill" data-target="${pct}" style="width:0%"></div>
              </div>
              <span class="ind-val">${val}</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div class="report-card" style="animation-delay:.20s">
        <div class="card-label"><span class="card-label-icon">◎</span> SOIL INDICATORS</div>
        <table class="indicators-table" style="width:100%">${rows}</table>
      </div>
    `;
  },


  /* ── RISK ASSESSMENT CARD ── */
  _renderRiskCard(riskReport) {
    const { summary, risks } = riskReport;
    const levelColors = { critical: 'critical', high: 'critical', moderate: 'moderate', low: 'good' };
    const cls = levelColors[summary.level] || 'moderate';

    const riskItems = risks.length === 0
      ? '<div style="font-size:12px; color:var(--good); padding:8px 0">✓ No critical risk factors detected</div>'
      : risks.map(r => `
          <div class="risk-item ${r.severity}">
            <div class="risk-dot"></div>
            <div>
              <div style="font-weight:500; font-size:12px; margin-bottom:2px">${r.title}</div>
              <div style="font-size:11px; opacity:.85; line-height:1.5">${r.message}</div>
            </div>
          </div>
        `).join('');

    return `
      <div class="report-card" style="animation-delay:.25s">
        <div class="card-label"><span class="card-label-icon">▲</span> RISK ASSESSMENT</div>
        <div style="margin-bottom:12px">
          <span style="font-family:'DM Mono',monospace; font-size:11px; color:var(--${cls}); letter-spacing:1px">
            ${summary.label}
          </span>
          <div style="font-size:11px; color:var(--text-muted); margin-top:3px">${summary.summary}</div>
        </div>
        <div class="risk-list">${riskItems}</div>
      </div>
    `;
  },


  /* ── CROP SUITABILITY CARD ── */
  _renderCropCard(aiCrops, fallbackCrops) {
    const primary = (aiCrops && aiCrops.primary && aiCrops.primary.length > 0)
      ? aiCrops.primary
      : (fallbackCrops || []);
    const avoid   = aiCrops && aiCrops.avoid ? aiCrops.avoid : [];
    const rotation = aiCrops && aiCrops.rotation ? aiCrops.rotation : '';

    const tags = primary.map((c, i) =>
      `<span class="crop-tag ${i < 3 ? 'primary' : ''}">${c}</span>`
    ).join('');

    const avoidHtml = avoid.length > 0
      ? `<div style="margin-top:12px; font-size:11px; color:var(--critical)">
           Avoid: ${avoid.join(' · ')}
         </div>`
      : '';

    const rotHtml = rotation
      ? `<div style="margin-top:10px; font-size:11px; color:var(--text-muted); line-height:1.5">
           ${rotation}
         </div>`
      : '';

    return `
      <div class="report-card" style="animation-delay:.30s">
        <div class="card-label"><span class="card-label-icon">◐</span> CROP SUITABILITY</div>
        <div class="crop-grid">${tags}</div>
        ${avoidHtml}
        ${rotHtml}
      </div>
    `;
  },


  /* ── AI SUMMARY CARD (full width) ── */
  _renderAISummary(aiData) {
    const findings = (aiData.keyFindings || []).map(f =>
      `<div class="action-item" style="border-color:var(--soil-surface)">
        <div class="action-num">→</div>
        <div>${f}</div>
      </div>`
    ).join('');

    return `
      <div class="report-card ai-insight" style="animation-delay:.35s; border-left:3px solid var(--amber)">
        <div class="ai-insight-header">
          <span class="pulse-dot green"></span>
          <span class="ai-label">AI AGRONOMIST ANALYSIS</span>
        </div>
        <div class="ai-insight-text" style="margin-bottom:16px">${aiData.soilSummary || '—'}</div>
        <div style="font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; color:var(--text-muted); margin-bottom:10px">
          KEY FINDINGS
        </div>
        <div class="action-list" style="border:none">${findings}</div>
        <div style="margin-top:16px; padding-top:14px; border-top:1px solid var(--soil-border)">
          <div style="font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; color:var(--text-muted); margin-bottom:6px">LONG-TERM STRATEGY</div>
          <div style="font-size:12px; color:var(--text-secondary); line-height:1.7">${aiData.longTermHealth || '—'}</div>
        </div>
      </div>
    `;
  },


  /* ── IMMEDIATE ACTIONS CARD ── */
  _renderActionsCard(actions) {
    const items = (actions || []).map(a => `
      <div class="action-item">
        <div class="action-num">${a.priority}</div>
        <div>
          <div style="font-size:12px; margin-bottom:2px">${a.action}</div>
          <div style="font-family:'DM Mono',monospace; font-size:9px; color:var(--amber); letter-spacing:.5px">${a.timeframe}</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="report-card" style="animation-delay:.40s">
        <div class="card-label"><span class="card-label-icon">◈</span> IMMEDIATE ACTIONS</div>
        <div class="action-list">${items || '<div style="font-size:12px;color:var(--text-muted)">No urgent actions required.</div>'}</div>
      </div>
    `;
  },


  /* ── RECOVERY TIMELINE CARD ── */
  _renderTimelineCard(timeline) {
    const items = (timeline || []).map(t => `
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-period">${t.period}</div>
          <div class="timeline-action">${t.action}</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="report-card" style="animation-delay:.45s">
        <div class="card-label"><span class="card-label-icon">◐</span> RECOVERY TIMELINE</div>
        <div class="timeline">${items || '<div style="font-size:12px;color:var(--text-muted)">No recovery plan generated.</div>'}</div>
      </div>
    `;
  },


  /* ── GENERIC MANAGEMENT CARD ── */
  _renderManagementCard(title, icon, content) {
    return `
      <div class="report-card" style="animation-delay:.50s">
        <div class="card-label"><span class="card-label-icon">${icon}</span> ${title}</div>
        <div style="font-size:12px; color:var(--text-secondary); line-height:1.75">${content || '—'}</div>
      </div>
    `;
  },


  /* ── Export report to text ── */
  _exportReport(sessionId, profile, classification, health, riskReport, aiData) {
    const lines = [
      'KRUSHIVIKAS SOIL INTELLIGENCE REPORT',
      '═══════════════════════════════════════',
      'Session: ' + sessionId,
      'Date:    ' + helpers.formatTimestamp(),
      '',
      'SOIL CLASSIFICATION',
      '  Type:   ' + classification.soilLabel,
      '  Health: ' + health.score + '/100 — ' + helpers.healthLabel(health.score),
      '  AI Confidence: ' + classification.confidencePct + '%',
      '',
      'RISKS',
      '  ' + riskReport.summary.label + ': ' + riskReport.summary.summary,
      ...(riskReport.risks.map(r => '  [' + r.severity.toUpperCase() + '] ' + r.title)),
      '',
      'RECOMMENDED CROPS',
      '  ' + (aiData.cropRecommendations && aiData.cropRecommendations.primary || classification.recommendedCrops || []).join(', '),
      '',
      'AI ANALYSIS',
      '  ' + (aiData.soilSummary || '—'),
      '',
      'IMMEDIATE ACTIONS',
      ...(aiData.immediateActions || []).map(a => '  ' + a.priority + '. ' + a.action + ' (' + a.timeframe + ')'),
      '',
      'RECOVERY TIMELINE',
      ...(aiData.recoveryTimeline || []).map(t => '  ' + t.period + ': ' + t.action),
      '',
      '═══════════════════════════════════════',
      'KRUSHIVIKAS Agricultural Intelligence Platform v2.0',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'krushivikas-report-' + sessionId + '.txt';
    a.click();
    URL.revokeObjectURL(url);
  },

};
