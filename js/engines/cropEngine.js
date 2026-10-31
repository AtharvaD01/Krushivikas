/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Crop Recommendation Engine
   ═══════════════════════════════════════════════════ */

const cropEngine = {

  /* ── Full crop database ── */
  database: {

    [KV_CONSTANTS.SOIL_TYPES.LOAMY]: [
      { crop: 'Wheat',    season: 'rabi',   water: 'moderate', nutrient: 'medium', score: 92 },
      { crop: 'Maize',    season: 'kharif', water: 'moderate', nutrient: 'medium', score: 90 },
      { crop: 'Soybean',  season: 'kharif', water: 'moderate', nutrient: 'medium', score: 88 },
      { crop: 'Tomato',   season: 'all',    water: 'moderate', nutrient: 'high',   score: 85 },
      { crop: 'Potato',   season: 'rabi',   water: 'moderate', nutrient: 'high',   score: 84 },
      { crop: 'Chickpea', season: 'rabi',   water: 'low',      nutrient: 'low',    score: 82 },
      { crop: 'Onion',    season: 'rabi',   water: 'moderate', nutrient: 'medium', score: 80 },
    ],

    [KV_CONSTANTS.SOIL_TYPES.CLAY]: [
      { crop: 'Rice',      season: 'kharif', water: 'high',     nutrient: 'medium', score: 92 },
      { crop: 'Cotton',    season: 'kharif', water: 'moderate', nutrient: 'medium', score: 88 },
      { crop: 'Soybean',   season: 'kharif', water: 'moderate', nutrient: 'medium', score: 84 },
      { crop: 'Sugarcane', season: 'all',    water: 'high',     nutrient: 'high',   score: 80 },
    ],

    [KV_CONSTANTS.SOIL_TYPES.SANDY]: [
      { crop: 'Groundnut',    season: 'kharif', water: 'low',      nutrient: 'low',    score: 90 },
      { crop: 'Pearl Millet', season: 'kharif', water: 'low',      nutrient: 'low',    score: 88 },
      { crop: 'Watermelon',   season: 'summer', water: 'moderate', nutrient: 'medium', score: 84 },
      { crop: 'Cassava',      season: 'all',    water: 'low',      nutrient: 'low',    score: 80 },
    ],

    [KV_CONSTANTS.SOIL_TYPES.LATERITIC]: [
      { crop: 'Cashew',       season: 'all',    water: 'low',      nutrient: 'low',    score: 86 },
      { crop: 'Pineapple',    season: 'all',    water: 'moderate', nutrient: 'low',    score: 82 },
      { crop: 'Pearl Millet', season: 'kharif', water: 'low',      nutrient: 'low',    score: 78 },
      { crop: 'Cowpea',       season: 'kharif', water: 'low',      nutrient: 'low',    score: 76 },
    ],

    [KV_CONSTANTS.SOIL_TYPES.ALLUVIAL]: [
      { crop: 'Rice',       season: 'kharif', water: 'high',     nutrient: 'medium', score: 94 },
      { crop: 'Sugarcane',  season: 'all',    water: 'high',     nutrient: 'high',   score: 90 },
      { crop: 'Wheat',      season: 'rabi',   water: 'moderate', nutrient: 'medium', score: 88 },
      { crop: 'Vegetables', season: 'all',    water: 'moderate', nutrient: 'high',   score: 86 },
      { crop: 'Jute',       season: 'kharif', water: 'high',     nutrient: 'medium', score: 82 },
    ],

    [KV_CONSTANTS.SOIL_TYPES.MIXED]: [
      { crop: 'Sorghum',   season: 'kharif', water: 'low',  nutrient: 'low',  score: 80 },
      { crop: 'Barley',    season: 'rabi',   water: 'low',  nutrient: 'low',  score: 78 },
      { crop: 'Sunflower', season: 'rabi',   water: 'low',  nutrient: 'low',  score: 76 },
    ],

  },

  /* ── Filter crops for this soil type ── */
  getCrops(soilType) {
    return this.database[soilType] || this.database[KV_CONSTANTS.SOIL_TYPES.MIXED];
  },

  /* ── Adapt list based on health score ── */
  adaptToHealth(crops, healthScore) {
    if (healthScore >= 70) return crops;
    if (healthScore >= 45) return crops.slice(0, 4);
    return crops.slice(0, 2);
  },

  /* ── Filter by water stress ── */
  filterByWater(crops, model) {
    if (model.water < 0) {
      return crops.filter(c => c.water === 'low' || c.water === 'moderate');
    }
    return crops;
  },

  /* ── Filter by fertility ── */
  filterByFertility(crops, model) {
    if (model.fertility < 0) {
      return crops.filter(c => c.nutrient === 'low' || c.nutrient === 'medium');
    }
    return crops;
  },

  /* ── Build seasonal calendar ── */
  buildSeasonalCalendar(soilType) {
    const crops = this.getCrops(soilType);
    const calendar = { kharif: [], rabi: [], summer: [], all: [] };
    crops.forEach(c => {
      if (calendar[c.season]) calendar[c.season].push(c.crop);
    });
    return calendar;
  },

  /* ── Get top N recommended crops ── */
  getTopRecommended(soilType, healthScore, model, n = 5) {
    let crops = this.getCrops(soilType);
    crops     = this.adaptToHealth(crops, healthScore);
    crops     = this.filterByWater(crops, model);
    crops     = this.filterByFertility(crops, model);
    return crops.slice(0, n).map(c => c.crop);
  },

  /* ── Full crop report ── */
  buildReport(soilType, healthScore, model) {
    return {
      recommended:      this.getTopRecommended(soilType, healthScore, model),
      seasonalCalendar: this.buildSeasonalCalendar(soilType),
      allCrops:         this.getCrops(soilType),
    };
  },

};
