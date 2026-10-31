(function (global) {
  const state = { soil: null, rain: null, ldr: null };
  const history = { soil: [], rain: [], ldr: [] };
  const subs = new Set();
  const maxHistory = 20;

  const thresholds = {
    soil: 2500,
    rain: 3000,
    ldr: 1800,
  };

  function notify() {
    const snapshot = getStore();
    subs.forEach(cb => { try { cb(snapshot); } catch (e) { console.error(e); } });
  }

  function pushHistory(data) {
    ['soil', 'rain', 'ldr'].forEach(key => {
      if (data[key] == null) return;
      history[key].push(data[key]);
      if (history[key].length > maxHistory) history[key].shift();
    });
  }

  function buildRecommendations(data = state) {
    if (global.recommendationEngine) {
      return global.recommendationEngine.evaluate(data);
    }

    return [];
  }

  function update(data) {
    state.soil = data.soil;
    state.rain = data.rain;
    state.ldr  = data.ldr;
    pushHistory(state);
    notify();
  }

  function init() {
    if (!global.sensorService) {
      // wait for sensorService to become available
      let tries = 0;
      const wait = () => {
        tries += 1;
        if (global.sensorService) {
          global.sensorService.subscribeSensorData(update);
          return;
        }
        if (tries > 20) return console.warn('sensorStore: sensorService not available');
        setTimeout(wait, 300);
      };
      wait();
      return;
    }

    global.sensorService.subscribeSensorData(update);
  }

  init();

  function subscribeStore(cb) {
    if (typeof cb !== 'function') throw new Error('callback required');
    subs.add(cb);
    try { cb(getStore()); } catch (e) { console.error(e); }
    return () => subs.delete(cb);
  }

  function getStore() {
    const soilHistory = [...history.soil];
    const rainHistory = [...history.rain];
    const ldrHistory = [...history.ldr];

    return {
      ...state,
      soilHistory,
      rainHistory,
      ldrHistory,
      history: {
        soil: soilHistory,
        rain: rainHistory,
        ldr: ldrHistory,
      },
      recommendations: buildRecommendations(state),
    };
  }

  global.sensorStore = {
    subscribeStore,
    getStore,
    getRecommendations: () => buildRecommendations(state),
    thresholds,
  };
})(window);
