/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Soil Analysis Engine
   Processes field inputs → soil model state
   ═══════════════════════════════════════════════════ */

const soilEngine = {

  /* ── Internal model state ── */
  model: {
    organic:   0,
    structure: 0,
    biology:   0,
    water:     0,
    fertility: 0,
    root:      0,
    aeration:  0,
    microbial: 0,
    ph:        7.0,
    nitrogen:  0,
    ec:        0,
  },

  /* ── Reset model to baseline ── */
  reset() {
    Object.keys(this.model).forEach(k => {
      this.model[k] = k === 'ph' ? 7.0 : 0;
    });
  },

  /* ── Apply sensor data to model ── */
  applySensorData(sensors) {
    // sensors may come from either the live sensor schema (soil/rain/ldr)
    // or legacy schemas (temperature/moisture/light/ph/nitrogen/ec).
    const { temperature, moisture, light, ph, nitrogen, ec, soil, rain, ldr } = sensors;

    // Prefer live sensor fields when available.
    const liveMoisture = soil !== undefined ? soil : moisture;
    const liveLight = ldr !== undefined ? ldr : light;


    if (ph !== undefined) {
      this.model.ph = ph;
      /* Optimal pH 6.0–7.5 benefits fertility */
      if (ph >= 6.0 && ph <= 7.5) {
        this.model.fertility += 2;
        this.model.microbial += 1;
      } else if (ph < 5.5 || ph > 8.0) {
        this.model.fertility -= 2;
      }
    }

    if (nitrogen !== undefined) {
      if (nitrogen > 100) {
        this.model.fertility += 2;
        this.model.organic   += 1;
      } else if (nitrogen < 40) {
        this.model.fertility -= 1;
      }
    }

    if (ec !== undefined) {
      if (ec >= 0.8 && ec <= 2.0) {
        this.model.fertility += 1;
      } else if (ec > 3.0) {
        this.model.fertility -= 2; /* Salt stress */
      }
    }

    if (liveMoisture !== undefined && liveMoisture !== null) {
      if (liveMoisture >= 2500 && liveMoisture <= 3600) {
        this.model.water    += 2;
        this.model.microbial += 1;
      } else if (liveMoisture < 2500) {
        this.model.water    -= 2;
      } else if (liveMoisture > 3800) {
        this.model.water    -= 1;
        this.model.aeration -= 1;
      }
    }

    if (rain !== undefined && rain !== null && rain > 3000) {
      this.model.water += 1;
      this.model.aeration -= 1;
    }

    if (liveLight !== undefined && liveLight !== null && liveLight < 1800) {
      this.model.biology -= 1;
    }

    // If we only have live sensors, we may still want water/rain influence.
    // Rain is handled above; liveMoisture is mapped from soil.


    if (temperature !== undefined) {
      if (temperature >= 18 && temperature <= 28) {
        this.model.biology  += 1;
        this.model.microbial += 1;
      } else if (temperature > 38) {
        this.model.biology  -= 1;
      } else if (temperature < 12) {
        this.model.biology  -= 1;
      }
    }
  },

  /* ── Apply a text-based observation ── */
  applyObservation(text) {
    const t = text.toLowerCase();

    /* Organic matter signals */
    if (t.includes('organic') || t.includes('compost') || t.includes('manure'))
      this.model.organic += 3;
    if (t.includes('legume') || t.includes('green manure'))
      this.model.organic += 2;
    if (t.includes('chemical') || t.includes('no organic'))
      this.model.organic -= 1;

    /* Biological signals */
    if (t.includes('many earthworm') || t.includes('earthworm'))
      this.model.biology += 3;
    if (t.includes('few earthworm'))
      this.model.biology += 1;
    if (t.includes('no earthworm') || t.includes('no visible'))
      this.model.biology -= 1;
    if (t.includes('microbial') || t.includes('active soil'))
      this.model.microbial += 2;

    /* Structure signals */
    if (t.includes('crumb') || t.includes('breaks easily') || t.includes('loose aggregate'))
      this.model.structure += 3;
    if (t.includes('compact') || t.includes('hard layer') || t.includes('hardpan'))
      this.model.structure -= 3;
    if (t.includes('moderate resistance'))
      this.model.structure += 1;
    if (t.includes('clay') || t.includes('sticky'))
      this.model.structure += 1;

    /* Water signals */
    if (t.includes('balanced') || t.includes('good infiltrat'))
      this.model.water += 3;
    if (t.includes('quickly') || t.includes('fast drain'))
      this.model.water -= 1;
    if (t.includes('stagnates') || t.includes('surface water') || t.includes('waterlog'))
      this.model.water -= 2;
    if (t.includes('slightly moist') || t.includes('moist and cool'))
      this.model.water += 2;
    if (t.includes('dry and powder'))
      this.model.water -= 2;

    /* Fertility / nutrient signals */
    if (t.includes('dark green') || t.includes('healthy leaf'))
      this.model.fertility += 3;
    if (t.includes('light green') || t.includes('mild deficiency'))
      this.model.fertility += 1;
    if (t.includes('yellow') || t.includes('stressed') || t.includes('chloros'))
      this.model.fertility -= 2;
    if (t.includes('dark black') || t.includes('high organic'))
      this.model.fertility += 2;

    /* Root signals */
    if (t.includes('deep root') || t.includes('roots grow deep'))
      this.model.root += 3;
    if (t.includes('restricted') || t.includes('shallow root'))
      this.model.root -= 3;
    if (t.includes('moderate') && t.includes('root'))
      this.model.root += 1;

    /* Aeration */
    if (t.includes('sandy') || t.includes('porous') || t.includes('gritty'))
      this.model.aeration += 2;
    if (t.includes('clay') || t.includes('waterlog'))
      this.model.aeration -= 1;
  },

  /* ── Apply slider/numeric inputs ── */
  applyNumericInputs(inputs) {
    const { moisture, temperature, ph, nitrogen, soil, rain, ldr } = inputs;

    // Fallback: if the UI provides legacy numeric fields, use them.
    // If manual numeric inputs are missing, allow live fields to influence the model.
    const liveSoil = soil !== undefined ? soil : moisture;
    const liveTemp = temperature;


    if (liveSoil !== undefined) {
      // Legacy moisture input is percent (40–65). Live soil is a raw value (2500–3600 range).
      if (liveSoil >= 40 && liveSoil <= 65) {
        this.model.water += 2;
      } else if (liveSoil < 25 || liveSoil < 2500) {
        this.model.water -= 2;
      } else if (liveSoil > 80 || liveSoil > 3800) {
        this.model.water -= 1;
      } else {
        // mid-range
        this.model.water += 1;
      }
    }


    if (ph !== undefined) {
      this.model.ph = ph;
      if (ph >= 6.0 && ph <= 7.5)           this.model.fertility += 2;
      else if (ph < 5.5 || ph > 8.0)        this.model.fertility -= 2;
    }

    if (nitrogen !== undefined) {
      if (nitrogen > 100)                   this.model.fertility += 2;
      else if (nitrogen < 40)               this.model.fertility -= 1;
    }
  },

  /* ── Compute overall health score (0–100) ── */
  calculateHealth() {
    const m = this.model;
    let score = 0;

    score += m.organic   * 2.5;
    score += m.structure * 2.5;
    score += m.biology   * 2.5;
    score += m.water     * 2.0;
    score += m.fertility * 2.5;
    score += m.root      * 1.5;
    score += m.microbial * 1.5;
    score += m.aeration  * 1.0;

    /* pH bonus */
    if (m.ph >= 6.0 && m.ph <= 7.5) score += 5;

    return helpers.clamp(Math.round(score), 0, 100);
  },

  /* ── Classify soil type from model state ── */
  classifySoil() {
    const m = this.model;

    if (m.organic >= 5 && m.structure >= 3 && m.water >= 3)
      return KV_CONSTANTS.SOIL_TYPES.LOAMY;

    if (m.structure >= 3 && m.water >= 2 && m.aeration < 1)
      return KV_CONSTANTS.SOIL_TYPES.CLAY;

    if (m.aeration >= 2 && m.water < 1)
      return KV_CONSTANTS.SOIL_TYPES.SANDY;

    if (m.fertility < 0 && m.water < 0)
      return KV_CONSTANTS.SOIL_TYPES.LATERITIC;

    if (m.water >= 2 && m.structure >= 2)
      return KV_CONSTANTS.SOIL_TYPES.ALLUVIAL;

    return KV_CONSTANTS.SOIL_TYPES.MIXED;
  },

  /* ── Get model snapshot for engines ── */
  getModel() {
    return helpers.clone(this.model);
  },

  /* ── Produce full soil profile ── */
  generateProfile() {
    return {
      healthScore: this.calculateHealth(),
      soilType:    this.classifySoil(),
      model:       this.getModel(),
    };
  },

};
