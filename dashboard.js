/* Usage Tracker - Dashboard */
(function () {
  const STORAGE_KEY_LEGACY = "usageTracker";
  const STORAGE_KEY_USAGE = "usageTracker_usage";
  const STORAGE_KEY_UI = "usageTracker_ui";

  function toDateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
  }

  function formatSeconds(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0m";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (h > 0) parts.push(h + "h");
    if (m > 0) parts.push(m + "m");
    if (s > 0 && h === 0) parts.push(s + "s");
    return parts.length ? parts.join(" ") : "0m";
  }

  function formatRelativeTime(ms) {
    const diffSec = Math.floor((Date.now() - ms) / 1000);
    if (diffSec < 10) return "just now";
    if (diffSec < 60) return "less than 1 min ago";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return "1 min ago";
    if (diffMin < 60) return diffMin + " min ago";
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr === 1) return "1 hour ago";
    if (diffHr < 24) return diffHr + " hours ago";
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return "1 day ago";
    return diffDay + " days ago";
  }

  function formatDateForDisplay(dateKey) {
    const p = dateKey.split("-").map(Number);
    const d = new Date(p[0], p[1] - 1, p[2]);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  function emptyUsage() {
    return { youtube: {}, instagram: {}, strava: {} };
  }

  function sanitizeUsage(usage) {
    if (!usage || typeof usage !== "object") return emptyUsage();
    const out = emptyUsage();
    for (const site of ["youtube", "instagram", "strava"]) {
      const s = usage[site];
      if (s && typeof s === "object") {
        for (const [k, v] of Object.entries(s)) {
          if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[site][k] = v;
        }
      }
    }
    return out;
  }

  function parseUsageStorage(raw) {
    if (!raw || typeof raw !== "object") return { usage: emptyUsage(), lastUpdated: 0 };
    if (raw.usage && typeof raw.usage === "object") return { usage: sanitizeUsage(raw.usage), lastUpdated: typeof raw.lastUpdated === "number" ? raw.lastUpdated : 0 };
    return { usage: sanitizeUsage(raw), lastUpdated: 0 };
  }

  function sanitizeCaps(caps) {
    if (!caps || typeof caps !== "object") return { youtube: null, instagram: null, strava: null };
    const out = { youtube: null, instagram: null, strava: null };
    for (const site of ["youtube", "instagram", "strava"]) {
      const v = caps[site];
      if (v == null) continue;
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n >= 0) out[site] = Math.round(n);
    }
    return out;
  }

  async function getStorageData() {
    const result = await chrome.storage.local.get([STORAGE_KEY_LEGACY, STORAGE_KEY_USAGE, STORAGE_KEY_UI]);
    const legacy = result[STORAGE_KEY_LEGACY];
    if (legacy && typeof legacy === "object") {
      await chrome.storage.local.set({
        [STORAGE_KEY_USAGE]: { usage: sanitizeUsage(legacy.usage), lastUpdated: Date.now() },
        [STORAGE_KEY_UI]: { bubbleHidden: Boolean(legacy.bubbleHidden), bubblePosition: "top-right", snoozeUntil: 0, weeklyCaps: { youtube: null, instagram: null, strava: null }, hintDismissed: true }
      });
      await chrome.storage.local.remove(STORAGE_KEY_LEGACY);
      return getStorageData();
    }
    const { usage, lastUpdated } = parseUsageStorage(result[STORAGE_KEY_USAGE]);
    const ui = result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object" ? result[STORAGE_KEY_UI] : {};
    const pos = ["top-right", "top-left", "bottom-right", "bottom-left"].includes(ui.bubblePosition) ? ui.bubblePosition : "top-right";
    return {
      usage,
      lastUpdated,
      bubbleHidden: Boolean(ui.bubbleHidden),
      bubblePosition: pos,
      weeklyCaps: sanitizeCaps(ui.weeklyCaps)
    };
  }

  async function setBubbleHidden(hidden) {
    const result = await chrome.storage.local.get(STORAGE_KEY_UI);
    const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object") ? result[STORAGE_KEY_UI] : {};
    ui.bubbleHidden = hidden;
    if (!hidden) ui.snoozeUntil = 0;
    await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
  }

  async function setBubblePosition(position) {
    const result = await chrome.storage.local.get(STORAGE_KEY_UI);
    const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object") ? result[STORAGE_KEY_UI] : {};
    ui.bubblePosition = position;
    await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
  }

  async function setSnoozeUntil(ms) {
    const result = await chrome.storage.local.get(STORAGE_KEY_UI);
    const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object") ? result[STORAGE_KEY_UI] : {};
    ui.snoozeUntil = ms;
    ui.bubbleHidden = true;
    await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
  }

  async function setWeeklyCaps(caps) {
    const result = await chrome.storage.local.get(STORAGE_KEY_UI);
    const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object") ? result[STORAGE_KEY_UI] : {};
    ui.weeklyCaps = sanitizeCaps(caps);
    await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
  }

  function sumRange(usage, siteKey, days) {
    let total = 0;
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      total += usage[siteKey]?.[toDateKey(d)] || 0;
    }
    return total;
  }

  function getChartSeries(usage, days) {
    const result = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = toDateKey(d);
      const youtube = usage.youtube?.[key] || 0;
      const instagram = usage.instagram?.[key] || 0;
      const strava = usage.strava?.[key] || 0;
      result.push({ date: key, total: youtube + instagram + strava, youtube, instagram, strava });
    }
    return result;
  }

  const SITE_NAMES = { youtube: "YouTube", instagram: "Instagram", strava: "Strava" };
  const COLORS = { youtube: "#ff4444", instagram: "#e1306c", strava: "#fc4c02" };
  const POSITION_OPTIONS = [{ value: "top-right", label: "Top right" }, { value: "top-left", label: "Top left" }, { value: "bottom-right", label: "Bottom right" }, { value: "bottom-left", label: "Bottom left" }];

  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (k === "className") e.className = v;
        else if (k === "htmlFor") e.setAttribute("for", String(v));
        else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
        else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "checked") e.checked = v;
        else if (v != null && k !== "htmlFor") e.setAttribute(k, String(v));
      }
    }
    if (children) children.forEach(function (c) {
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    });
    return e;
  }

  function renderChart(data, height, tooltipRef) {
    if (!data.length) return document.createElement("div");
    const maxTotal = Math.max.apply(Math, data.map(function (d) { return d.total; }).concat(1));
    const container = el("div", { className: "ut-chart-container" });
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 " + height);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.className = "ut-chart";
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Usage over time bar chart");
    const gap = 2;
    data.forEach(function (d, i) {
      const x = i / data.length * 100;
      let y = height;
      const parts = [];
      if (d.youtube > 0) parts.push({ h: d.youtube / maxTotal * height, fill: COLORS.youtube });
      if (d.instagram > 0) parts.push({ h: d.instagram / maxTotal * height, fill: COLORS.instagram });
      if (d.strava > 0) parts.push({ h: d.strava / maxTotal * height, fill: COLORS.strava });
      const barW = Math.max(1, 100 / data.length - gap);
      const hit = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      hit.setAttribute("x", x + gap / 2);
      hit.setAttribute("y", 0);
      hit.setAttribute("width", barW);
      hit.setAttribute("height", height);
      hit.setAttribute("fill", "transparent");
      hit.className = "ut-chart-bar-hit";
      hit.setAttribute("tabindex", "0");
      const label = formatDateForDisplay(d.date) + ": " + formatSeconds(d.total) + " total. YouTube " + formatSeconds(d.youtube) + ", Instagram " + formatSeconds(d.instagram) + ", Strava " + formatSeconds(d.strava);
      hit.setAttribute("title", label);
      hit.setAttribute("aria-label", label);
      hit.onmouseenter = function () { if (tooltipRef.current) { tooltipRef.current.textContent = label; tooltipRef.current.style.display = "block"; } };
      hit.onmouseleave = function () { if (tooltipRef.current) tooltipRef.current.style.display = "none"; };
      hit.onfocus = function () { if (tooltipRef.current) { tooltipRef.current.textContent = label; tooltipRef.current.style.display = "block"; } };
      hit.onblur = function () { if (tooltipRef.current) tooltipRef.current.style.display = "none"; };
      svg.appendChild(hit);
      parts.forEach(function (p) {
        y -= p.h;
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x + gap / 2);
        rect.setAttribute("y", y);
        rect.setAttribute("width", barW);
        rect.setAttribute("height", Math.max(0.5, p.h));
        rect.setAttribute("fill", p.fill);
        rect.setAttribute("rx", 1);
        svg.appendChild(rect);
      });
    });
    container.appendChild(svg);
    const tt = el("div", { className: "ut-chart-tooltip", role: "tooltip", id: "ut-chart-tooltip" });
    tt.style.display = "none";
    container.appendChild(tt);
    tooltipRef.current = tt;
    return container;
  }

  let tooltipRef = { current: null };

  function renderDashboard(data) {
    const today = toDateKey(new Date());
    const todayTotal = (data.usage.youtube?.[today] || 0) + (data.usage.instagram?.[today] || 0) + (data.usage.strava?.[today] || 0);
    const weekTotal = sumRange(data.usage, "youtube", 7) + sumRange(data.usage, "instagram", 7) + sumRange(data.usage, "strava", 7);
    const monthTotal = sumRange(data.usage, "youtube", 30) + sumRange(data.usage, "instagram", 30) + sumRange(data.usage, "strava", 30);
    const period = parseInt(window._utPeriod || "7", 10) || 7;
    const series = getChartSeries(data.usage, period);
    const hasAnyUsage = weekTotal > 0 || monthTotal > 0 || todayTotal > 0;

    const capsExceeded = [];
    for (const site of ["youtube", "instagram", "strava"]) {
      const cap = data.weeklyCaps[site];
      if (cap != null && cap > 0 && sumRange(data.usage, site, 7) >= cap * 60) capsExceeded.push(site);
    }

    const frag = document.createDocumentFragment();

    const header = el("header", { className: "ut-dash-header" });
    header.appendChild(el("h1", null, ["Usage Tracker"]));
    const actions = el("div", { className: "ut-dash-header-actions" });
    const bubbleLabel = el("label", { className: "ut-dash-bubble-toggle" });
    const bubbleCb = el("input", { type: "checkbox", checked: !data.bubbleHidden });
    bubbleCb.onchange = function () { setBubbleHidden(!bubbleCb.checked).then(refresh); };
    bubbleLabel.appendChild(bubbleCb);
    bubbleLabel.appendChild(el("span", { id: "ut-dash-bubble-desc" }, ["Show bubble on sites"]));
    actions.appendChild(bubbleLabel);
    const snoozeBtn = el("button", { type: "button", className: "ut-dash-snooze-btn" }, ["Snooze bubble 1h"]);
    snoozeBtn.onclick = function () { setSnoozeUntil(Date.now() + 3600000).then(refresh); };
    snoozeBtn.setAttribute("aria-label", "Snooze bubble for 1 hour");
    actions.appendChild(snoozeBtn);
    header.appendChild(actions);
    frag.appendChild(header);

    if (data.lastUpdated > 0) {
      const freshness = el("p", { className: "ut-dash-freshness", "aria-live": "polite" }, ["Last updated " + formatRelativeTime(data.lastUpdated)]);
      frag.appendChild(freshness);
    }

    const summary = el("section", { className: "ut-dash-summary" });
    const todayStat = el("div", { className: "ut-dash-stat" }, [
      el("span", { className: "ut-dash-stat-label" }, ["Today"]),
      el("span", { className: "ut-dash-stat-value" }, [formatSeconds(todayTotal)])
    ]);
    if (todayTotal === 0) todayStat.appendChild(el("span", { className: "ut-dash-stat-empty" }, ["No usage yet today"]));
    summary.appendChild(todayStat);
    summary.appendChild(el("div", { className: "ut-dash-stat" }, [
      el("span", { className: "ut-dash-stat-label" }, ["This week"]),
      el("span", { className: "ut-dash-stat-value" }, [formatSeconds(weekTotal)])
    ]));
    summary.appendChild(el("div", { className: "ut-dash-stat" }, [
      el("span", { className: "ut-dash-stat-label" }, ["This month"]),
      el("span", { className: "ut-dash-stat-value" }, [formatSeconds(monthTotal)])
    ]));
    frag.appendChild(summary);

    const chartSec = el("section", { className: "ut-dash-chart-section" });
    const periodDiv = el("div", { className: "ut-dash-period" });
    const btn7 = el("button", { type: "button", className: "ut-dash-period-btn" + (period === 7 ? " active" : "") }, ["7 days"]);
    const btn30 = el("button", { type: "button", className: "ut-dash-period-btn" + (period === 30 ? " active" : "") }, ["30 days"]);
    btn7.onclick = function () { window._utPeriod = "7"; refresh(); };
    btn30.onclick = function () { window._utPeriod = "30"; refresh(); };
    btn7.setAttribute("aria-pressed", period === 7);
    btn30.setAttribute("aria-pressed", period === 30);
    btn7.setAttribute("aria-label", "Show 7 days");
    btn30.setAttribute("aria-label", "Show 30 days");
    periodDiv.appendChild(btn7);
    periodDiv.appendChild(btn30);
    chartSec.appendChild(periodDiv);
    const chartWrap = el("div", { className: "ut-dash-chart-wrap" });
    if (hasAnyUsage) {
      chartWrap.appendChild(renderChart(series, 180, tooltipRef));
    } else {
      const empty = el("div", { className: "ut-dash-empty", role: "status" });
      empty.appendChild(el("p", { className: "ut-dash-empty-title" }, ["No usage yet for this period"]));
      empty.appendChild(el("p", { className: "ut-dash-empty-hint" }, ["Use supported sites (YouTube, Instagram, Strava) and we'll track automatically."]));
      chartWrap.appendChild(empty);
    }
    chartSec.appendChild(chartWrap);
    chartSec.appendChild(el("div", { className: "ut-dash-legend" }, [
      el("span", { className: "ut-dash-legend-item", style: { color: "#ff4444" } }, ["YouTube"]),
      el("span", { className: "ut-dash-legend-item", style: { color: "#e1306c" } }, ["Instagram"]),
      el("span", { className: "ut-dash-legend-item", style: { color: "#fc4c02" } }, ["Strava"])
    ]));
    frag.appendChild(chartSec);

    const breakdown = el("section", { className: "ut-dash-breakdown" });
    breakdown.appendChild(el("h2", null, ["By site"]));
    const ul = el("ul", { className: "ut-dash-breakdown-list" });
    ["youtube", "instagram", "strava"].forEach(function (site) {
      const total = sumRange(data.usage, site, period);
      const exceeded = capsExceeded.indexOf(site) >= 0;
      ul.appendChild(el("li", { className: "ut-dash-breakdown-item" + (exceeded ? " ut-dash-breakdown-over" : "") }, [
        el("span", null, [SITE_NAMES[site] + (exceeded ? " (over cap)" : "")]),
        el("span", null, [formatSeconds(total)])
      ]));
    });
    breakdown.appendChild(ul);
    frag.appendChild(breakdown);

    const settings = el("section", { className: "ut-dash-settings", "aria-labelledby": "ut-settings-heading" });
    settings.appendChild(el("h2", { id: "ut-settings-heading" }, ["Settings"]));
    const posDiv = el("div", { className: "ut-dash-setting" });
    posDiv.appendChild(el("label", { htmlFor: "ut-bubble-position" }, ["Bubble position"]));
    const posSelect = el("select", { id: "ut-bubble-position", "aria-describedby": "ut-bubble-position-desc" });
    POSITION_OPTIONS.forEach(function (o) {
      const opt = document.createElement("option");
      opt.value = o.value;
      opt.textContent = o.label;
      if (data.bubblePosition === o.value) opt.selected = true;
      posSelect.appendChild(opt);
    });
    posSelect.onchange = function () { setBubblePosition(posSelect.value).then(refresh); };
    posDiv.appendChild(posSelect);
    posDiv.appendChild(el("span", { id: "ut-bubble-position-desc", className: "ut-dash-setting-desc" }, ["Where the floating bubble appears on supported sites"]));
    settings.appendChild(posDiv);
    const capsDiv = el("div", { className: "ut-dash-setting" });
    capsDiv.appendChild(el("h3", null, ["Weekly caps (warnings only)"]));
    capsDiv.appendChild(el("p", { className: "ut-dash-setting-desc" }, ["Set a cap per site to get warnings when exceeded. No blocking."]));
    ["youtube", "instagram", "strava"].forEach(function (site) {
      const cap = data.weeklyCaps[site];
      const row = el("div", { className: "ut-dash-cap-row" });
      row.appendChild(el("label", { htmlFor: "ut-cap-" + site }, [SITE_NAMES[site]]));
      const input = el("input", { id: "ut-cap-" + site, type: "number", min: 0, placeholder: "Off" });
      input.value = cap != null && cap > 0 ? String(cap) : "";
      input.setAttribute("aria-label", SITE_NAMES[site] + " weekly cap in minutes");
      input.onchange = function () {
        const v = input.value ? parseInt(input.value, 10) : null;
        const next = { youtube: data.weeklyCaps.youtube, instagram: data.weeklyCaps.instagram, strava: data.weeklyCaps.strava };
        next[site] = v != null && v >= 0 ? v : null;
        setWeeklyCaps(next).then(refresh);
      };
      row.appendChild(input);
      row.appendChild(el("span", { className: "ut-dash-cap-unit" }, ["min/week"]));
      capsDiv.appendChild(row);
    });
    settings.appendChild(capsDiv);
    frag.appendChild(settings);

    return frag;
  }

  function refresh() {
    const root = document.getElementById("root");
    if (!root) return;
    getStorageData().then(function (data) {
      root.innerHTML = "";
      root.appendChild(renderDashboard(data));
    });
  }

  const root = document.getElementById("root");
  if (!root) return;

  root.appendChild(el("div", { className: "ut-dash-loading" }, ["Loading…"]));

  getStorageData().then(function (data) {
    root.innerHTML = "";
    root.appendChild(renderDashboard(data));
  });

  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area !== "local") return;
    if (changes[STORAGE_KEY_USAGE] || changes[STORAGE_KEY_UI] || changes[STORAGE_KEY_LEGACY]) refresh();
  });
})();
