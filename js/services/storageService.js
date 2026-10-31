/* ═══════════════════════════════════════════════════
   KRUSHIVIKAS v2.0 — Storage Service
   Manages diagnostic archive in localStorage
   ═══════════════════════════════════════════════════ */

const storageService = {

  key: KV_CONSTANTS.STORAGE_KEY,

  /* ── Load all records ── */
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[KV Storage] Load failed:', e);
      return [];
    }
  },

  /* ── Save a diagnostic record ── */
  save(record) {
    try {
      const records = this.load();

      records.push({
        id:        record.sessionId || helpers.generateSessionId(),
        timestamp: Date.now(),
        date:      helpers.formatTimestamp(),
        ...record,
      });

      /* Enforce archive limit */
      const trimmed = records.slice(-KV_CONSTANTS.ARCHIVE_LIMIT);
      localStorage.setItem(this.key, JSON.stringify(trimmed));
      return true;
    } catch (e) {
      console.warn('[KV Storage] Save failed:', e);
      return false;
    }
  },

  /* ── Get latest record ── */
  latest() {
    const records = this.load();
    return records.length > 0 ? records[records.length - 1] : null;
  },

  /* ── Get last N records (newest first) ── */
  recent(n = 10) {
    return this.load().slice().reverse().slice(0, n);
  },

  /* ── Clear archive ── */
  clear() {
    localStorage.removeItem(this.key);
  },

  /* ── Count records ── */
  count() {
    return this.load().length;
  },

};
