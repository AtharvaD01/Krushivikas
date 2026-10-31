/* Krushivikas — Nationwide Government Mandi Prices */
(function () {
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const formatNumber = value =>
    value == null || value === '' || !Number.isFinite(Number(value))
      ? '—'
      : Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const formatPrice = value => {
    if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
    return '₹' + formatNumber(value);
  };

  let state = { offset: 0, limit: 20, filters: { commodity: 'Banana' }, sort: 'none' };
  let requestId = 0;

  async function load() {
    const id = ++requestId;
    const results = document.getElementById('sc-mandi-results');
    const status = document.getElementById('sc-mandi-status');
    if (!results || !status) return;

    results.innerHTML = '<div class="sc-loading">LOADING NATIONWIDE MANDI PRICES…</div>';
    status.textContent = 'Fetching the latest available records from data.gov.in…';

    const params = new URLSearchParams({
      limit: String(state.limit),
      offset: String(state.offset)
    });

    Object.entries(state.filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });

    try {
      const response = await fetch('/api/nationwide-mandi?' + params.toString());
      const json = await response.json();
      if (!response.ok || json.status !== 'success') {
        throw new Error(json.message || 'Could not load mandi prices.');
      }
      if (id !== requestId || !document.getElementById('sc-mandi-results')) return;

      const records = json.records || [];
      const total = Number(json.total) || 0;

      const validDates = records.map(r => {
        const m = String(r.arrival_date || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
      }).filter(Boolean).sort();
      const latestDate = validDates.length ? validDates[validDates.length - 1].split('-').reverse().join('/') : 'Not reported';

      status.innerHTML = `${formatNumber(total)} records reported · Showing ${records.length ? state.offset + 1 : 0}–${state.offset + records.length} · Latest arrival date on this page: ${escapeHTML(latestDate)} · <strong>Reported data, not live prices</strong>`;

      const sortedRecords = [...records];
      if (state.sort === 'low') sortedRecords.sort((a, b) => Number(a.modal_price ?? Infinity) - Number(b.modal_price ?? Infinity));
      if (state.sort === 'high') sortedRecords.sort((a, b) => Number(b.modal_price ?? -Infinity) - Number(a.modal_price ?? -Infinity));

      results.innerHTML = records.length ? `
        <div class="sc-toolbar" style="margin-bottom:12px">
          <label for="sc-mandi-sort" class="card-label" style="margin:0">SORT THIS PAGE BY MODAL PRICE</label>
          <select id="sc-mandi-sort" class="sc-select">
            <option value="none">Original order</option>
            <option value="low" ${state.sort === 'low' ? 'selected' : ''}>Lowest first</option>
            <option value="high" ${state.sort === 'high' ? 'selected' : ''}>Highest first</option>
          </select>
        </div>` + `
        <div class="sc-scroll">
          <table class="sc-table">
            <thead><tr>
              <th>STATE / DISTRICT</th>
              <th>MARKET</th>
              <th>COMMODITY / VARIETY</th>
              <th>GRADE</th>
              <th class="num">MIN PRICE</th>
              <th class="num">MODAL PRICE</th>
              <th class="num">MAX PRICE</th>
              <th>ARRIVAL DATE</th>
            </tr></thead>
            <tbody>${sortedRecords.map(r => `
              <tr>
                <td>${escapeHTML([r.state, r.district].filter(Boolean).join(' / ') || 'Not reported')}</td>
                <td>${escapeHTML(r.market || '—')}</td>
                <td>${escapeHTML([r.commodity, r.variety].filter(Boolean).join(' / ') || '—')}</td>
                <td>${escapeHTML(r.grade || '—')}</td>
                <td class="num">${formatPrice(r.min_price)}</td>
                <td class="num"><strong>${formatPrice(r.modal_price)}</strong></td>
                <td class="num">${formatPrice(r.max_price)}</td>
                <td>${escapeHTML(r.arrival_date || 'Not reported')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>` : '<div class="sc-msg info">No records found for these filters.</div>';

      const sortSelect = document.getElementById('sc-mandi-sort');
      if (sortSelect) sortSelect.addEventListener('change', e => {
        state.sort = e.target.value;
        load();
      });

      const page = Math.floor(state.offset / state.limit) + 1;
      const pages = Math.max(1, Math.ceil(total / state.limit));
      document.getElementById('sc-mandi-page').textContent = `Page ${page} of ${pages}`;
      document.getElementById('sc-mandi-prev').disabled = state.offset <= 0;
      document.getElementById('sc-mandi-next').disabled =
        records.length === 0 || state.offset + records.length >= total;
    } catch (error) {
      if (id !== requestId) return;
      results.innerHTML = `<div class="sc-msg err">${escapeHTML(error.message)}</div>`;
      status.textContent = 'Unable to retrieve mandi prices.';
    }
  }

  function applyFilters() {
    state.offset = 0;
    state.filters = {
      state: document.getElementById('sc-mandi-state').value.trim(),
      district: document.getElementById('sc-mandi-district').value.trim(),
      commodity: document.getElementById('sc-mandi-commodity').value.trim() || 'Banana',
      market: document.getElementById('sc-mandi-market').value.trim()
    };
    load();
  }

  function init() {
    const host = document.getElementById('sc-nationwide-mandi');
    if (!host || host.dataset.initialized === 'true') return;
    host.dataset.initialized = 'true';

    document.getElementById('sc-mandi-apply').addEventListener('click', applyFilters);
    document.getElementById('sc-mandi-refresh').addEventListener('click', load);
    document.getElementById('sc-mandi-reset').addEventListener('click', () => {
      ['state', 'district', 'commodity', 'market'].forEach(k => {
        document.getElementById('sc-mandi-' + k).value = '';
      });
      applyFilters();
    });
    document.getElementById('sc-mandi-prev').addEventListener('click', () => {
      state.offset = Math.max(0, state.offset - state.limit);
      load();
    });
    document.getElementById('sc-mandi-next').addEventListener('click', () => {
      state.offset += state.limit;
      load();
    });
    load();
  }

  window.KrushiNationwideMandi = { init };
})();
