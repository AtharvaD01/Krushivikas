/* KRUSHIVIKAS — API service. The browser only talks to the Express API; it never touches MySQL.
   Base URL: set window.KRUSHI_API_BASE before this script to override (e.g. a deployed backend). */
(function () {
  const loc = window.location;
  const isDevHost = loc.protocol === 'file:' || ((loc.hostname === 'localhost' || loc.hostname === '127.0.0.1') && loc.port !== '5001');
  const BASE = (window.KRUSHI_API_BASE || (isDevHost ? 'http://localhost:5001/api' : '/api')).replace(/\/$/, '');
  const TIMEOUT_MS = 10000;

  async function request(method, path, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(BASE + path, {
        method, signal: ctrl.signal,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      const err = new Error(e.name === 'AbortError' ? 'Backend timed out.' : 'Backend unavailable. Start it with "npm start" in /backend.');
      err.offline = true; throw err;
    } finally { clearTimeout(timer); }
    if (res.status === 204) return null;
    let json = null;
    try { json = await res.json(); } catch (_) { /* non-JSON */ }
    if (!res.ok) {
      const err = new Error((json && json.error) || `Request failed (${res.status})`);
      err.status = res.status; err.details = json && json.details; throw err;
    }
    return json ? (json.data !== undefined ? json.data : json) : null;
  }

  async function requestWithToken(method, path, token, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(BASE + path, {
        method,
        signal: ctrl.signal,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      const err = new Error(e.name === 'AbortError' ? 'Backend timed out.' : 'Backend unavailable.');
      err.offline = true;
      throw err;
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 204) return null;
    let json = null;
    try { json = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((json && json.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.details = json && json.details;
      throw err;
    }
    return json && json.data !== undefined ? json.data : json;
  }


  async function getReviewerPhotoUrl(id, token) {
    const response = await fetch(
      `${BASE}/harvest-evidence/${encodeURIComponent(id)}/photo`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      let message = `Photo request failed (${response.status})`;
      try {
        const data = await response.json();
        if (data.error) message = data.error;
      } catch (_) {}
      throw new Error(message);
    }

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }


  async function uploadHarvestEvidence(id, photo, latitude, longitude, token) {
    const form = new FormData();
    form.append('photo', photo);
    if (latitude !== '' && longitude !== '') {
      form.append('gps_latitude', latitude);
      form.append('gps_longitude', longitude);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(
        `${BASE}/harvest-evidence/${encodeURIComponent(id)}/upload`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form, signal: controller.signal }
      );

      let result = {};
      try { result = await response.json(); } catch (_) {}

      if (!response.ok) {
        const error = new Error(result.error || `Upload failed (${response.status})`);
        error.status = response.status;
        throw error;
      }

      return result.data ?? result;
    } finally {
      clearTimeout(timer);
    }
  }

  const qs = p => { const s = new URLSearchParams(Object.entries(p || {}).filter(([, v]) => v !== undefined && v !== '' && v !== null)).toString(); return s ? '?' + s : ''; };
  const resource = name => ({
    list: p => request('GET', `/${name}${qs(p)}`), get: id => request('GET', `/${name}/${id}`),
    create: b => request('POST', `/${name}`, b), update: (id, b) => request('PATCH', `/${name}/${id}`, b), remove: id => request('DELETE', `/${name}/${id}`)
  });

  window.KrushiAPI = {
    base: BASE, request,

    getReviewerPhotoUrl,
    uploadHarvestEvidence,
    reviewer: {
      login: password => request('POST', '/reviewer-auth/login', { password }),
      pending: token => requestWithToken('GET', '/harvest-approval/pending', token),
      approved: token => requestWithToken('GET', '/harvest-approval/approved', token),
      verify: (id, token) => requestWithToken('POST', `/harvest-approval/${id}/verify`, token),
      approve: (id, notes, token) => requestWithToken('POST', `/harvest-approval/${id}/approve`, token, { notes }),
      reject: (id, notes, token) => requestWithToken('POST', `/harvest-approval/${id}/reject`, token, { notes })
    },

    health: () => request('GET', '/health'),
    farmers: resource('farmers'), crops: resource('crops'), harvest: resource('harvest'), collection: resource('collection'),
    storage: resource('storage'), transportation: resource('transportation'), distribution: resource('distribution'),
    retail: resource('retail'), marketPrices: resource('market-prices'), demand: resource('demand'), wastage: resource('wastage'),
    dashboard: {
      summary: () => request('GET', '/dashboard/summary'),
      stageLosses: p => request('GET', `/dashboard/stage-losses${qs(p)}`),
      wastage: groupBy => request('GET', `/dashboard/wastage${qs({ group_by: groupBy })}`),
      prices: p => request('GET', `/dashboard/prices${qs(p)}`),
      demand: p => request('GET', `/dashboard/demand${qs(p)}`),
      storage: () => request('GET', '/dashboard/storage'),
      transportation: () => request('GET', '/dashboard/transportation'),
      chains: () => request('GET', '/dashboard/chains'),
      trace: id => request('GET', `/dashboard/trace/${id}`),
      publicTraceQR: id => request('GET', `/public-trace/${encodeURIComponent(id)}/qr`)
    }
  };
})();
