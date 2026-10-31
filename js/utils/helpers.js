/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Utility Helpers
   ═══════════════════════════════════════════════════ */

const helpers = {

  /* ── Generate a session ID ── */
  generateSessionId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = 'KV-';
    for (let i = 0; i < 8; i++) {
      id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
  },

  /* ── Format timestamp ── */
  formatTimestamp(date = new Date()) {
    const d   = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const t   = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    return `${d}  ${t}`;
  },

  /* ── Clamp a number ── */
  clamp(val, min, max) {
    return Math.min(max, Math.max(min, val));
  },

  /* ── Normalize a value 0–100 ── */
  normalize(val, min, max) {
    return ((val - min) / (max - min)) * 100;
  },

  /* ── Round to n decimal places ── */
  round(val, n = 1) {
    return Math.round(val * Math.pow(10, n)) / Math.pow(10, n);
  },

  /* ── Determine CSS health class ── */
  healthClass(score) {
    if (score >= KV_CONSTANTS.HEALTH.EXCELLENT) return 'good';
    if (score >= KV_CONSTANTS.HEALTH.GOOD)      return 'good';
    if (score >= KV_CONSTANTS.HEALTH.MODERATE)  return 'moderate';
    return 'critical';
  },

  /* ── Health label ── */
  healthLabel(score) {
    if (score >= KV_CONSTANTS.HEALTH.EXCELLENT) return 'EXCELLENT';
    if (score >= KV_CONSTANTS.HEALTH.GOOD)      return 'HEALTHY';
    if (score >= KV_CONSTANTS.HEALTH.MODERATE)  return 'MODERATE';
    if (score >= KV_CONSTANTS.HEALTH.DEGRADED)  return 'DEGRADED';
    return 'CRITICAL';
  },

  /* ── Capitalise first letter ── */
  capitalise(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /* ── Slugify ── */
  slug(str) {
    return str.toLowerCase().replace(/\s+/g, '_');
  },

  /* ── Sleep (returns a Promise) ── */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /* ── Animate counter from 0 to target ── */
  animateCounter(element, target, duration = 900) {
    const start     = performance.now();
    const startVal  = 0;
    const update = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      element.textContent = Math.round(startVal + eased * (target - startVal));
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  },

  /* ── Sanitise a string for HTML injection ── */
  sanitise(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  /* ── Deep clone ── */
  clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /* ── Get a random item from array ── */
  randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

};
