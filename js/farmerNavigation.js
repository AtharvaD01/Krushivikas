(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    const main = document.querySelector(".farmer-main");
    const hero = main && main.querySelector(".hero");
    const dashboard = main && main.querySelector(".dashboard-section");

    if (!main || !hero || !dashboard || document.querySelector(".farmer-app-shell")) return;

    const heading = dashboard.querySelector(".section-heading");
    const message = dashboard.querySelector("#portal-message");
    const grid = dashboard.querySelector(".dashboard-grid");
    const advisory = dashboard.querySelector("#farmer-advisory-section");
    const profilePanel = dashboard.querySelector("#farm-profile-panel");
    const farmManagement = dashboard.querySelector("#farm-management-section");
    const prices = dashboard.querySelector("#farmer-price-section");
    const disease = dashboard.querySelector("#farmer-disease-section");
    const tracking = dashboard.querySelector("#farmer-tracking")?.closest(".panel");

    if (!heading || !message || !grid || !advisory || !prices || !disease || !tracking) {
      console.error("Farmer navigation: required existing sections were not found.");
      return;
    }

    const originalSections = [hero, dashboard];
    const shell = document.createElement("div");
    shell.className = "farmer-app-shell";

    const sidebar = document.createElement("aside");
    sidebar.className = "farmer-sidebar";
    sidebar.setAttribute("aria-label", "Farmer portal navigation");

    sidebar.innerHTML = `
      <div class="farmer-sidebar-brand">
        <span class="brand-mark">◈</span>
        <div><strong>KRUSHIVIKAS</strong><small>GROWER WORKSPACE</small></div>
      </div>
      <div class="farmer-sidebar-label">WORKSPACE</div>
      <nav class="farmer-side-nav">
        <button class="farmer-nav-item active" data-view="overview"><span>⌂</span> Overview</button>
        <button class="farmer-nav-item" data-view="farm"><span>♧</span> My Farm</button>
        <button class="farmer-nav-item" data-view="advisory"><span>✳</span> Crop Advisory</button>
        <button class="farmer-nav-item" data-view="health"><span>⌁</span> Crop Health</button>
        <button class="farmer-nav-item" data-view="market"><span>↗</span> Market Intelligence</button>
        <button class="farmer-nav-item" data-view="listings"><span>▤</span> My Listings</button>
        <button class="farmer-nav-item" data-view="orders"><span>⇄</span> Orders & Fulfilment</button>
        <button class="farmer-nav-item" data-view="logistics"><span>⌖</span> Supply Chain</button>
      </nav>
      <div class="farmer-sidebar-bottom">
        <span class="status-dot"></span>
        <div><strong>FARMER WORKSPACE</strong><small>Operational dashboard</small></div>
      </div>`;

    const workspace = document.createElement("div");
    workspace.className = "farmer-workspace";

    const topbar = document.createElement("div");
    topbar.className = "farmer-workspace-topbar";
    topbar.innerHTML = `
      <div>
        <span class="farmer-breadcrumb">WORKSPACE <span>/</span> <strong id="farmer-current-view">OVERVIEW</strong></span>
        <h2 id="farmer-view-title">Your farm at a glance</h2>
      </div>
      <div class="farmer-topbar-actions">
        <span class="farmer-live-label"><i></i> CONNECTED WORKSPACE</span>
        <button id="farmer-mobile-menu" class="button secondary" type="button" aria-label="Toggle navigation">☰</button>
      </div>`;

    const content = document.createElement("div");
    content.className = "farmer-view-content";

    const definitions = [
      { id: "overview", title: "Your farm at a glance", subtitle: "An overview of your operations.", nodes: [hero, heading, message, grid] },
      { id: "farm", title: "My Farm", subtitle: "Your current farm operations and field guidance.", nodes: [profilePanel, farmManagement, advisory.querySelector(".advisory-notice"), advisory.querySelector(".advisory-checklist")] },
      { id: "advisory", title: "Crop Advisory", subtitle: "Field management guidance and inspection priorities.", nodes: [advisory] },
      { id: "health", title: "Crop Health", subtitle: "Screen banana leaf images and review indicative results.", nodes: [disease] },
      { id: "market", title: "Market Intelligence", subtitle: "Historical observations and experimental estimates—not guaranteed prices.", nodes: [prices] },
      { id: "listings", title: "My Listings", subtitle: "Manage the harvest stock you offer to buyers.", nodes: [grid.querySelector(".panel:nth-child(1)")] },
      { id: "orders", title: "Orders & Fulfilment", subtitle: "Review buyer orders and manage their status.", nodes: [grid.querySelector(".panel:nth-child(2)")] },
      { id: "logistics", title: "Supply Chain", subtitle: "Follow order progress through the supply chain.", nodes: [tracking] }
    ];

    const views = {};

    definitions.forEach(function (definition) {
      const view = document.createElement("section");
      view.className = "farmer-view";
      view.id = "farmer-view-" + definition.id;
      view.dataset.view = definition.id;
      view.hidden = definition.id !== "overview";

      if (definition.id !== "overview") {
        const intro = document.createElement("div");
        intro.className = "farmer-view-intro";
        intro.innerHTML = `<p class="eyebrow">KRUSHIVIKAS / FARMER WORKSPACE</p><p>${definition.subtitle}</p>`;
        view.appendChild(intro);
      }

      definition.nodes.filter(Boolean).forEach(function (node) {
        view.appendChild(node);
      });

      content.appendChild(view);
      views[definition.id] = view;
    });

    workspace.append(topbar, content);
    shell.append(sidebar, workspace);

    originalSections.forEach(function (node) {
      node.remove();
    });

    main.replaceChildren(shell);

    const titles = {
      overview: "Your farm at a glance",
      farm: "My Farm",
      advisory: "Crop Advisory",
      health: "Crop Health",
      market: "Market Intelligence",
      listings: "My Listings",
      orders: "Orders & Fulfilment",
      logistics: "Supply Chain"
    };

    function activateView(id, updateHistory) {
      if (!views[id]) id = "overview";

      Object.entries(views).forEach(function ([key, view]) {
        view.hidden = key !== id;
      });

      sidebar.querySelectorAll("[data-view]").forEach(function (button) {
        const active = button.dataset.view === id;
        button.classList.toggle("active", active);
        button.setAttribute("aria-current", active ? "page" : "false");
      });

      document.getElementById("farmer-current-view").textContent = id.toUpperCase();
      document.getElementById("farmer-view-title").textContent = titles[id];

      sidebar.classList.remove("mobile-open");

      if (updateHistory) {
        history.replaceState(null, "", "#" + id);
      }
    }

    sidebar.querySelectorAll("[data-view]").forEach(function (button) {
      button.addEventListener("click", function () {
        activateView(button.dataset.view, true);
      });
    });

    document.getElementById("farmer-mobile-menu").addEventListener("click", function () {
      sidebar.classList.toggle("mobile-open");
    });

    window.addEventListener("hashchange", function () {
      activateView(location.hash.slice(1), false);
    });

    activateView(location.hash.slice(1) || "overview", false);
  });
})();
