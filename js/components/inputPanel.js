/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Input Panel Component
   Renders the full field parameter form:
   sliders, dropdowns, button groups, text inputs
   with adaptive follow-up logic.
   ═══════════════════════════════════════════════════ */

const inputPanel = {

  /* ── Collected values ── */
  values: {},

  /* ── Field schema definition ── */
  fields: [

    /* ── Group 1: Basic Soil ── */
    {
      id: 'soilColor',
      label: 'SOIL COLOR',
      type: 'select',
      required: true,
      options: [
        { value: '',                                          label: '— Select observed color —' },
        { value: 'Dark black soil with high organic carbon', label: 'Dark Black (High Organic)' },
        { value: 'Reddish lateritic soil',                   label: 'Reddish / Lateritic' },
        { value: 'Grey alluvial soil with silty texture',    label: 'Grey / Alluvial' },
        { value: 'Light yellow sandy soil',                  label: 'Light Yellow / Sandy' },
        { value: 'Brown medium soil',                        label: 'Brown / Medium Organic' },
      ],
    },

    {
      id: 'soilTexture',
      label: 'SOIL TEXTURE (rub between fingers)',
      type: 'buttons',
      required: true,
      options: [
        { value: 'Sticky and smooth indicating clay dominant soil', label: 'Clay\n(Sticky/Smooth)' },
        { value: 'Soft and balanced indicating loamy soil',        label: 'Loam\n(Balanced)' },
        { value: 'Very gritty and loose indicating sandy soil',    label: 'Sandy\n(Gritty/Loose)' },
      ],
    },

    {
      id: 'compaction',
      label: 'COMPACTION (digging resistance)',
      type: 'buttons',
      required: true,
      options: [
        { value: 'Soil breaks easily into crumbs',   label: 'Loose\n(Crumbles)' },
        { value: 'Moderate resistance while digging',label: 'Moderate' },
        { value: 'Hard compact layer present',        label: 'Hard\n(Compacted)' },
      ],
    },

    {
      id: 'earthworms',
      label: 'BIOLOGICAL ACTIVITY',
      type: 'buttons',
      required: true,
      options: [
        { value: 'Many earthworms active in soil', label: 'Many\nEarthworms' },
        { value: 'Few earthworms observed',        label: 'Few\nEarthworms' },
        { value: 'No visible earthworms',          label: 'None\nVisible' },
      ],
    },

    /* ── Group 2: Water ── */
    {
      id: 'waterBehavior',
      label: 'WATER INFILTRATION (during irrigation)',
      type: 'buttons',
      required: true,
      options: [
        { value: 'Water infiltrates very quickly',          label: 'Very Fast' },
        { value: 'Water infiltration is balanced',         label: 'Balanced' },
        { value: 'Water remains on surface for long time', label: 'Slow/Ponds' },
      ],
    },

    {
      id: 'irrigationType',
      label: 'IRRIGATION TYPE',
      type: 'select',
      options: [
        { value: '',        label: '— Select —' },
        { value: 'drip',    label: 'Drip Irrigation' },
        { value: 'sprinkler', label: 'Sprinkler' },
        { value: 'flood',   label: 'Flood / Surface' },
        { value: 'rainfed', label: 'Rainfed Only' },
        { value: 'canal',   label: 'Canal Irrigation' },
      ],
    },

    /* ── Group 3: Crop Signals ── */
    {
      id: 'leafColor',
      label: 'CURRENT CROP LEAF COLOR',
      type: 'buttons',
      required: true,
      options: [
        { value: 'Dark green healthy leaves',               label: 'Dark Green\n(Healthy)' },
        { value: 'Light green leaves with mild deficiency', label: 'Light Green\n(Mild deficit)' },
        { value: 'Yellowing leaves with visible stress',    label: 'Yellow\n(Stressed)' },
      ],
    },

    {
      id: 'previousCrop',
      label: 'PREVIOUS CROP',
      type: 'select',
      options: [
        { value: '',              label: '— Select —' },
        { value: 'Legume crop previously grown',   label: 'Legume (Soybean / Chickpea)' },
        { value: 'Cereal crop previously grown',   label: 'Cereal (Wheat / Rice)' },
        { value: 'Same crop grown repeatedly',     label: 'Same Crop (Monoculture)' },
        { value: 'Fallow or no crop',              label: 'Fallow / Bare Field' },
        { value: 'Vegetable crop previously',      label: 'Vegetables' },
      ],
    },

    /* ── Group 4: Organic & Management ── */
    {
      id: 'organicInputs',
      label: 'ORGANIC INPUTS APPLIED',
      type: 'buttons',
      required: true,
      options: [
        { value: 'Regular compost or farmyard manure applied', label: 'Regular\nCompost/FYM' },
        { value: 'Occasional organic inputs',                  label: 'Occasional' },
        { value: 'Mostly chemical fertilizers used',           label: 'Chemical\nOnly' },
      ],
    },

    /* ── Group 5: Crop History (text) ── */
    {
      id: 'cropHistory',
      label: 'CROP HISTORY & FIELD NOTES (optional)',
      type: 'textarea',
      placeholder: 'E.g. Field had waterlogging last season. Applied gypsum 2 years ago. Previous yield 4 tonnes/ha wheat...',
    },

  ],

  /* ── Adaptive follow-up fields (shown conditionally) ── */
  adaptiveFields: {

    /* If compaction is hard, show depth question */
    compaction: {
      trigger: 'Hard compact layer present',
      field: {
        id: 'compactionDepth',
        label: 'COMPACTION DEPTH',
        type: 'buttons',
        options: [
          { value: 'surface compaction 0-10cm',   label: 'Surface\n(0–10 cm)' },
          { value: 'mid-depth compaction 10-30cm', label: 'Mid-depth\n(10–30 cm)' },
          { value: 'hardpan below 30cm',           label: 'Hardpan\n(>30 cm)' },
        ],
      },
    },

    /* If water ponds, show drainage type */
    waterBehavior: {
      trigger: 'Water remains on surface for long time',
      field: {
        id: 'drainageType',
        label: 'DRAINAGE CONDITION',
        type: 'buttons',
        options: [
          { value: 'poor drainage flat land',  label: 'Flat / Poor\nDrainage' },
          { value: 'slope runoff problem',     label: 'Slope /\nRunoff' },
          { value: 'clay hardpan drainage',    label: 'Clay Pan\nBlock' },
        ],
      },
    },

    /* If soil is yellow/stressed, show history */
    leafColor: {
      trigger: 'Yellowing leaves with visible stress',
      field: {
        id: 'stressHistory',
        label: 'STRESS HISTORY',
        type: 'select',
        options: [
          { value: '',                              label: '— Select —' },
          { value: 'repeated for multiple seasons', label: 'Recurring multiple seasons' },
          { value: 'started this season',           label: 'Started this season' },
          { value: 'after heavy rains',             label: 'After heavy rains' },
          { value: 'after fertiliser application',  label: 'After fertiliser application' },
        ],
      },
    },

  },

  /* ── Render the full form ── */
  render(containerId = 'input-form') {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = this.fields.map(f => this._renderField(f)).join('');

    /* Attach event listeners */
    this._attachListeners(container);
  },

  /* ── Render a single field ── */
  _renderField(field) {
    const renderers = {
      select:   () => this._renderSelect(field),
      buttons:  () => this._renderButtons(field),
      slider:   () => this._renderSlider(field),
      textarea: () => this._renderTextarea(field),
      input:    () => this._renderInput(field),
    };
    const fn = renderers[field.type] || renderers.input;
    return `
      <div class="form-group" id="fg-${field.id}" data-field="${field.id}">
        ${fn()}
      </div>
    `;
  },

  _renderSelect(f) {
    const opts = f.options.map(o =>
      `<option value="${helpers.sanitise(o.value)}">${helpers.sanitise(o.label)}</option>`
    ).join('');
    return `
      <label class="form-label">${f.label}</label>
      <select class="form-select" id="f-${f.id}" data-id="${f.id}">
        ${opts}
      </select>
    `;
  },

  _renderButtons(f) {
    const cols = f.options.length === 2 ? '1fr 1fr' : f.options.length === 3 ? '1fr 1fr 1fr' : '1fr 1fr';
    const btns = f.options.map(o => `
      <button
        class="form-btn-option"
        data-id="${f.id}"
        data-value="${helpers.sanitise(o.value)}"
        type="button"
      >${o.label.replace(/\n/g, '<br/>')}</button>
    `).join('');
    return `
      <label class="form-label">${f.label}</label>
      <div class="form-btn-group" style="grid-template-columns:${cols}">
        ${btns}
      </div>
    `;
  },

  _renderSlider(f) {
    const val = f.default !== undefined ? f.default : Math.round((f.min + f.max) / 2);
    return `
      <label class="form-label">
        ${f.label}
        <span class="form-label-value" id="fv-${f.id}">${val}${f.unit || ''}</span>
      </label>
      <div class="form-slider-wrap">
        <input
          type="range"
          class="form-slider"
          id="f-${f.id}"
          data-id="${f.id}"
          min="${f.min}" max="${f.max}" value="${val}"
          step="${f.step || 1}"
        />
      </div>
    `;
  },

  _renderTextarea(f) {
    return `
      <label class="form-label">${f.label}</label>
      <textarea
        class="form-textarea"
        id="f-${f.id}"
        data-id="${f.id}"
        placeholder="${f.placeholder || ''}"
        rows="3"
      ></textarea>
    `;
  },

  _renderInput(f) {
    return `
      <label class="form-label">${f.label}</label>
      <input
        type="text"
        class="form-input"
        id="f-${f.id}"
        data-id="${f.id}"
        placeholder="${f.placeholder || ''}"
      />
    `;
  },

  /* ── Attach all event listeners ── */
  _attachListeners(container) {

    /* Select changes */
    container.querySelectorAll('.form-select').forEach(el => {
      el.addEventListener('change', e => {
        const id = e.target.dataset.id;
        this.values[id] = e.target.value;
        this._checkAdaptive(id, e.target.value);
        this._updateProgress();
        this._updateAnalyzeButton();
      });
    });

    /* Button group clicks */
    container.querySelectorAll('.form-btn-option').forEach(btn => {
      btn.addEventListener('click', e => {
        const id = e.currentTarget.dataset.id;
        const val = e.currentTarget.dataset.value;

        /* Deselect siblings */
        container.querySelectorAll(`.form-btn-option[data-id="${id}"]`).forEach(b => {
          b.classList.remove('selected');
        });

        e.currentTarget.classList.add('selected');
        this.values[id] = val;
        this._checkAdaptive(id, val);
        this._updateProgress();
        this._updateAnalyzeButton();
      });
    });

    /* Sliders */
    container.querySelectorAll('.form-slider').forEach(el => {
      el.addEventListener('input', e => {
        const id  = e.target.dataset.id;
        const val = parseFloat(e.target.value);
        this.values[id] = val;
        const display = document.getElementById(`fv-${id}`);
        if (display) {
          const cfg = this.fields.find(f => f.id === id);
          display.textContent = val + (cfg && cfg.unit ? cfg.unit : '');
        }
        this._updateProgress();
        this._updateAnalyzeButton();
      });
    });

    /* Textareas and inputs */
    container.querySelectorAll('.form-textarea, .form-input').forEach(el => {
      el.addEventListener('input', e => {
        this.values[e.target.dataset.id] = e.target.value;
        this._updateProgress();
        this._updateAnalyzeButton();
      });
    });
  },

  /* ── Check if adaptive field should appear ── */
  _checkAdaptive(fieldId, value) {
    const adaptive = this.adaptiveFields[fieldId];
    if (!adaptive) return;

    const existingId = `fg-adaptive-${fieldId}`;
    const existing   = document.getElementById(existingId);

    if (value === adaptive.trigger) {
      /* Show adaptive field if not already shown */
      if (!existing) {
        const parentGroup = document.getElementById(`fg-${fieldId}`);
        if (!parentGroup) return;

        const div = document.createElement('div');
        div.className = 'form-group';
        div.id = existingId;
        div.setAttribute('data-field', adaptive.field.id);
        div.innerHTML = (() => {
          const f = adaptive.field;
          if (f.type === 'buttons')  return this._renderButtons(f);
          if (f.type === 'select')   return this._renderSelect(f);
          return this._renderInput(f);
        })();

        parentGroup.insertAdjacentElement('afterend', div);

        /* Attach listeners to new field */
        this._attachListeners(div);

        /* Animate in */
        div.style.opacity = '0';
        div.style.transform = 'translateY(-10px)';
        div.style.transition = 'all .3s ease';
        requestAnimationFrame(() => {
          div.style.opacity = '1';
          div.style.transform = 'none';
        });
      }
    } else {
      /* Remove adaptive field if trigger no longer active */
      if (existing) {
        existing.remove();
        delete this.values[adaptive.field.id];
      }
    }
  },

  /* ── Update progress bar and badge ── */
  _updateProgress() {
    const required = this.fields.filter(f => f.required).map(f => f.id);
    const filled   = required.filter(id => this.values[id] && String(this.values[id]).trim() !== '');
    const pct      = Math.round((filled.length / required.length) * 100);

    const bar   = document.getElementById('field-progress-bar');
    const badge = document.getElementById('input-progress-badge');

    if (bar)   bar.style.width = pct + '%';
    if (badge) badge.textContent = filled.length + '/' + required.length;
  },

  /* ── Enable/disable analyze button ── */
  _updateAnalyzeButton() {
    const required = this.fields.filter(f => f.required).map(f => f.id);
    const allFilled = required.every(id => this.values[id] && String(this.values[id]).trim() !== '');
    const btn = document.getElementById('run-analysis-btn');
    if (btn) btn.disabled = !allFilled;
  },

  /* ── Get all collected values ── */
  getValues() {
    return helpers.clone(this.values);
  },

  /* ── Reset form ── */
  reset() {
    this.values = {};
    this.render();
    this._updateProgress();
    this._updateAnalyzeButton();
  },

};
