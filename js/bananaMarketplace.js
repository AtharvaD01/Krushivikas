(() => {
  "use strict";

  const API = "/api";
  const $ = (id) => document.getElementById(id);

  const state = {
    token: sessionStorage.getItem("kv_market_token") || "",
    user: JSON.parse(sessionStorage.getItem("kv_market_user") || "null"),
    listings: [],
    selectedListing: null
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[char]);

  async function request(path, options = {}) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };

    if (state.token) {
      headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(`${API}${path}`, { ...options, headers });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        state.token = "";
        state.user = null;
        sessionStorage.removeItem("kv_market_token");
        sessionStorage.removeItem("kv_market_user");
        updateAccount();
      }

      throw new Error(result.message || result.error || `Request failed (${response.status})`);
    }

    return result;
  }

  function payload(result) {
    return result?.data ?? result;
  }

  function showMessage(message, type = "") {
    const element = $("market-message");
    if (!element) return;

    element.textContent = message;
    element.className = `message ${type}`.trim();
    element.classList.toggle("hidden", !message);
  }

  function showFormMessage(id, message, type = "") {
    const element = $(id);
    if (!element) return;

    element.textContent = message;
    element.className = `form-message ${type}`.trim();
  }

  function openDialog(id) {
    const dialog = $(id);
    if (dialog && !dialog.open) dialog.showModal();
  }

  function closeDialog(id) {
    const dialog = $(id);
    if (dialog?.open) dialog.close();
  }

  function updateAccount() {
    const loggedIn = Boolean(state.token && state.user);

    if ($("account-label")) {
      $("account-label").textContent = loggedIn
        ? `Signed in${state.user.name ? ` as ${state.user.name}` : ""}`
        : "Buyer account";
    }

    $("login-button")?.classList.toggle("hidden", loggedIn);
    $("logout-button")?.classList.toggle("hidden", !loggedIn);
  }

  function normaliseListings(result) {
    const data = payload(result);
    if (Array.isArray(data)) return data;

    if (Array.isArray(data?.listings)) return data.listings;
    if (Array.isArray(data?.items)) return data.items;

    return [];
  }

  function listingId(item) {
    return Number(item.listing_id ?? item.id);
  }

  function listingPrice(item) {
    return Number(item.price_per_kg ?? item.price ?? 0);
  }

  function listingStock(item) {
    return Number(item.available_quantity_kg ?? item.quantity_kg ?? item.stock ?? 0);
  }

  function listingLocation(item) {
    return [item.location, item.district, item.farmer_location]
      .filter(Boolean)
      .join(", ");
  }

  function listingFarmer(item) {
    return item.farmer_name ?? item.name ?? "Local farmer";
  }

  function listingQuality(item) {
    return String(item.quality ?? "Not specified").toUpperCase();
  }

  function matchesState(item, selectedState) {
    if (!selectedState) return true;

    const actual = String(item.farmer_state ?? item.state ?? "").trim().toLowerCase();

    // Do not infer a state when the API has not supplied one.
    return actual === selectedState.toLowerCase();
  }

  function renderListings() {
    const grid = $("listing-grid");
    if (!grid) return;

    const search = ($("search-input")?.value || "").trim().toLowerCase();
    const selectedState = $("state-filter")?.value || "";
    const location = ($("location-filter")?.value || "").trim().toLowerCase();
    const quality = $("quality-filter")?.value || "";
    const sort = $("sort-filter")?.value || "newest";

    let items = state.listings.filter((item) => {
      const searchable = [
        listingFarmer(item),
        listingLocation(item),
        item.crop_name,
        item.variety,
        item.description
      ].filter(Boolean).join(" ").toLowerCase();

      return (!search || searchable.includes(search)) &&
        matchesState(item, selectedState) &&
        (!location || listingLocation(item).toLowerCase().includes(location)) &&
        (!quality || listingQuality(item) === quality);
    });

    if (sort === "price-asc") items.sort((a, b) => listingPrice(a) - listingPrice(b));
    if (sort === "price-desc") items.sort((a, b) => listingPrice(b) - listingPrice(a));
    if (sort === "stock-desc") items.sort((a, b) => listingStock(b) - listingStock(a));
    if (sort === "newest") {
      items.sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    }

    if ($("listing-count")) {
      $("listing-count").textContent = `${items.length} listing${items.length === 1 ? "" : "s"}`;
    }

    if ($("results-label")) {
      $("results-label").textContent = search || location || selectedState || quality
        ? "Filtered banana listings"
        : "Available banana listings";
    }

    if (!items.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍌</div>
          <h3>No matching banana listings</h3>
          <p>Try another search or clear your filters. More listings may become available soon.</p>
          <button class="button secondary" id="clear-filters" type="button">Clear filters</button>
        </div>`;
      $("clear-filters")?.addEventListener("click", clearFilters);
      return;
    }

    grid.innerHTML = items.map((item) => {
      const id = listingId(item);
      const price = listingPrice(item);
      const stock = listingStock(item);
      const farmer = listingFarmer(item);
      const locationText = listingLocation(item) || "Location not provided";
      const variety = item.variety || item.crop_name || "Banana";
      const qualityLabel = listingQuality(item);
      const description = item.description || "Fresh bananas offered directly by the farmer.";
      const unavailable = !Number.isFinite(id) || id <= 0 || stock <= 0 ||
        String(item.status || "active").toLowerCase() !== "active";

      return `
        <article class="listing-card">
          <div class="card-art">
            <span class="banana-icon" aria-hidden="true">🍌</span>
            <span class="grade-badge">GRADE ${escapeHTML(qualityLabel)}</span>
          </div>
          <div class="card-body">
            <div class="card-title-row">
              <div>
                <h3>${escapeHTML(variety)}</h3>
                <div class="crop-variety">Banana · Direct from farmer</div>
              </div>
              <div class="card-price">
                ₹${price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                <small>per kg</small>
              </div>
            </div>
            <div class="card-meta">
              <span class="meta-pill">📍 ${escapeHTML(locationText)}</span>
              <span class="meta-pill">📦 ${stock.toLocaleString("en-IN")} kg available</span>
            </div>
            <p class="card-description">${escapeHTML(description)}</p>
            <div class="farmer-line">
              <div class="farmer-avatar">${escapeHTML(farmer.charAt(0).toUpperCase())}</div>
              <div class="farmer-info">
                <strong>${escapeHTML(farmer)}</strong>
                <span>Farmer listing</span>
              </div>
            </div>
            <button class="button primary card-buy" type="button"
              data-buy-id="${id}" ${unavailable ? "disabled" : ""}>
              ${unavailable ? "Currently unavailable" : "Buy bananas"}
            </button>
          </div>
        </article>`;
    }).join("");

    grid.querySelectorAll("[data-buy-id]").forEach((button) => {
      button.addEventListener("click", () => beginOrder(Number(button.dataset.buyId)));
    });
  }

  function clearFilters() {
    ["search-input", "location-filter", "state-filter", "quality-filter"].forEach((id) => {
      if ($(id)) $(id).value = "";
    });

    if ($("sort-filter")) $("sort-filter").value = "newest";
    renderListings();
  }

  async function loadListings() {
    showMessage("Loading fresh banana listings…");

    try {
      // The marketplace is restricted to the Banana crop (crop_id=1).
      const result = await request("/marketplace/listings?crop_id=1&limit=100");
      state.listings = normaliseListings(result).filter((item) => {
        const cropId = Number(item.crop_id ?? 1);
        return cropId === 1;
      });

      showMessage("");
      renderListings();
    } catch (error) {
      state.listings = [];
      renderListings();
      showMessage(`Unable to load listings: ${error.message}. Check that the backend is running.`, "error");
    }
  }

  function beginOrder(id) {
    const item = state.listings.find((entry) => listingId(entry) === id);
    if (!item) {
      showMessage("This listing is no longer available. Refresh the page.", "error");
      return;
    }

    if (!state.token || !state.user) {
      showMessage("Sign in to your buyer account before placing an order.", "");
      openDialog("login-dialog");
      return;
    }

    if (state.user.role && state.user.role !== "buyer") {
      showMessage("Ordering is available through a buyer account. Please sign in as a buyer.", "error");
      return;
    }

    state.selectedListing = item;
    $("order-title").textContent = `${item.variety || item.crop_name || "Banana"} — ${listingLocation(item) || "Farmer listing"}`;
    $("order-price").textContent = `₹${listingPrice(item).toFixed(2)} per kg`;
    $("order-quantity").max = String(listingStock(item));
    $("order-quantity").value = "1";
    $("order-contact").value = "";
    $("order-address").value = "";
    updateOrderTotal();
    showFormMessage("order-message", "");
    openDialog("order-dialog");
  }

  function updateOrderTotal() {
    const item = state.selectedListing;
    if (!item) return;

    const quantity = Number($("order-quantity")?.value || 0);
    const validQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    $("order-total").textContent =
      `Estimated total: ₹${(listingPrice(item) * validQuantity).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }

  async function submitLogin(event) {
    event.preventDefault();
    showFormMessage("login-message", "Signing in…");

    try {
      const result = payload(await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: $("login-email").value.trim(),
          password: $("login-password").value
        })
      }));

      if (!result.token || !result.user) {
        throw new Error("The server returned an unexpected login response.");
      }

      state.token = result.token;
      state.user = result.user;
      sessionStorage.setItem("kv_market_token", state.token);
      sessionStorage.setItem("kv_market_user", JSON.stringify(state.user));
      updateAccount();
      closeDialog("login-dialog");
      $("login-form").reset();
      showMessage("Signed in successfully.", "success");
    } catch (error) {
      showFormMessage("login-message", error.message, "error");
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    showFormMessage("register-message", "Creating your account…");

    try {
      const result = payload(await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: $("register-name").value.trim(),
          email: $("register-email").value.trim(),
          password: $("register-password").value
        })
      }));

      if (!result.token || !result.user) {
        throw new Error("Registration succeeded, but the server did not return a login session. Please sign in.");
      }

      state.token = result.token;
      state.user = result.user;
      sessionStorage.setItem("kv_market_token", state.token);
      sessionStorage.setItem("kv_market_user", JSON.stringify(state.user));
      updateAccount();
      closeDialog("register-dialog");
      $("register-form").reset();
      showMessage("Buyer account created successfully.", "success");
    } catch (error) {
      showFormMessage("register-message", error.message, "error");
    }
  }

  async function submitOrder(event) {
    event.preventDefault();
    const item = state.selectedListing;
    if (!item) return;

    const quantity = Number($("order-quantity").value);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > listingStock(item)) {
      showFormMessage("order-message", "Enter a quantity within the available stock.", "error");
      return;
    }

    showFormMessage("order-message", "Placing your order…");

    try {
      await request("/marketplace/orders", {
        method: "POST",
        body: JSON.stringify({
          listing_id: listingId(item),
          quantity_kg: quantity,
          buyer_contact: $("order-contact").value.trim(),
          delivery_address: $("order-address").value.trim()
        })
      });

      closeDialog("order-dialog");
      showMessage("Order placed successfully. Stock has been updated.", "success");
      state.selectedListing = null;
      await loadListings();
    } catch (error) {
      showFormMessage("order-message", error.message, "error");
    }
  }

  function wireDialogs() {
    document.querySelectorAll("[data-close], [data-close-dialog]").forEach((button) => {
      button.addEventListener("click", () => closeDialog(button.dataset.closeDialog));
    });

    $("login-button")?.addEventListener("click", () => {
      showFormMessage("login-message", "");
      openDialog("login-dialog");
    });

    $("logout-button")?.addEventListener("click", () => {
      state.token = "";
      state.user = null;
      sessionStorage.removeItem("kv_market_token");
      sessionStorage.removeItem("kv_market_user");
      updateAccount();
      showMessage("You have signed out.", "success");
    });

    $("show-register")?.addEventListener("click", () => {
      closeDialog("login-dialog");
      showFormMessage("register-message", "");
      openDialog("register-dialog");
    });

    $("show-login")?.addEventListener("click", () => {
      closeDialog("register-dialog");
      showFormMessage("login-message", "");
      openDialog("login-dialog");
    });

    $("login-form")?.addEventListener("submit", submitLogin);
    $("register-form")?.addEventListener("submit", submitRegister);
    $("order-form")?.addEventListener("submit", submitOrder);
    $("order-quantity")?.addEventListener("input", updateOrderTotal);
    $("refresh-button")?.addEventListener("click", loadListings);
  }

  function init() {
    updateAccount();
    wireDialogs();

    ["search-input", "state-filter", "location-filter", "quality-filter", "sort-filter"]
      .forEach((id) => $(id)?.addEventListener("input", renderListings));

    loadListings();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
