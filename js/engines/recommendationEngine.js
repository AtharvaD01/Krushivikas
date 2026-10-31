/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 - Live Sensor Recommendation Engine
   ═══════════════════════════════════════════════════ */

const recommendationEngine = {
  thresholds: {
    soil: 2500,
    rain: 3000,
    ldr: 1800,
  },

  evaluate(sensorData = {}) {
    const recommendations = [];
    const { soil, rain, ldr } = sensorData;

    if (soil != null && soil < this.thresholds.soil) {
      recommendations.push('Watering required');
    }

    if (rain != null && rain > this.thresholds.rain) {
      recommendations.push('Rain detected. Stop irrigation');
    }

    if (ldr != null && ldr < this.thresholds.ldr) {
      recommendations.push('Low sunlight conditions');
    }

    if (recommendations.length === 0 && soil != null && rain != null && ldr != null) {
      recommendations.push('Sensor conditions are within normal range');
    }

    return recommendations;
  },
};

window.recommendationEngine = recommendationEngine;
