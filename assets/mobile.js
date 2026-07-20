(function () {
  "use strict";

  const icons = {
    logo: '<svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="13" cy="20" r="9" stroke="currentColor" stroke-width="2.4"/><circle cx="27" cy="20" r="9" stroke="currentColor" stroke-width="2.4"/><path d="M22.5 18.5c0-1.8 1-3 2.7-3M3 19c1-2.4 2.4-3.4 3.8-3.4" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.4"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 20c.2-2.7 1.8-4.4 3.8-4.9"/></svg>',
    sale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18l-1.6 10.4a2 2 0 0 1-2 1.6H6.6a2 2 0 0 1-2-1.6L3 6z"/><path d="M8 6a4 4 0 0 1 8 0"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M11 20V4M18 20v-7"/></svg>',
    search: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
    bell: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    plus: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 5v14M5 12h14"/></svg>',
    rx: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="7.5" cy="12" r="4"/><circle cx="16.5" cy="12" r="4"/><path d="M11.3 11c0-1.3.8-2.2 2-2.2M3 11.5c.7-1.5 1.6-2.2 2.7-2.4"/></svg>',
    moon: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2z"/></svg>'
  };

  const mobileViews = [
    ["dashboard", "Panel", icons.home],
    ["customers", "Müşteriler", icons.users],
    ["sales", "Satışlar", icons.sale],
    ["inventory", "Stok", icons.box],
    ["reports", "Raporlar", icons.chart]
  ];

  const contextActions = {
    dashboard: ["sale", "Yeni satış", icons.sale],
    customers: ["customer", "Yeni müşteri", icons.users],
    prescriptions: ["rx", "Yeni reçete", icons.rx],
    sales: ["sale", "Yeni satış", icons.sale],
    inventory: ["product", "Yeni ürün", icons.box]
  };

  let viewportBaselineHeight = Math.max(window.innerHeight, document.documentElement.clientHeight);
  let viewportBaselineWidth = window.innerWidth;

  function createMobileShell() {
    const appbar = document.createElement("header");
    appbar.className = "mobile-appbar";
    appbar.setAttribute("aria-label", "Mobil uygulama başlığı");
    appbar.innerHTML = `
      <button class="mobile-brand" id="mobileBrand" type="button" aria-label="Panele dön" style="border:0;background:none;padding:0;text-align:left;color:inherit">
        <span class="mobile-logo">${icons.logo}</span>
        <span class="mobile-title"><strong id="mobileStoreName">Kaner Optik</strong><span id="mobileViewName">Panel</span></span>
      </button>
      <div class="mobile-app-actions">
        <button class="mobile-icon-btn" id="mobileTheme" type="button" aria-label="Temayı değiştir">${icons.moon}</button>
        <button class="mobile-icon-btn" id="mobileSearch" type="button" aria-label="Hızlı arama">${icons.search}</button>
        <button class="mobile-icon-btn" id="mobileAlerts" type="button" aria-label="Bildirimler">${icons.bell}<span class="mobile-alert-dot" id="mobileAlertDot"></span></button>
      </div>`;

    const nav = document.createElement("nav");
    nav.className = "mobile-bottom-nav";
    nav.setAttribute("aria-label", "Ana navigasyon");
    nav.innerHTML = mobileViews.map(([view, label, icon]) =>
      `<button class="mobile-nav-item" type="button" data-mobile-view="${view}" aria-label="${label}">${icon}<span>${label}</span></button>`
    ).join("");

    const fab = document.createElement("button");
    fab.className = "mobile-fab";
    fab.id = "mobileFab";
    fab.type = "button";
    fab.setAttribute("aria-label", "Hızlı işlem ekle");
    fab.innerHTML = icons.plus;

    const sheet = document.createElement("div");
    sheet.className = "quick-sheet-overlay";
    sheet.id = "quickSheet";
    sheet.setAttribute("aria-hidden", "true");
    sheet.innerHTML = `
      <section class="quick-sheet" role="dialog" aria-modal="true" aria-labelledby="quickSheetTitle">
        <div class="sheet-handle"></div>
        <h2 id="quickSheetTitle">Hızlı işlem</h2>
        <p>Sık kullanılan işlemlerden birini seçin.</p>
        <div class="quick-actions">
          ${quickActionHTML("customer", icons.users, "Yeni müşteri", "Kişi ve iletişim bilgileri")}
          ${quickActionHTML("sale", icons.sale, "Yeni satış", "Ürün ve tahsilat kaydı")}
          ${quickActionHTML("rx", icons.rx, "Yeni reçete", "Göz ölçümü ve doktor")}
          ${quickActionHTML("product", icons.box, "Yeni ürün", "Stok kartı oluştur")}
        </div>
      </section>`;

    const status = document.createElement("div");
    status.className = "connectivity-pill";
    status.id = "connectivityPill";
    status.setAttribute("role", "status");

    document.body.append(appbar, nav, fab, sheet, status);

    appbar.querySelector("#mobileBrand").addEventListener("click", () => { touchFeedback(); navigate("dashboard"); });
    appbar.querySelector("#mobileSearch").addEventListener("click", () => { touchFeedback(); openCmdk(); });
    appbar.querySelector("#mobileAlerts").addEventListener("click", () => { touchFeedback(); openMobileAlerts(); });
    appbar.querySelector("#mobileTheme").addEventListener("click", () => { touchFeedback(); toggleTheme(); });
    nav.querySelectorAll("[data-mobile-view]").forEach(button => {
      button.addEventListener("click", () => { touchFeedback(); navigate(button.dataset.mobileView); });
    });
    fab.addEventListener("click", () => { touchFeedback(); toggleQuickSheet(true); });
    sheet.addEventListener("click", event => {
      if (event.target === sheet) toggleQuickSheet(false);
      const action = event.target.closest("[data-quick]");
      if (action) runQuickAction(action.dataset.quick);
    });
  }

  function quickActionHTML(action, icon, title, description) {
    return `<button class="quick-action" type="button" data-quick="${action}">${icon}<span><strong>${title}</strong><small>${description}</small></span></button>`;
  }

  function touchFeedback() {
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function toggleQuickSheet(open) {
    const sheet = document.getElementById("quickSheet");
    sheet.classList.toggle("open", open);
    sheet.setAttribute("aria-hidden", String(!open));
    document.getElementById("mobileFab").setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
    const app = document.querySelector(".app");
    if (app && "inert" in app) app.inert = open;
    if (open) setTimeout(() => sheet.querySelector(".quick-action, .alert-item, [data-sheet-close]")?.focus(), 180);
    else document.getElementById("mobileFab")?.focus({preventScroll:true});
  }

  function runQuickAction(action) {
    touchFeedback();
    toggleQuickSheet(false);
    if (action === "customer") openCustomerForm();
    if (action === "sale") openSaleForm();
    if (action === "rx") openRxForm();
    if (action === "product") openProductForm();
  }

  function openMobileAlerts() {
    const alerts = computeAlerts();
    const sheet = document.getElementById("quickSheet");
    const panel = sheet.querySelector(".quick-sheet");
    panel.innerHTML = `
      <div class="sheet-handle"></div>
      <h2>Bildirimler</h2>
      <p>${alerts.length ? alerts.length + " kayıt ilginizi bekliyor." : "Her şey yolunda görünüyor."}</p>
      <div class="stack-8">
        ${alerts.length ? alerts.map((alert, index) => `
          <button class="alert-item" type="button" data-mobile-alert="${index}" style="border:1px solid var(--mist);border-radius:13px;background:var(--paper)">
            <div class="alert-icon ${alert.type}">${alert.type === "warn" ? icons.box : alert.type === "info" ? icons.rx : icons.bell}</div>
            <div class="alert-text"><strong>${escapeHTML(alert.title)}</strong>${escapeHTML(alert.text)}</div>
          </button>`).join("") : `<button class="btn btn-primary" type="button" data-sheet-close>Panele dön</button>`}
      </div>`;
    panel.querySelectorAll("[data-mobile-alert]").forEach(button => {
      button.addEventListener("click", () => {
        const alert = alerts[Number(button.dataset.mobileAlert)];
        toggleQuickSheet(false);
        alert.onClick();
        restoreQuickSheet();
      });
    });
    const close = panel.querySelector("[data-sheet-close]");
    if (close) close.addEventListener("click", () => {
      toggleQuickSheet(false);
      restoreQuickSheet();
    });
    toggleQuickSheet(true);
  }

  function restoreQuickSheet() {
    setTimeout(() => {
      const panel = document.querySelector("#quickSheet .quick-sheet");
      panel.innerHTML = `
        <div class="sheet-handle"></div><h2 id="quickSheetTitle">Hızlı işlem</h2>
        <p>Sık kullanılan işlemlerden birini seçin.</p>
        <div class="quick-actions">
          ${quickActionHTML("customer", icons.users, "Yeni müşteri", "Kişi ve iletişim bilgileri")}
          ${quickActionHTML("sale", icons.sale, "Yeni satış", "Ürün ve tahsilat kaydı")}
          ${quickActionHTML("rx", icons.rx, "Yeni reçete", "Göz ölçümü ve doktor")}
          ${quickActionHTML("product", icons.box, "Yeni ürün", "Stok kartı oluştur")}
        </div>`;
    }, 240);
  }

  function applyTheme() {
    const isDark = localStorage.getItem("kaneroptik_theme") === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    document.querySelector('meta[name="theme-color"]').content = isDark ? "#10191c" : "#0b3b43";
  }

  function toggleTheme() {
    const dark = !document.body.classList.contains("dark-mode");
    localStorage.setItem("kaneroptik_theme", dark ? "dark" : "light");
    applyTheme();
    showToast(dark ? "Koyu tema açıldı." : "Açık tema açıldı.", "success");
  }

  function syncMobileShell() {
    const currentRoot = currentView === "customerDetail" ? "customers" : currentView;
    document.querySelectorAll("[data-mobile-view]").forEach(item => {
      const active = item.dataset.mobileView === currentRoot;
      item.classList.toggle("active", active);
      if (active) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    const viewLabel = document.getElementById("mobileViewName");
    if (viewLabel) viewLabel.textContent = (VIEW_META[currentView] || VIEW_META.dashboard).title;
    const storeLabel = document.getElementById("mobileStoreName");
    if (storeLabel && DB && DB.settings) storeLabel.textContent = DB.settings.magazaAdi || "Kaner Optik";
    const dot = document.getElementById("mobileAlertDot");
    if (dot) dot.hidden = computeAlerts().length === 0;
    enhanceMobileHeading();
    enhanceTables();
  }

  function mobileSummary(view) {
    if (view === "dashboard") return `${DB.customers.length} müşteri · ${DB.sales.length} satış`;
    if (view === "customers") return `${DB.customers.length} kayıt`;
    if (view === "prescriptions") return `${DB.prescriptions.length} reçete`;
    if (view === "sales") return `${DB.sales.length} satış işlemi`;
    if (view === "inventory") return `${DB.products.reduce((sum, item) => sum + (Number(item.stok) || 0), 0)} ürün stokta`;
    if (view === "reports") return "Satış ve performans görünümü";
    return (VIEW_META[view] || VIEW_META.dashboard).subtitle;
  }

  function enhanceMobileHeading() {
    const container = document.getElementById("viewContainer");
    if (!container || container.querySelector(":scope > .mobile-view-heading")) return;
    const meta = VIEW_META[currentView] || VIEW_META.dashboard;
    const action = contextActions[currentView];
    const heading = document.createElement("section");
    heading.className = "mobile-view-heading";
    heading.innerHTML = `
      <div class="mobile-view-copy">
        <span class="mobile-view-eyebrow">${mobileSummary(currentView)}</span>
        <h1>${escapeHTML(meta.title)}</h1>
        <p>${escapeHTML(meta.subtitle || "Kaner Optik çalışma alanı")}</p>
      </div>
      ${action ? `<button class="mobile-context-action" type="button" data-context-action="${action[0]}">${action[2]}<span>${action[1]}</span></button>` : ""}`;
    container.prepend(heading);
    heading.querySelector("[data-context-action]")?.addEventListener("click", event => runQuickAction(event.currentTarget.dataset.contextAction));
  }

  function enhanceTables() {
    document.querySelectorAll("#viewContainer .table-wrap").forEach(wrap => {
      const table = wrap.querySelector("table");
      if (!table) return;
      wrap.classList.add("mobile-table");
      const labels = Array.from(table.querySelectorAll("thead th")).map(th => th.textContent.trim().replace(/[▲▼]/g, ""));
      table.querySelectorAll("tbody tr").forEach(row => {
        const cells = Array.from(row.children);
        row.classList.add("mobile-card-row");
        cells.forEach((cell, index) => {
          if (!cell.dataset.label && labels[index]) cell.dataset.label = labels[index];
          cell.classList.toggle("mobile-cell-primary", index === 0);
          cell.classList.toggle("mobile-cell-trailing", index === cells.length - 1);
          if (index > 0 && index < cells.length - 1) cell.classList.add("mobile-cell-meta");
        });
      });
    });
    document.querySelectorAll("button.btn-icon:not([aria-label])").forEach(button => {
      button.setAttribute("aria-label", button.title || "İşlem");
    });
  }

  function updateConnectivity() {
    const pill = document.getElementById("connectivityPill");
    const online = navigator.onLine;
    pill.textContent = online ? "Çevrimiçi" : "Çevrimdışı · veriler cihazda güvende";
    pill.classList.toggle("offline", !online);
    pill.classList.add("show");
    window.clearTimeout(updateConnectivity.timeout);
    updateConnectivity.timeout = window.setTimeout(() => pill.classList.remove("show"), online ? 1800 : 5000);
  }

  function syncVisualViewport() {
    const viewport = window.visualViewport;
    const visibleHeight = viewport ? viewport.height : window.innerHeight;
    const offsetTop = viewport ? viewport.offsetTop : 0;
    if (Math.abs(window.innerWidth - viewportBaselineWidth) > 80) {
      viewportBaselineWidth = window.innerWidth;
      viewportBaselineHeight = Math.max(window.innerHeight, document.documentElement.clientHeight, visibleHeight + offsetTop);
    }
    const layoutHeight = Math.max(viewportBaselineHeight, document.documentElement.clientHeight, window.innerHeight);
    const keyboardHeight = Math.max(0, layoutHeight - visibleHeight - offsetTop);
    if (keyboardHeight < 120) viewportBaselineHeight = Math.max(layoutHeight, visibleHeight + offsetTop);
    document.documentElement.style.setProperty("--visual-viewport-height", `${Math.round(visibleHeight)}px`);
    document.documentElement.style.setProperty("--visual-viewport-offset", `${Math.round(offsetTop)}px`);
    document.documentElement.style.setProperty("--keyboard-height", `${Math.round(keyboardHeight)}px`);
    document.body.classList.toggle("keyboard-open", keyboardHeight > 140);
  }

  createMobileShell();
  applyTheme();

  const coreNavigate = navigate;
  navigate = function (view, params) {
    coreNavigate(view, params);
    syncMobileShell();
  };

  const coreRender = render;
  render = function () {
    coreRender();
    syncMobileShell();
  };

  const coreUpdateSidebarBrand = updateSidebarBrand;
  updateSidebarBrand = function () {
    coreUpdateSidebarBrand();
    syncMobileShell();
  };

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.getElementById("quickSheet").classList.contains("open")) {
      toggleQuickSheet(false);
      restoreQuickSheet();
    }
  });
  window.addEventListener("online", updateConnectivity);
  window.addEventListener("offline", updateConnectivity);
  window.addEventListener("resize", syncMobileShell, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(() => { syncVisualViewport(); syncMobileShell(); }, 120), {passive:true});
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", syncVisualViewport, {passive:true});
    window.visualViewport.addEventListener("scroll", syncVisualViewport, {passive:true});
  }

  syncVisualViewport();
  syncMobileShell();
  updateConnectivity();

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
})();
