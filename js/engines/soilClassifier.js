/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Soil Classifier
   Converts raw inputs → soil classification report
   ═══════════════════════════════════════════════════ */

const soilClassifier = {

  /* ── Soil type display names ── */
  typeLabels: {
    [KV_CONSTANTS.SOIL_TYPES.LOAMY]:     'Loamy Agricultural',
    [KV_CONSTANTS.SOIL_TYPES.CLAY]:      'Clay Dominant',
    [KV_CONSTANTS.SOIL_TYPES.SANDY]:     'Sandy Porous',
    [KV_CONSTANTS.SOIL_TYPES.LATERITIC]: 'Lateritic / Red',
    [KV_CONSTANTS.SOIL_TYPES.ALLUVIAL]:  'Alluvial Silty',
    [KV_CONSTANTS.SOIL_TYPES.MIXED]:     'Mixed Transitional',
  },

  /* ── Soil type descriptions ── */
  typeDescriptions: {
    [KV_CONSTANTS.SOIL_TYPES.LOAMY]:
      'Well-balanced soil with good structure, high organic content and excellent water-nutrient retention. Ideal for most crops.',
    [KV_CONSTANTS.SOIL_TYPES.CLAY]:
      'Fine-textured, high water-retention soil with limited aeration. Needs drainage management but holds nutrients well.',
    [KV_CONSTANTS.SOIL_TYPES.SANDY]:
      'Coarse, free-draining soil with low water and nutrient retention. Requires frequent irrigation and organic inputs.',
    [KV_CONSTANTS.SOIL_TYPES.LATERITIC]:
      'Iron-rich, acidic soil with low fertility. Requires pH correction and intensive organic amendments.',
    [KV_CONSTANTS.SOIL_TYPES.ALLUVIAL]:
      'Deposited river soil with moderate to high fertility and mixed texture. Generally productive with proper management.',
    [KV_CONSTANTS.SOIL_TYPES.MIXED]:
      'Transitional soil with variable properties. Management depends on the dominant fraction identified.',
  },

  /* ── Texture model from input ── */
  textureModel(texture) {
    const t = (texture || '').toLowerCase();

    if (t.includes('clay') || t.includes('sticky'))
      return { texture: 'clay', waterRetention: 0.85, aeration: 0.35, nutrientHolding: 0.80 };

    if (t.includes('loam') || t.includes('balanced') || t.includes('soft'))
      return { texture: 'loam', waterRetention: 0.70, aeration: 0.70, nutrientHolding: 0.75 };

    if (t.includes('sand') || t.includes('gritty') || t.includes('loose'))
      return { texture: 'sand', waterRetention: 0.30, aeration: 0.88, nutrientHolding: 0.30 };

    return { texture: 'mixed', waterRetention: 0.55, aeration: 0.55, nutrientHolding: 0.55 };
  },

  /* ── Biological index (0–1) ── */
  biologicalIndex(wormObs) {
    const w = (wormObs || '').toLowerCase();
    if (w.includes('many'))   return 0.92;
    if (w.includes('few'))    return 0.52;
    if (w.includes('no') || w.includes('none')) return 0.10;
    return 0.35;
  },

  /* ── Water model from observation ── */
  waterModel(infiltration) {
    const i = (infiltration || '').toLowerCase();

    if (i.includes('balanced') || i.includes('good'))
      return { infiltration: 0.75, runoff: 0.18, drainage: 0.72 };

    if (i.includes('quick') || i.includes('fast'))
      return { infiltration: 0.90, runoff: 0.05, drainage: 0.88 };

    if (i.includes('stagnate') || i.includes('surface') || i.includes('waterlog'))
      return { infiltration: 0.20, runoff: 0.72, drainage: 0.28 };

    return { infiltration: 0.52, runoff: 0.38, drainage: 0.50 };
  },

  /* ── Nutrient potential from crop colour ── */
  nutrientPotential(cropColor) {
    const c = (cropColor || '').toLowerCase();

    if (c.includes('dark green') || c.includes('healthy'))
      return { nitrogen: 0.85, phosphorus: 0.78, potassium: 0.82 };

    if (c.includes('light green') || c.includes('mild'))
      return { nitrogen: 0.52, phosphorus: 0.55, potassium: 0.58 };

    if (c.includes('yellow') || c.includes('stressed') || c.includes('pale'))
      return { nitrogen: 0.22, phosphorus: 0.28, potassium: 0.32 };

    return { nitrogen: 0.48, phosphorus: 0.48, potassium: 0.48 };
  },

  /* ── Compute composite soil quality score ── */
  calculateCompositeScore(texture, bioIdx, water, nutrients) {
    const t = this.textureModel(texture);
    const w = this.waterModel(water);
    const n = this.nutrientPotential(nutrients);

    return helpers.round(
      (t.waterRetention  * 18) +
      (t.aeration        * 12) +
      (t.nutrientHolding * 18) +
      (bioIdx            * 22) +
      (w.infiltration    * 10) +
      (n.nitrogen        * 20), 1
    );
  },

  /* ── Derive confidence from input completeness ── */
  deriveConfidence(inputs) {
    const present = Object.values(inputs).filter(v => v && String(v).trim().length > 0).length;
    const total   = Object.keys(inputs).length;
    const base    = (present / total) * 0.65 + 0.28;
    return helpers.round(helpers.clamp(base, 0.40, 0.97), 2);
  },

  /* ── Crop suitability by soil type ── */
  cropSuitability(soilType) {
    const map = {
      [KV_CONSTANTS.SOIL_TYPES.LOAMY]:
        ['Wheat', 'Maize', 'Soybean', 'Tomato', 'Potato', 'Onion', 'Chickpea'],
      [KV_CONSTANTS.SOIL_TYPES.CLAY]:
        ['Rice', 'Cotton', 'Soybean', 'Sugarcane'],
      [KV_CONSTANTS.SOIL_TYPES.SANDY]:
        ['Groundnut', 'Pearl Millet', 'Watermelon', 'Cassava'],
      [KV_CONSTANTS.SOIL_TYPES.LATERITIC]:
        ['Cashew', 'Pineapple', 'Pearl Millet', 'Cowpea'],
      [KV_CONSTANTS.SOIL_TYPES.ALLUVIAL]:
        ['Rice', 'Sugarcane', 'Wheat', 'Vegetables', 'Jute'],
      [KV_CONSTANTS.SOIL_TYPES.MIXED]:
        ['Sorghum', 'Barley', 'Sunflower'],
    };
    return map[soilType] || map[KV_CONSTANTS.SOIL_TYPES.MIXED];
  },

  /* ── Build full classification report ── */
  buildReport(inputs, soilType) {
    const bioIdx     = this.biologicalIndex(inputs.earthworms);
    const composite  = this.calculateCompositeScore(
      inputs.soilTexture, bioIdx, inputs.waterBehavior, inputs.leafColor
    );
    const confidence = this.deriveConfidence(inputs);

    return {
      soilType,
      soilLabel:       this.typeLabels[soilType]        || 'Unknown',
      soilDescription: this.typeDescriptions[soilType]  || '',
      compositeScore:  composite,
      confidence,
      confidencePct:   Math.round(confidence * 100),
      recommendedCrops: this.cropSuitability(soilType),
      textureProfile:  this.textureModel(inputs.soilTexture),
      waterProfile:    this.waterModel(inputs.waterBehavior),
      nutrients:       this.nutrientPotential(inputs.leafColor),
    };
  },

};
