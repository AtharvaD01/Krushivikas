(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const API_BASE = "http://localhost:5001/api";

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function price(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0
      ? "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
      : "—";
  }

  function parseDate(value) {
    if (!value) return null;
    const s = String(value).trim();
    let match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    match = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return null;
  }

  function formatDate(value) {
    const d = parseDate(value);
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : (value || "Date unavailable");
  }

  function status(text, kind) {
    const node = $("farmer-live-market-status");
    if (!node) return;
    node.className = "message" + (kind ? " " + kind : "");
    node.textContent = text;
  }

  async function loadLiveMarket() {
    const body = $("farmer-live-market-rows");
    const state = $("farmer-live-market-state")?.value || "";
    const commodity = $("farmer-live-market-commodity")?.value.trim() || "";
    const district = $("farmer-live-market-district")?.value.trim() || "";

    if (!body) return;

    if (!commodity) {
      status("Enter a commodity to search the mandi feed.", "warning");
      return;
    }

    body.innerHTML = '<tr><td colspan="7">Fetching official market observations…</td></tr>';
    status("Requesting current reported observations from data.gov.in…");

    const params = new URLSearchParams({ limit: "100", offset: "0" });
    if (state) params.set("state", state);
    if (commodity) params.set("commodity", commodity);
    if (district) params.set("district", district);

    try {
      const response = await fetch(`${API_BASE}/nationwide-mandi?${params}`);
      const result = await response.json();

      if (!response.ok || result.status !== "success") {
        throw new Error(result.message || "The government mandi feed is unavailable.");
      }

      const records = Array.isArray(result.records) ? result.records : [];

      if (!records.length) {
        body.innerHTML = '<tr><td colspan="7">No matching records were returned. Try another state, district or commodity.</td></tr>';
        status("No matching observations found. This does not mean the commodity has no market price.", "warning");
        $("farmer-live-market-source").textContent = `Source: ${result.source || "data.gov.in"} · No matching records`;
        return;
      }

      const normal = v => String(v ?? "").trim().toLowerCase();
      const requestedCommodity = normal(commodity);
      const matching = records.filter(r =>
        normal(r.commodity).includes(requestedCommodity)
      );

      const rows = matching.length ? matching : records;
      body.innerHTML = rows.map(r => {
        const date = parseDate(r.arrival_date);
        const ageDays = date ? Math.floor((new Date().setHours(0,0,0,0) - date.getTime()) / 86400000) : null;
        const stale = ageDays === null || ageDays < 0 || ageDays > 7;
        return `<tr>
          <td>${escapeHTML(r.market || "—")}</td>
          <td>${escapeHTML(r.district || "—")}</td>
          <td>${escapeHTML(r.commodity || "—")}</td>
          <td>${price(r.min_price)}</td>
          <td><strong>${price(r.modal_price)}</strong></td>
          <td>${price(r.max_price)}</td>
          <td><span>${escapeHTML(formatDate(r.arrival_date))}</span>${stale ? '<small class="market-stale-tag">Older / verify</small>' : '<small class="market-fresh-tag">Recent report</small>'}</td>
        </tr>`;
      }).join("");

      const dates = rows.map(r => parseDate(r.arrival_date)).filter(Boolean).sort((a,b) => b-a);
      const newest = dates[0];
      const age = newest ? Math.floor((new Date().setHours(0,0,0,0) - newest.getTime()) / 86400000) : null;

      let message = `${rows.length} reported ${commodity} market record(s) returned.`;
      if (age === null) message += " Observation dates could not be verified.";
      else if (age > 7) message += ` Newest observation is ${age} days old; prices are stale.`;
      else if (age < 0) message += " The newest observation has a future date; verify the source data.";
      else message += ` Newest observation: ${formatDate(newest.toLocaleDateString("en-GB"))}.`;
      status(message, age !== null && age >= 0 && age <= 7 ? "success" : "warning");

      $("farmer-live-market-source").textContent =
        `Source: ${result.source || "Government of India — data.gov.in"} · API records available: ${Number(result.total) || rows.length} · Retrieved: ${new Date().toLocaleString("en-IN")}. Prices are shown in the source's reported units (typically ₹/quintal); verify before comparing with ₹/kg offers.`;
    } catch (error) {
      body.innerHTML = '<tr><td colspan="7">Could not load market observations.</td></tr>';
      status(`${error.message} Check that the backend is running and DATA_GOV_IN_API_KEY is configured.`, "warning");
      $("farmer-live-market-source").textContent = "Source: Government of India · data.gov.in";
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!$("farmer-live-market")) return;
    $("farmer-live-market-refresh")?.addEventListener("click", loadLiveMarket);
    $("farmer-live-market-search")?.addEventListener("click", loadLiveMarket);
    $("farmer-live-market-state")?.addEventListener("change", loadLiveMarket);
    loadLiveMarket();
  });
})();
