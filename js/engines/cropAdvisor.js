/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 - Live Crop Advisor
   ═══════════════════════════════════════════════════ */

const cropAdvisor = {
  recommendations: [],

  init() {
    if (!window.sensorStore) return;

    window.sensorStore.subscribeStore((store) => {
      this.recommendations = store.recommendations || [];
      this.render();
    });
  },

  getRecommendations() {
    return [...this.recommendations];
  },

  render(containerId = 'crop-advisor') {
    const container = document.getElementById(containerId) || document.getElementById('cropAdvisor');
    if (!container) return;

    container.innerHTML = this.recommendations.map(item => (
      `<div class="advisor-recommendation">${helpers.sanitise(item)}</div>`
    )).join('');
  },
};

window.cropAdvisor = cropAdvisor;

document.addEventListener('DOMContentLoaded', () => {
  cropAdvisor.init();
});
