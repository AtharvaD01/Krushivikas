/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 - Live Analytics Chart
   ═══════════════════════════════════════════════════ */

const AnalyticsChart = {
  canvas: null,

  init(containerId = 'analytics-chart') {
    const container = document.getElementById(containerId) || document.getElementById('analyticsChart');
    if (!container || !window.sensorStore) return;

    this.canvas = container.tagName === 'CANVAS'
      ? container
      : container.querySelector('canvas');

    if (!this.canvas) return;

    window.sensorStore.subscribeStore((store) => this.render(store));
  },

  render(store) {
    if (!this.canvas) return;

    const ctx = this.canvas.getContext('2d');
    const width = this.canvas.width;
    const height = this.canvas.height;
    const padding = 18;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.font = '10px DM Mono, monospace';

    this.drawSeries(ctx, store.soilHistory || [], '#6ec97f', width, height, padding);
    this.drawSeries(ctx, store.rainHistory || [], '#58a6ff', width, height, padding);
    this.drawSeries(ctx, store.ldrHistory || [], '#f2c14e', width, height, padding);
  },

  drawSeries(ctx, values, color, width, height, padding) {
    if (!values.length) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const xStep = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;

    ctx.strokeStyle = color;
    ctx.beginPath();

    values.forEach((value, index) => {
      const x = padding + index * xStep;
      const y = height - padding - ((value - min) / span) * (height - padding * 2);

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  },
};

window.AnalyticsChart = AnalyticsChart;

document.addEventListener('DOMContentLoaded', () => {
  AnalyticsChart.init();
});
