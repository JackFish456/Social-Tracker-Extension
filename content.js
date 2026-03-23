/* Usage Tracker - Content Script */
(function () {
  const HOSTNAME_SUFFIXES = { "youtube.com": "youtube", "instagram.com": "instagram", "strava.com": "strava" };

  function getSiteKeyFromUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase();
      for (const [suffix, key] of Object.entries(HOSTNAME_SUFFIXES)) {
        if (host === suffix || host.endsWith("." + suffix)) return key;
      }
    } catch (_) {}
    return null;
  }

  const SITE_NAMES = { youtube: "YouTube", instagram: "Instagram", strava: "Strava" };
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

  function sanitizeUsage(usage) {
    if (!usage || typeof usage !== "object") return { youtube: {}, instagram: {}, strava: {} };
    const out = { youtube: {}, instagram: {}, strava: {} };
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

  function parseUsage(raw) {
    if (!raw || typeof raw !== "object") return { youtube: {}, instagram: {}, strava: {} };
    if (raw.usage && typeof raw.usage === "object") return sanitizeUsage(raw.usage);
    return sanitizeUsage(raw);
  }

  async function clearSnoozeIfExpired() {
    const result = await chrome.storage.local.get(STORAGE_KEY_UI);
    const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object") ? result[STORAGE_KEY_UI] : {};
    const until = typeof ui.snoozeUntil === "number" ? ui.snoozeUntil : 0;
    if (until > 0 && Date.now() >= until) {
      ui.snoozeUntil = 0;
      ui.bubbleHidden = false;
      await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
    }
  }

  async function getStorageData() {
    const result = await chrome.storage.local.get([STORAGE_KEY_LEGACY, STORAGE_KEY_USAGE, STORAGE_KEY_UI]);
    const legacy = result[STORAGE_KEY_LEGACY];
    if (legacy && typeof legacy === "object") {
      await chrome.storage.local.set({
        [STORAGE_KEY_USAGE]: { usage: sanitizeUsage(legacy.usage && typeof legacy.usage === "object" ? legacy.usage : {}), lastUpdated: Date.now() },
        [STORAGE_KEY_UI]: { bubbleHidden: Boolean(legacy.bubbleHidden), bubblePosition: "top-right", snoozeUntil: 0, weeklyCaps: { youtube: null, instagram: null, strava: null }, hintDismissed: true }
      });
      await chrome.storage.local.remove(STORAGE_KEY_LEGACY);
      return getStorageData();
    }
    const usage = parseUsage(result[STORAGE_KEY_USAGE]);
    const ui = result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object" ? result[STORAGE_KEY_UI] : {};
    const pos = ["top-right", "top-left", "bottom-right", "bottom-left"].includes(ui.bubblePosition) ? ui.bubblePosition : "top-right";
    const caps = ui.weeklyCaps && typeof ui.weeklyCaps === "object" ? ui.weeklyCaps : { youtube: null, instagram: null, strava: null };
    return {
      usage,
      bubbleHidden: Boolean(ui.bubbleHidden),
      bubblePosition: pos,
      snoozeUntil: typeof ui.snoozeUntil === "number" ? ui.snoozeUntil : 0,
      weeklyCaps: { youtube: caps.youtube, instagram: caps.instagram, strava: caps.strava },
      hintDismissed: Boolean(ui.hintDismissed)
    };
  }

  async function setBubbleHidden(hidden) {
    const result = await chrome.storage.local.get(STORAGE_KEY_UI);
    const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object") ? result[STORAGE_KEY_UI] : {};
    ui.bubbleHidden = hidden;
    if (!hidden) ui.snoozeUntil = 0;
    await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
  }

  async function setSnoozeUntil(ms) {
    const result = await chrome.storage.local.get(STORAGE_KEY_UI);
    const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object") ? result[STORAGE_KEY_UI] : {};
    ui.snoozeUntil = ms;
    ui.bubbleHidden = true;
    await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
  }

  async function setHintDismissed(dismissed) {
    const result = await chrome.storage.local.get(STORAGE_KEY_UI);
    const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object") ? result[STORAGE_KEY_UI] : {};
    ui.hintDismissed = dismissed;
    await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
  }

  function getWeekTotal(usage, siteKey) {
    let total = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      total += usage[siteKey]?.[toDateKey(d)] || 0;
    }
    return total;
  }

  function createBubble() {
    const siteKey = getSiteKeyFromUrl(window.location.href);
    if (!siteKey) return;

    const container = document.createElement("div");
    container.id = "usage-tracker-root";
    document.body.appendChild(container);

    let collapsed = true;
    let hidden = false;
    let snoozed = false;
    let todaySec = 0;
    let weekSec = 0;
    let position = "top-right";
    let weeklyCaps = { youtube: null, instagram: null, strava: null };
    let hintDismissed = true;

    function render() {
      container.innerHTML = "";
      if (hidden || snoozed) return;

      const cap = weeklyCaps[siteKey];
      const capExceeded = cap != null && cap > 0 && weekSec >= cap * 60;

      const wrapper = document.createElement("div");
      wrapper.className = "ut-bubble-wrapper ut-pos-" + position;
      wrapper.setAttribute("role", "group");
      wrapper.setAttribute("aria-label", SITE_NAMES[siteKey] + " usage tracker");

      const bubble = document.createElement("div");
      bubble.className = "ut-bubble" + (capExceeded ? " ut-bubble-cap-over" : "");

      const main = document.createElement("button");
      main.type = "button";
      main.className = "ut-bubble-main";
      main.setAttribute("aria-label", "Open dashboard. " + SITE_NAMES[siteKey] + ": " + formatSeconds(todaySec) + " today, " + formatSeconds(weekSec) + " this week");
      main.innerHTML = "<span class=\"ut-bubble-site\">" + SITE_NAMES[siteKey] + "</span>";
      if (!collapsed) {
        main.innerHTML += "<span class=\"ut-bubble-today\">" + formatSeconds(todaySec) + " today</span>";
        main.innerHTML += "<span class=\"ut-bubble-week\">" + formatSeconds(weekSec) + " this week</span>";
      }
      main.onclick = () => chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "ut-bubble-toggle";
      toggleBtn.title = collapsed ? "Expand" : "Collapse";
      toggleBtn.setAttribute("aria-label", collapsed ? "Expand" : "Collapse");
      toggleBtn.textContent = collapsed ? "\u25B8" : "\u25BE";
      toggleBtn.onclick = (e) => { e.stopPropagation(); collapsed = !collapsed; render(); };

      const snoozeBtn = document.createElement("button");
      snoozeBtn.type = "button";
      snoozeBtn.className = "ut-bubble-snooze";
      snoozeBtn.title = "Snooze bubble for 1 hour";
      snoozeBtn.setAttribute("aria-label", "Snooze bubble for 1 hour");
      snoozeBtn.textContent = "zz";
      snoozeBtn.onclick = async (e) => { e.stopPropagation(); await setSnoozeUntil(Date.now() + 3600000); snoozed = true; hidden = true; render(); };

      const hideBtn = document.createElement("button");
      hideBtn.type = "button";
      hideBtn.className = "ut-bubble-hide";
      hideBtn.title = "Hide bubble";
      hideBtn.setAttribute("aria-label", "Hide bubble");
      hideBtn.textContent = "\u00D7";
      hideBtn.onclick = async (e) => { e.stopPropagation(); hidden = true; await setBubbleHidden(true); render(); };

      bubble.appendChild(main);
      bubble.appendChild(toggleBtn);
      bubble.appendChild(snoozeBtn);
      bubble.appendChild(hideBtn);
      wrapper.appendChild(bubble);

      if (!hintDismissed) {
        const hint = document.createElement("div");
        hint.className = "ut-bubble-hint";
        hint.setAttribute("role", "status");
        hint.innerHTML = "<p>Click this bubble to open your dashboard.</p>";
        const dismissBtn = document.createElement("button");
        dismissBtn.type = "button";
        dismissBtn.className = "ut-bubble-hint-dismiss";
        dismissBtn.setAttribute("aria-label", "Dismiss hint");
        dismissBtn.textContent = "Got it";
        dismissBtn.onclick = async (e) => { e.stopPropagation(); hintDismissed = true; await setHintDismissed(true); render(); };
        hint.appendChild(dismissBtn);
        wrapper.appendChild(hint);
      }

      container.appendChild(wrapper);
    }

    async function refresh() {
      await clearSnoozeIfExpired();
      const data = await getStorageData();
      hidden = data.bubbleHidden;
      snoozed = data.snoozeUntil > 0 && Date.now() < data.snoozeUntil;
      position = data.bubblePosition;
      weeklyCaps = data.weeklyCaps || { youtube: null, instagram: null, strava: null };
      hintDismissed = data.hintDismissed;
      const today = toDateKey(new Date());
      todaySec = data.usage[siteKey]?.[today] || 0;
      weekSec = getWeekTotal(data.usage, siteKey);
      if (hidden || snoozed) {
        container.innerHTML = "";
        return;
      }
      render();
    }

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[STORAGE_KEY_USAGE] || changes[STORAGE_KEY_UI] || changes[STORAGE_KEY_LEGACY]) refresh();
    });

    refresh();
    setInterval(refresh, 60000);
  }

  function checkFullscreen() {
    const root = document.getElementById("usage-tracker-root");
    if (root) root.style.display = document.fullscreenElement ? "none" : "";
  }

  document.addEventListener("fullscreenchange", checkFullscreen);

  if (getSiteKeyFromUrl(window.location.href)) createBubble();
})();
