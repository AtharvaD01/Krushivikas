(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const API = "/api";

  const state = {
    token: sessionStorage.getItem("kv_farmer_token") || "",
    user: JSON.parse(sessionStorage.getItem("kv_farmer_user") || "null"),
    listings: [],
    orders: []
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);

  function dataOf(result) {
    return result?.data ?? result;
  }

  async function api(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (state.token) headers.Authorization = `Bearer ${state.token}`;

    const response = await fetch(`${API}${path}`, { ...options, headers });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) logout(false);
      throw new Error(result.message || result.error || `Request failed (${response.status})`);
    }

    return result;
  }

  function message(text, type = "") {
    const el = $("portal-message");
    el.textContent = text;
    el.className = `message ${type}`.trim();
    el.classList.toggle("hidden", !text);
  }

  function formMessage(id, text, type = "") {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = `form-message ${type}`.trim();
  }

  function showDialog(id) {
    const dialog = $(id);
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog(id) {
    const dialog = $(id);
    if (dialog?.open) dialog.close();
  }

  function listFrom(result, keys) {
    const data = dataOf(result);
    if (Array.isArray(data)) return data;

    for (const key of keys) {
      if (Array.isArray(data?.[key])) return data[key];
    }

    return [];
  }

  function saveSession(token, user) {
    state.token = token;
    state.user = user;
    sessionStorage.setItem("kv_farmer_token", token);
    sessionStorage.setItem("kv_farmer_user", JSON.stringify(user));
    updateAccount();
  }

  function updateAccount() {
    const signedIn = Boolean(state.token && state.user);

    $("account-label").textContent = signedIn
      ? `SIGNED IN · ${state.user.name || "FARMER"}`
      : "FARMER ACCOUNT";

    $("login-button").classList.toggle("hidden", signedIn);
    $("logout-button").classList.toggle("hidden", !signedIn);
    $("new-listing-button").disabled = !signedIn;
  }

  function logout(showMessage = true) {
    state.token = "";
    state.user = null;
    state.listings = [];
    state.orders = [];

    sessionStorage.removeItem("kv_farmer_token");
    sessionStorage.removeItem("kv_farmer_user");

    updateAccount();
    renderListings();
    renderOrders();

    if (showMessage) message("You have signed out.");
  }

  function listingId(item) {
    return Number(item.listing_id ?? item.id);
  }

  function renderListings() {
    const container = $("farmer-listings");
    const listingStat = $("stat-listings");
    const stockStat = $("stat-stock");

    if (!container) return;

    if (!state.token) {
      container.innerHTML = '<p class="muted">Sign in with your farmer account to view inventory.</p>';
      if (listingStat) listingStat.textContent = "—";
      if (stockStat) stockStat.textContent = "—";
      return;
    }

    if (listingStat) listingStat.textContent = state.listings.length;

    const totalStock = state.listings.reduce(
      (sum, item) => sum + Number(item.available_quantity_kg ?? item.quantity_kg ?? 0),
      0
    );
    if (stockStat) {
      stockStat.textContent = totalStock.toLocaleString("en-IN", {
        maximumFractionDigits: 2
      });
    }

    if (!state.listings.length) {
      container.innerHTML = '<p class="muted">No listings were returned for this account. Create a listing when your harvest is ready.</p>';
      return;
    }

    container.innerHTML = state.listings.map((item) => `
      <div class="data-row">
        <div class="data-row-main">
          <strong>${escapeHTML(item.variety || item.crop_name || "Banana")}</strong>
          <span>Listing #${listingId(item)} · Grade ${escapeHTML(item.quality || "—")}</span>
          <span>${escapeHTML(item.location || item.farmer_location || "Location unavailable")}</span>
          <span>${Number(item.available_quantity_kg ?? item.quantity_kg ?? 0).toLocaleString("en-IN")} kg available</span>
        </div>
        <div class="data-row-side">
          <strong>₹${Number(item.price_per_kg || 0).toFixed(2)}/kg</strong>
          <span class="status-badge">${escapeHTML(item.status || "active")}</span>
        </div>
      </div>
    `).join("");
  }

  function renderOrders() {
    const container = $("farmer-orders");
    const ordersStat = $("stat-orders");
    const tracking = $("farmer-tracking");

    if (!container) return;

    if (!state.token) {
      container.innerHTML = '<p class="muted">Sign in to view your incoming orders.</p>';
      if (ordersStat) ordersStat.textContent = "—";
      if (tracking) tracking.innerHTML = '<p class="muted">Sign in to view order tracking.</p>';
      return;
    }

    if (ordersStat) {
      ordersStat.textContent = state.orders.filter((order) =>
        !["delivered", "cancelled"].includes(String(order.status || "").toLowerCase())
      ).length;
    }

    if (!state.orders.length) {
      container.innerHTML = '<p class="muted">No orders were returned for this farmer account yet.</p>';
      $("farmer-tracking").innerHTML = '<p class="muted">Order tracking will appear when buyers place orders.</p>';
      return;
    }

    container.innerHTML = state.orders.map((order) => {
      const id = Number(order.order_id ?? order.id);
      const status = String(order.status || "pending").toLowerCase();
      const nextStatus = {
        placed: "accepted",
        accepted: "dispatched",
        dispatched: "delivered"
      }[status];

      return `
        <div class="data-row">
          <div class="data-row-main">
            <strong>Order #${id}</strong>
            <span>Buyer: ${escapeHTML(order.buyer_name || "Buyer")}</span>
            <span>Quantity: ${Number(order.quantity_kg ?? order.total_quantity_kg ?? 0).toLocaleString("en-IN")} kg</span>
            <span>Placed: ${escapeHTML(order.created_at || "Date unavailable")}</span>
            ${nextStatus ? `
              <div class="row-actions">
                <button class="button secondary" type="button"
                  data-order-id="${id}" data-next-status="${nextStatus}">
                  MARK ${escapeHTML(nextStatus.toUpperCase())}
                </button>
              </div>` : ""}
          </div>
          <div class="data-row-side">
            <strong>₹${Number(order.total_amount || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
            <span class="status-badge ${status === "delivered" ? "success" : status === "cancelled" ? "danger" : "warning"}">${escapeHTML(status)}</span>
          </div>
        </div>`;
    }).join("");

    $("farmer-tracking").innerHTML = state.orders.map((order) => `
      <div class="data-row">
        <div class="data-row-main">
          <strong>Order #${Number(order.order_id ?? order.id)}</strong>
          <span>Current stage: ${escapeHTML(order.status || "pending")}</span>
        </div>
        <div class="data-row-side">
          <span class="status-badge">${escapeHTML(order.status || "pending")}</span>
        </div>
      </div>
    `).join("");

    container.querySelectorAll("[data-order-id]").forEach((button) => {
      button.addEventListener("click", () => updateOrderStatus(
        Number(button.dataset.orderId),
        button.dataset.nextStatus
      ));
    });
  }


  let farmerLeafPreviewUrl = null;

  function renderFarmerDiseaseResult(container, data) {
    const uncertain = data.status === "uncertain";
    const confidenceValue = uncertain
      ? Number(data.confidence) * 100
      : Number(data.confidence_percent);

    const confidence = Number.isFinite(confidenceValue)
      ? Math.max(0, Math.min(100, confidenceValue))
      : null;

    const title = uncertain
      ? "Inconclusive screening"
      : (data.prediction || "Screening result unavailable");

    const probabilities = Object.entries(data.probabilities || {})
      .map(([label, value]) => {
        const percent = Math.max(0, Math.min(100, Number(value) * 100 || 0));
        return `
          <div class="ai-probability">
            <div><span>${escapeHTML(label)}</span><strong>${percent.toFixed(1)}%</strong></div>
            <div class="ai-probability-track">
              <span style="width:${percent}%"></span>
            </div>
          </div>`;
      }).join("");

    container.innerHTML = `
      <p class="eyebrow">${uncertain ? "REVIEW REQUIRED" : "MODEL OUTPUT"}</p>
      <h4>${escapeHTML(title)}</h4>
      ${confidence === null ? "" : `
        <p class="ai-confidence">${confidence.toFixed(2)}% model confidence</p>
        <div class="ai-probability-track ai-confidence-track">
          <span style="width:${confidence}%"></span>
        </div>`}
      ${probabilities ? `<h5>Class probabilities</h5>${probabilities}` : ""}
      <div class="ai-guidance">
        <strong>Recommended next step</strong>
        <p>${escapeHTML(data.guidance || data.message ||
          "Try a clearer photograph or consult an agricultural expert.")}</p>
      </div>
      <p class="muted">${escapeHTML(data.disclaimer ||
        "AI screening only. Obtain expert confirmation before treatment.")}</p>`;
  }

  async function analyseFarmerLeaf() {
    const input = $("farmer-leaf-image");
    const button = $("farmer-disease-button");
    const status = $("farmer-disease-status");
    const result = $("farmer-disease-result");
    const file = input?.files?.[0];

    if (!file) {
      formMessage("farmer-disease-status", "Choose a leaf image first.", "error");
      return;
    }

    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      formMessage("farmer-disease-status",
        "Choose a valid image smaller than 10 MB.", "error");
      return;
    }

    button.disabled = true;
    status.textContent = "Analysing image with the disease detection model…";
    status.className = "form-message";
    result.innerHTML = '<p class="muted">Processing image. Please wait…</p>';

    try {
      const form = new FormData();
      form.append("image", file);

      const response = await fetch(`${API}/disease-detection/predict`, {
        method: "POST",
        headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
        body: form
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !["success", "uncertain"].includes(data.status)) {
        throw new Error(data.message || data.error ||
          `Screening failed (${response.status}).`);
      }

      renderFarmerDiseaseResult(result, data);
      status.textContent = data.status === "uncertain"
        ? "The model could not make a sufficiently confident classification."
        : "Screening completed. Review the result and disclaimer.";
    } catch (error) {
      result.innerHTML = `<p class="muted">${escapeHTML(error.message)}</p>`;
      status.textContent = "Screening unavailable. Check that the backend and model service are running.";
      status.className = "form-message error";
    } finally {
      button.disabled = !input.files?.length;
    }
  }

  function initFarmerDiseaseDetection() {
    const input = $("farmer-leaf-image");
    const button = $("farmer-disease-button");
    if (!input || !button) return;

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      const label = $("farmer-leaf-file-label");
      const preview = $("farmer-leaf-preview");

      if (farmerLeafPreviewUrl) URL.revokeObjectURL(farmerLeafPreviewUrl);
      farmerLeafPreviewUrl = null;
      preview.removeAttribute("src");
      preview.classList.add("hidden");
      button.disabled = true;

      if (!file) {
        label.textContent = "Choose leaf photograph";
        $("farmer-disease-status").textContent = "Select an image to begin.";
        return;
      }

      if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
        input.value = "";
        label.textContent = "Choose leaf photograph";
        formMessage("farmer-disease-status",
          "Select a valid image smaller than 10 MB.", "error");
        return;
      }

      label.textContent = file.name;
      farmerLeafPreviewUrl = URL.createObjectURL(file);
      preview.src = farmerLeafPreviewUrl;
      preview.classList.remove("hidden");
      button.disabled = false;
      formMessage("farmer-disease-status", "Image ready for screening.");
    });

    button.addEventListener("click", analyseFarmerLeaf);
  }


  let farmerPriceRows = [];
  let farmerPriceForecast = null;

  function priceNumber(value) {
    const n = Number(value);
    return Number.isFinite(n)
      ? n.toLocaleString("en-IN", { maximumFractionDigits: 2 })
      : "Unavailable";
  }

  function drawFarmerPriceChart(range = "ALL") {
    const host = $("farmer-price-chart");
    if (!host) return;

    const rows = farmerPriceRows;
    if (!rows.length) {
      host.innerHTML = '<p class="muted">No historical price observations are available.</p>';
      return;
    }

    const latest = new Date(`${rows[rows.length - 1].date}T00:00:00Z`);
    const cutoff = new Date(latest);

    const match = range.match(/^(\d+)([MY])$/);
    if (match) {
      const amount = Number(match[1]);
      if (match[2] === "M") cutoff.setUTCMonth(cutoff.getUTCMonth() - amount);
      else cutoff.setUTCFullYear(cutoff.getUTCFullYear() - amount);
    } else {
      cutoff.setTime(new Date(`${rows[0].date}T00:00:00Z`).getTime());
    }

    const filtered = rows.filter(row => {
      const date = new Date(`${row.date}T00:00:00Z`);
      return date >= cutoff && date <= latest;
    });

    if (!filtered.length) {
      host.textContent = "No observations available for this range.";
      return;
    }

    const width = 900;
    const height = 300;
    const left = 62;
    const right = 20;
    const top = 22;
    const bottom = 42;
    const values = filtered.map(row => Number(row.modal_price));
    const low = Math.min(...values);
    const high = Math.max(...values);
    const spread = high - low || 1;
    const x = index => left + index * (width - left - right) / Math.max(filtered.length - 1, 1);
    const y = value => top + (high - value) * (height - top - bottom) / spread;

    const points = filtered.map((row, index) =>
      `${x(index).toFixed(2)},${y(Number(row.modal_price)).toFixed(2)}`
    ).join(" ");

    const grid = Array.from({ length: 5 }, (_, index) => {
      const value = high - spread * index / 4;
      const yy = y(value);
      return `
        <line x1="${left}" y1="${yy}" x2="${width-right}" y2="${yy}" class="price-grid-line"/>
        <text x="${left-10}" y="${yy+4}" text-anchor="end" class="price-axis-label">${priceNumber(value)}</text>`;
    }).join("");

    const firstDate = filtered[0].date;
    const lastDate = filtered[filtered.length - 1].date;

    host.innerHTML = `
      <div class="price-chart-scroll">
        <svg viewBox="0 0 ${width} ${height}" role="img"
             aria-label="Historical banana modal-price observations, ${filtered.length} data points">
          ${grid}
          <polyline points="${points}" class="price-line" />
          <text x="${left}" y="${height-12}" class="price-axis-label">${escapeHTML(firstDate)}</text>
          <text x="${width-right}" y="${height-12}" text-anchor="end" class="price-axis-label">${escapeHTML(lastDate)}</text>
        </svg>
      </div>
      <div class="price-chart-summary">
        <span>${filtered.length.toLocaleString("en-IN")} observations</span>
        <span>Lowest: ${priceNumber(low)}</span>
        <span>Highest: ${priceNumber(high)}</span>
      </div>`;
  }

  async function loadFarmerPriceIntelligence() {
    const warning = $("farmer-price-warning");
    if (!warning) return;

    warning.textContent = "Loading forecast and historical observations…";
    warning.className = "message warning";

    const [forecastResult, historyResult] = await Promise.allSettled([
      fetch(`${API}/price-prediction/`).then(async response => {
        const json = await response.json();
        if (!response.ok || json.status !== "success") {
          throw new Error(json.message || "Forecast unavailable.");
        }
        return dataOf(json);
      }),
      fetch(`${API}/price-prediction/history`).then(async response => {
        const json = await response.json();
        if (!response.ok || json.status !== "success") {
          throw new Error(json.message || "Historical data unavailable.");
        }
        return json;
      })
    ]);

    if (forecastResult.status === "fulfilled") {
      farmerPriceForecast = forecastResult.value;
      const forecast = farmerPriceForecast;
      $("farmer-price-last").textContent = priceNumber(forecast.last_observed_modal_price);
      $("farmer-price-last-date").textContent =
        `Observed ${forecast.last_observed_date || "on an unknown date"}`;
      $("farmer-price-forecast").textContent = priceNumber(forecast.experimental_forecast);
      $("farmer-price-forecast-date").textContent =
        `Experimental date: ${forecast.forecast_date || "unavailable"}`;

      const evaluation = forecast.evaluation || {};
      $("farmer-price-mae").textContent = priceNumber(evaluation.test_mae);
      $("farmer-price-rmse").textContent = priceNumber(evaluation.test_rmse);

      const age = Number(forecast.data_age_days);
      if (forecast.stale || forecast.forecast_is_current === false) {
        warning.textContent =
          `OUTDATED DATA — latest observation: ${forecast.last_observed_date || "unknown"}` +
          (Number.isFinite(age) ? ` (${age} days old). ` : ". ") +
          "Do not treat this experimental estimate as today's market price.";
        warning.className = "message warning";
      } else {
        warning.textContent =
          "Data freshness check passed. This remains an experimental estimate, not a guaranteed market price.";
        warning.className = "message success";
      }
    } else {
      warning.textContent = `Forecast unavailable: ${forecastResult.reason.message}`;
      warning.className = "message error";
    }

    if (historyResult.status === "fulfilled") {
      const history = historyResult.value;
      farmerPriceRows = (history.data || [])
        .filter(row =>
          /^\d{4}-\d{2}-\d{2}$/.test(row.date || "") &&
          Number.isFinite(Number(row.modal_price)) &&
          Number(row.modal_price) > 0
        )
        .sort((a, b) => a.date.localeCompare(b.date));

      drawFarmerPriceChart("ALL");
      $("farmer-price-source").textContent =
        `Source: ${history.source || "Not specified"} · ${history.region || "Region unavailable"} · ` +
        `${history.observations ?? farmerPriceRows.length} observations · ` +
        `${history.date_start || "Unknown start"} to ${history.date_end || "Unknown end"}. ` +
        "Source price units are unverified; no currency or weight conversion is assumed.";
    } else {
      $("farmer-price-chart").textContent =
        `Historical data unavailable: ${historyResult.reason.message}`;
      $("farmer-price-source").textContent = "Historical source metadata unavailable.";
    }
  }

  function initFarmerPriceIntelligence() {
    document.querySelectorAll("[data-price-range]").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll("[data-price-range]").forEach(item =>
          item.classList.toggle("active", item === button)
        );
        drawFarmerPriceChart(button.dataset.priceRange);
      });
    });

    loadFarmerPriceIntelligence();
  }

  async function loadFarmWeather() {
        const status = $("weather-status");
    const content = $("weather-content");

    if (!status || !content) {
      console.warn("Weather card elements are missing from farmer-portal.html.");
      return;
    }

    if (!state.token) {
      status.textContent = "Sign in to view your local weather forecast.";
      content.classList.add("hidden");
      return;
    }

    status.textContent = "Loading weather forecast…";
    status.className = "message";
    content.classList.add("hidden");

    try {
      const result = await api("/farm-weather");
      const data = dataOf(result);
      const daily = data.daily;
      const location = data.location;

      if (!location || !Array.isArray(daily?.time) || !daily.time.length) {
        throw new Error("Forecast data is incomplete.");
      }

      $("weather-location").textContent =
        `${location.name}, ${location.admin1 || location.country} · Open-Meteo`;

      $("weather-high").textContent = `${daily.temperature_2m_max?.[0] ?? "—"}°C`;
      $("weather-low").textContent = `${daily.temperature_2m_min?.[0] ?? "—"}°C`;

      $("weather-rain-chance").textContent =
        `${daily.precipitation_probability_max?.[0] ?? "—"}%`;

      $("weather-rainfall").textContent =
        `${daily.precipitation_sum?.[0] ?? "—"} mm`;

      const forecast = $("weather-forecast");

      if (!forecast) {
        throw new Error("Weather forecast HTML is missing.");
      }

      forecast.innerHTML = daily.time.slice(1, 5).map((date, index) => {
        const i = index + 1;

        const day = new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric",
          month: "short"
        });

        return `
          <article class="weather-day">
            <strong>${escapeHTML(day)}</strong>
            <span class="weather-day-temperature">${escapeHTML(daily.temperature_2m_max?.[i] ?? "—")}° / ${escapeHTML(daily.temperature_2m_min?.[i] ?? "—")}°C</span>
            <small>Rain chance: ${escapeHTML(daily.precipitation_probability_max?.[i] ?? "—")}%</small>
            <small>${escapeHTML(daily.precipitation_sum?.[i] ?? "—")} mm expected</small>
          </article>`;
      }).join("");

      content.classList.remove("hidden");
      status.textContent = "Forecast updated successfully.";
      status.className = "message success";

    } catch (error) {
      console.error("Farm weather error:", error);
      status.textContent = `Weather unavailable: ${error.message}`;
      status.className = "message error";
      content.classList.add("hidden");
    }
  }
  async function loadDashboard() {
    loadFarmWeather();
    if (!state.token) {
      renderListings();
      renderOrders();
      message("Sign in with a linked farmer account to access your dashboard.");
      return;
    }

    message("Loading your farmer dashboard…");

    try {
      const [listingsResult, ordersResult] = await Promise.all([
        api("/marketplace/listings/mine?limit=100"),
        api("/marketplace/orders")
      ]);

      state.listings = listFrom(listingsResult, ["listings", "items"]);
      state.orders = listFrom(ordersResult, ["orders", "items"]);

      renderListings();
      renderOrders();
      message("Dashboard refreshed.", "success");
    } catch (error) {
      renderListings();
      renderOrders();
      message(`Could not load the dashboard: ${error.message}`, "error");
    }
  }

  async function login(event) {
    event.preventDefault();
    formMessage("login-message", "Signing in…");

    try {
      const result = dataOf(await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("login-email").value.trim(),
          password: $("login-password").value
        })
      }));

      if (!result.token || !result.user) {
        throw new Error("Unexpected login response from the server.");
      }

      if (result.user.role !== "farmer") {
        throw new Error("This account is not a farmer account. Please use your linked farmer credentials.");
      }

      saveSession(result.token, result.user);
      closeDialog("login-dialog");
      $("login-form").reset();
      await loadDashboard();
    } catch (error) {
      formMessage("login-message", error.message, "error");
    }
  }

  async function createListing(event) {
    event.preventDefault();
    formMessage("listing-message", "Publishing listing…");

    const body = {
      harvest_id: Number($("listing-harvest").value),
      crop_id: 1,
      price_per_kg: Number($("listing-price").value),
      quantity_kg: Number($("listing-quantity").value),
      quality: $("listing-quality").value,
      description: $("listing-description").value.trim()
    };

    if (
      !Number.isFinite(body.harvest_id) || body.harvest_id < 1 ||
      !Number.isFinite(body.price_per_kg) || body.price_per_kg <= 0 ||
      !Number.isFinite(body.quantity_kg) || body.quantity_kg <= 0
    ) {
      formMessage("listing-message", "Enter a valid harvest ID, price and quantity.", "error");
      return;
    }

    try {
      await api("/marketplace/listings", {
        method: "POST",
        body: JSON.stringify(body)
      });

      closeDialog("listing-dialog");
      $("listing-form").reset();
      message("Your banana listing has been submitted.", "success");
      await loadDashboard();
    } catch (error) {
      formMessage("listing-message", error.message, "error");
    }
  }

  async function updateOrderStatus(orderId, status) {
    if (!Number.isInteger(orderId) || orderId < 1) return;

    const button = document.querySelector(`[data-order-id="${orderId}"]`);
    if (button) button.disabled = true;

    try {
      await api(`/marketplace/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });

      message(`Order #${orderId} updated to ${status}.`, "success");
      await loadDashboard();
    } catch (error) {
      message(`Could not update order #${orderId}: ${error.message}`, "error");
      if (button) button.disabled = false;
    }
  }

  function init() {
    updateAccount();

    $("login-button").addEventListener("click", () => {
      formMessage("login-message", "");
      showDialog("login-dialog");
    });

    $("logout-button").addEventListener("click", () => logout());

    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => closeDialog(button.dataset.close));
    });

    $("login-form").addEventListener("submit", login);
    $("listing-form").addEventListener("submit", createListing);
    $("new-listing-button").addEventListener("click", () => {
      formMessage("listing-message", "");
      showDialog("listing-dialog");
    });
    $("refresh-button").addEventListener("click", loadDashboard);
    initFarmerDiseaseDetection();
    initFarmerPriceIntelligence();
    loadFarmWeather();

$("weather-refresh")?.addEventListener("click", loadFarmWeather);

    loadDashboard();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
