/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Risk Detection Engine
   Identifies soil health risks from model state
   ═══════════════════════════════════════════════════ */

const riskEngine = {

  /* ── Evaluate all risk dimensions ── */
  evaluate(model, sensors) {
    const risks = [];

    this._checkCompaction(model, risks);
    this._checkMoisture(model, risks, sensors);
    this._checkBiology(model, risks, sensors);
    this._checkOrganic(model, risks);
    this._checkFertility(model, risks);
    this._checkPH(model, risks);
    this._checkSalinity(model, risks, sensors);

    return risks;
  },

  /* ── Compaction risk ── */
  _checkCompaction(model, risks) {
    if (model.structure <= -2) {
      risks.push({
        id: 'severe_compaction', severity: KV_CONSTANTS.SEVERITY.HIGH,
        title: 'Severe Soil Compaction',
        message: 'Root penetration severely limited. Subsoil plow or deep ripping required immediately.',
      });
    } else if (model.structure < 0) {
      risks.push({
        id: 'moderate_compaction', severity: KV_CONSTANTS.SEVERITY.MODERATE,
        title: 'Moderate Soil Compaction',
        message: 'Surface compaction restricting aeration and water infiltration.',
      });
    }
  },

  /* ── Moisture / water stress ── */
  _checkMoisture(model, risks, sensors) {
    const sensorMoist = sensors && sensors.soil;

    if (model.water <= -2 || (sensorMoist && sensorMoist < 2500)) {
      risks.push({
        id: 'water_stress', severity: KV_CONSTANTS.SEVERITY.HIGH,
        title: 'Critical Water Stress',
        message: 'Severe moisture deficiency detected. Immediate irrigation and mulching required.',
      });
    } else if (model.water < 0 || (sensorMoist && sensorMoist < 2800)) {
      risks.push({
        id: 'low_moisture', severity: KV_CONSTANTS.SEVERITY.MODERATE,
        title: 'Low Soil Moisture',
        message: 'Below-optimal moisture availability affecting plant uptake.',
      });
    } else if (sensorMoist && sensorMoist > 3800) {
      risks.push({
        id: 'waterlogging', severity: KV_CONSTANTS.SEVERITY.MODERATE,
        title: 'Waterlogging Risk',
        message: 'Excess soil moisture may cause anaerobic conditions and root diseases.',
      });
    }

    if (sensors && sensors.rain != null && sensors.rain > 3000) {
      risks.push({
        id: 'rain_detected', severity: KV_CONSTANTS.SEVERITY.MODERATE,
        title: 'Rain Detected',
        message: 'Rain detected. Stop irrigation until conditions clear.',
      });
    }
  },

  /* ── Biological activity ── */
  _checkBiology(model, risks, sensors) {
    if (model.biology < -1) {
      risks.push({
        id: 'low_biology', severity: KV_CONSTANTS.SEVERITY.HIGH,
        title: 'Low Biological Activity',
        message: 'Insufficient earthworm and microbial populations. Organic inputs and inoculants needed.',
      });
    } else if (model.biology < 1 && model.microbial < 1) {
      risks.push({
        id: 'moderate_biology', severity: KV_CONSTANTS.SEVERITY.MODERATE,
        title: 'Reduced Microbial Activity',
        message: 'Below-optimal soil biology affecting nutrient cycling and organic matter breakdown.',
      });
    }

    if (sensors && sensors.ldr != null && sensors.ldr < 1800) {
      risks.push({
        id: 'low_sunlight', severity: KV_CONSTANTS.SEVERITY.LOW,
        title: 'Low Sunlight Conditions',
        message: 'Low sunlight conditions detected. Monitor crop growth and irrigation timing.',
      });
    }
  },

  /* ── Organic matter ── */
  _checkOrganic(model, risks) {
    if (model.organic < -1) {
      risks.push({
        id: 'organic_deficiency', severity: KV_CONSTANTS.SEVERITY.HIGH,
        title: 'Organic Carbon Deficiency',
        message: 'Very low organic matter. Soil structure, fertility and water-holding capacity all compromised.',
      });
    } else if (model.organic < 1) {
      risks.push({
        id: 'low_organic', severity: KV_CONSTANTS.SEVERITY.MODERATE,
        title: 'Low Organic Matter',
        message: 'Insufficient organic carbon for sustained soil fertility. Regular compost application needed.',
      });
    }
  },

  /* ── Fertility ── */
  _checkFertility(model, risks) {
    if (model.fertility < -2) {
      risks.push({
        id: 'critical_fertility', severity: KV_CONSTANTS.SEVERITY.HIGH,
        title: 'Critical Nutrient Deficiency',
        message: 'Multiple nutrient deficiencies visible in crop. Soil test and targeted fertilisation required.',
      });
    } else if (model.fertility < 0) {
      risks.push({
        id: 'low_fertility', severity: KV_CONSTANTS.SEVERITY.MODERATE,
        title: 'Below-Optimal Fertility',
        message: 'Nutrient availability is limited. Balanced NPK application and organic inputs recommended.',
      });
    }
  },

  /* ── pH risk ── */
  _checkPH(model, risks) {
    // PH risk is only meaningful when model.ph has been set by manual diagnostics.
    // With live-only schema, model.ph may remain the default, so avoid pushing PH-related risks.
    const ph = model.ph;
    if (ph == null || ph === 7.0) return;

    if (ph < 5.5) {
      risks.push({
        id: 'acidic_soil', severity: KV_CONSTANTS.SEVERITY.HIGH,
        title: 'Acidic Soil (pH ' + ph.toFixed(1) + ')',
        message: 'High acidity causing aluminium/manganese toxicity. Lime application required to raise pH.',
      });
    } else if (ph > 8.2) {
      risks.push({
        id: 'alkaline_soil', severity: KV_CONSTANTS.SEVERITY.MODERATE,
        title: 'Alkaline Soil (pH ' + ph.toFixed(1) + ')',
        message: 'High alkalinity limiting micronutrient availability (Fe, Mn, Zn). Sulphur or acidifying inputs needed.',
      });
    }
  },

  /* ── Salinity (EC) ── */
  _checkSalinity(model, risks, sensors) {
    // EC-based salinity is not evaluated in the current implementation.
    return;
  },


  /* ── Summarise risk level ── */
  summarise(risks) {
    const highCount     = risks.filter(r => r.severity === KV_CONSTANTS.SEVERITY.HIGH).length;
    const moderateCount = risks.filter(r => r.severity === KV_CONSTANTS.SEVERITY.MODERATE).length;

    if (risks.length === 0)
      return { level: 'low',      label: 'NO MAJOR RISKS',   summary: 'Soil health indicators are within acceptable ranges.' };
    if (highCount > 2)
      return { level: 'critical', label: 'CRITICAL',         summary: 'Multiple severe soil health risks require immediate intervention.' };
    if (highCount > 0)
      return { level: 'high',     label: 'HIGH RISK',        summary: 'Significant soil risks detected that will impact crop yield.' };
    if (moderateCount > 0)
      return { level: 'moderate', label: 'MODERATE RISK',    summary: 'Moderate soil health issues present. Proactive management recommended.' };
    return   { level: 'low',      label: 'LOW RISK',         summary: 'Minor soil indicators to monitor. No immediate action required.' };
  },

  /* ── Build full risk report ── */
  buildReport(model, sensors) {
    const risks   = this.evaluate(model, sensors);
    const summary = this.summarise(risks);
    return { summary, risks };
  },

};
