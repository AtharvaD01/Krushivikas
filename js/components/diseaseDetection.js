/* Banana Disease Detection — KRUSHIVIKAS */
(() => {
  const API_URL = '/api/disease-detection/predict';

  function init() {
    const dashboard = document.getElementById('dashboard');
    const topbar = dashboard?.querySelector('.topbar-right');

    if (!dashboard || !topbar || document.getElementById('bd-toggle')) return;

    const button = document.createElement('button');
    button.id = 'bd-toggle';
    button.className = 'sc-nav-btn';
    button.textContent = '🍃 DISEASE DETECTION';
    topbar.prepend(button);

    const panel = document.createElement('section');
    panel.id = 'bd-view';
    panel.className = 'hidden';
    panel.innerHTML = `
      <div class="sc-wrap bd-wrap">
        <div class="report-header">
          <div class="report-header-left">
            <span class="report-tag">BANANA CROP HEALTH</span>
            <span class="report-title-main">AI Leaf Disease Screening</span>
            <span class="report-timestamp">MobileNetV2 · TensorFlow · Local model API</span>
          </div>
          <div class="report-header-right">
            <button class="btn-secondary" id="bd-close">← BACK TO DASHBOARD</button>
          </div>
        </div>

        <div class="bd-layout">
          <div class="bd-card">
            <h3>Upload Banana Leaf Image</h3>
            <p>Choose a clear, well-lit photograph of a banana leaf.</p>

            <label class="bd-upload" for="bd-file">
              <span class="bd-upload-icon">↑</span>
              <strong id="bd-file-label">Choose leaf photograph</strong>
              <span>JPG, PNG or other supported image · Maximum 10 MB</span>
            </label>
            <input id="bd-file" type="file" accept="image/*" hidden>

            <img id="bd-preview" class="bd-preview hidden" alt="Selected banana leaf preview">

            <button id="bd-predict" class="btn-analyze" disabled>
              🍃 DETECT DISEASE
            </button>

            <p id="bd-status" class="bd-status" role="status" aria-live="polite">
              Select an image to begin.
            </p>
          </div>

          <div class="bd-card bd-results" id="bd-results" aria-live="polite">
            <div class="bd-empty">
              <div class="bd-empty-icon">◎</div>
              <h3>Awaiting Leaf Image</h3>
              <p>Your AI screening result will appear here.</p>
            </div>
          </div>
        </div>

        <p class="bd-disclaimer">
          IMPORTANT: This is an AI screening tool, not a definitive diagnosis.
          Confidence is not a guarantee of correctness. Confirm suspected disease
          with a qualified agricultural expert before taking treatment action.
        </p>
      </div>
    `;
    dashboard.appendChild(panel);

    const fileInput = panel.querySelector('#bd-file');
    const fileLabel = panel.querySelector('#bd-file-label');
    const preview = panel.querySelector('#bd-preview');
    const predictButton = panel.querySelector('#bd-predict');
    const status = panel.querySelector('#bd-status');
    const results = panel.querySelector('#bd-results');

    let previewUrl = null;

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      preview.removeAttribute('src');
      preview.classList.add('hidden');
      predictButton.disabled = true;

      if (!file) {
        fileLabel.textContent = 'Choose leaf photograph';
        status.textContent = 'Select an image to begin.';
        return;
      }

      if (!file.type.startsWith('image/')) {
        fileInput.value = '';
        fileLabel.textContent = 'Choose leaf photograph';
        status.textContent = 'Please select a valid image file.';
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        fileInput.value = '';
        fileLabel.textContent = 'Choose leaf photograph';
        status.textContent = 'Image must be smaller than 10 MB.';
        return;
      }

      fileLabel.textContent = file.name;
      previewUrl = URL.createObjectURL(file);
      preview.src = previewUrl;
      preview.classList.remove('hidden');
      predictButton.disabled = false;
      status.textContent = 'Image ready. Click Detect Disease to continue.';
    });

    predictButton.addEventListener('click', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      predictButton.disabled = true;
      status.textContent = 'Analysing leaf image…';
      results.innerHTML = `
        <div class="bd-empty">
          <div class="bd-spinner"></div>
          <h3>AI Screening in Progress</h3>
          <p>Processing the image. Please wait.</p>
        </div>
      `;

      try {
        const form = new FormData();
        form.append('image', file);

        const response = await fetch(API_URL, {
          method: 'POST',
          body: form
        });

        const data = await response.json();

        if (!response.ok || data.status !== 'success') {
          throw new Error(data.message || 'Prediction failed. Please try again.');
        }

        renderResult(results, data);
        status.textContent = 'Screening completed.';
      } catch (error) {
        results.innerHTML = `
          <div class="bd-empty bd-error">
            <h3>Screening Unavailable</h3>
            <p>${escapeHtml(error.message)}</p>
            <p>Check that both backend services are running, then retry.</p>
          </div>
        `;
        status.textContent = 'Unable to complete screening.';
      } finally {
        predictButton.disabled = !fileInput.files?.length;
      }
    });

    const close = () => {
      panel.classList.add('hidden');
      button.classList.remove('active');
    };

   button.addEventListener('click', () => {
  // Hide the regular soil dashboard
  const dashboardGrid = document.querySelector('.dashboard-grid');
  if (dashboardGrid) dashboardGrid.classList.add('hidden');

  // Hide the Supply Chain page if it is open
  document.getElementById('sc-view')?.classList.add('hidden');
  document.getElementById('sc-toggle')?.classList.remove('active');

  // Open Disease Detection as a separate full-page view
  panel.classList.remove('hidden');
  button.classList.add('active');
});

panel.querySelector('#bd-close').addEventListener('click', () => {
  panel.classList.add('hidden');
  button.classList.remove('active');

  // Restore the soil dashboard
  const dashboardGrid = document.querySelector('.dashboard-grid');
  if (dashboardGrid) dashboardGrid.classList.remove('hidden');
});

    panel.querySelector('#bd-close').addEventListener('click', close);
  }

  function renderResult(container, data) {
    const prediction = escapeHtml(data.prediction || 'Unknown');
    const confidence = Number(data.confidence_percent);
    const safeConfidence = Number.isFinite(confidence)
      ? Math.max(0, Math.min(100, confidence))
      : 0;

    const probabilities = Object.entries(data.probabilities || {})
      .map(([name, value]) => {
        const percent = Math.max(0, Math.min(100, Number(value) * 100 || 0));
        return `
          <div class="bd-probability">
            <div class="bd-probability-label">
              <span>${escapeHtml(name)}</span>
              <strong>${percent.toFixed(1)}%</strong>
            </div>
            <div class="bd-track">
              <div class="bd-track-fill" style="width:${percent}%"></div>
            </div>
          </div>
        `;
      }).join('');

    container.innerHTML = `
      <div class="bd-result-heading">
        <span class="report-tag">SCREENING RESULT</span>
        <span class="bd-result-confidence">${safeConfidence.toFixed(2)}% confidence</span>
      </div>
      <h2 class="bd-prediction">${prediction}</h2>
      <div class="bd-confidence-track">
        <div style="width:${safeConfidence}%"></div>
      </div>
      <h3>Class probabilities</h3>
      ${probabilities}
      <div class="bd-guidance">
        <h3>Suggested next step</h3>
        <p>${escapeHtml(data.guidance || 'Seek confirmation from an agricultural expert.')}</p>
      </div>
      <p class="bd-disclaimer-inline">
        ${escapeHtml(data.disclaimer || 'AI-generated screening result. Please verify suspected diseases with an agricultural expert before applying treatment.')}
      </p>
    `;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();