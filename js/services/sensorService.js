/* sensorService (compat) - uses firebase compat global `firebaseDB`
   Exposes window.sensorService.subscribeSensorData(cb) */
(function (global) {
  const listeners = new Set();
  let current = { soil: null, rain: null, ldr: null };
  let started = false;

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function start() {
    if (started) return;
    const db = global.firebaseDB || global.kv_db;

    if (!db) {
      console.error('[sensorService] Firebase Realtime Database is not available.');
      return;
    }

    started = true;
    const latestRef = db.ref('latest');

    latestRef.on('value', (snapshot) => {
      const val = snapshot.val();
      if (!val) {
        console.warn('[sensorService] No data found at latest/.');
        return;
      }

      const data = {
        soil: toNumber(val.soil),
        rain: toNumber(val.rain),
        ldr:  toNumber(val.ldr),
      };

      current = data;
      listeners.forEach(cb => { try { cb(data); } catch (e) { console.error('sensorService callback error', e); } });
    }, (error) => {
      console.error('[sensorService] Firebase latest/ listener error:', error);
    });
  }

  // Try to start immediately; if Firebase is still loading, poll until available.
  let attempts = 0;
  const tryStart = () => {
    if (global.firebaseDB || global.kv_db) return start();
    attempts += 1;
    if (attempts > 20) {
      console.error('[sensorService] Firebase DB not available after waiting.');
      return;
    }
    setTimeout(tryStart, 500);
  };
  tryStart();

  function subscribeSensorData(cb) {
    if (typeof cb !== 'function') throw new Error('callback required');
    listeners.add(cb);
    // emit current immediately
    try { cb(current); } catch (e) { console.error(e); }
    return () => listeners.delete(cb);
  }

  function getCurrentSensorData() { return { ...current }; }

  global.sensorService = { subscribeSensorData, getCurrentSensorData };
})(window);
