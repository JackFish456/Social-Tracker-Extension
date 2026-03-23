/* Usage Tracker - Background Service Worker */
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

function toDateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

const STORAGE_KEY_LEGACY = "usageTracker";
const STORAGE_KEY_USAGE = "usageTracker_usage";
const STORAGE_KEY_UI = "usageTracker_ui";
const MAX_FLUSH_SEC = 120;

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

async function migrateFromLegacy(raw) {
  const usage = sanitizeUsage(raw.usage);
  await chrome.storage.local.set({
    [STORAGE_KEY_USAGE]: { usage, lastUpdated: Date.now() },
    [STORAGE_KEY_UI]: { bubbleHidden: Boolean(raw.bubbleHidden), bubblePosition: "top-right", snoozeUntil: 0, weeklyCaps: { youtube: null, instagram: null, strava: null }, hintDismissed: true }
  });
  await chrome.storage.local.remove(STORAGE_KEY_LEGACY);
}

async function incrementUsage(site, dateKey, deltaSeconds) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
  const result = await chrome.storage.local.get(STORAGE_KEY_USAGE);
  const { usage } = parseUsageStorage(result[STORAGE_KEY_USAGE]);
  usage[site] = usage[site] || {};
  usage[site][dateKey] = (usage[site][dateKey] || 0) + deltaSeconds;
  await chrome.storage.local.set({ [STORAGE_KEY_USAGE]: { usage, lastUpdated: Date.now() } });
}

let state = null;

async function flushElapsedBeforeTransition() {
  if (!state) return;
  const deltaSec = Math.min(Math.floor((Date.now() - state.lastTickMs) / 1000), MAX_FLUSH_SEC);
  if (deltaSec <= 0) return;
  await incrementUsage(state.siteKey, state.dateKey, deltaSec);
}

async function isCurrentlyActive() {
  if (!state) return false;
  try {
    const tab = await chrome.tabs.get(state.tabId);
    const win = tab.windowId != null ? await chrome.windows.get(tab.windowId) : null;
    const focused = !!(win && win.focused);
    const url = tab.url || "";
    const siteKey = getSiteKeyFromUrl(url);
    const today = toDateKey(new Date());
    return focused && tab.active && siteKey === state.siteKey && today === state.dateKey && url === state.url;
  } catch (_) {
    return false;
  }
}

async function onTick() {
  if (!state) return;
  const active = await isCurrentlyActive();
  if (!active) {
    await flushElapsedBeforeTransition();
    state = null;
    return;
  }
  const now = Date.now();
  const deltaSec = Math.min(Math.floor((now - state.lastTickMs) / 1000), MAX_FLUSH_SEC);
  if (deltaSec > 0) {
    await incrementUsage(state.siteKey, state.dateKey, deltaSec);
    state.lastTickMs = now;
  }
}

async function startOrUpdateTracking(tabId) {
  if (state && state.tabId !== tabId) await flushElapsedBeforeTransition();
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url || "";
    const siteKey = getSiteKeyFromUrl(url);
    if (!siteKey) {
      state = null;
      return;
    }
    const dateKey = toDateKey(new Date());
    const win = tab.windowId != null ? await chrome.windows.get(tab.windowId) : null;
    const focused = !!(win && win.focused);
    if (!tab.active || !focused) {
      state = null;
      return;
    }
    state = { tabId, windowId: tab.windowId || 0, url, siteKey, dateKey, lastTickMs: Date.now() };
  } catch (_) {
    state = null;
  }
}

async function stopTracking() {
  await flushElapsedBeforeTransition();
  state = null;
}

async function ensureTracking(tabId) {
  if (state && state.tabId === tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = tab.url || "";
      const siteKey = getSiteKeyFromUrl(url);
      if (!siteKey || !tab.active) {
        await flushElapsedBeforeTransition();
        state = null;
        return;
      }
      const win = tab.windowId != null ? await chrome.windows.get(tab.windowId) : null;
      if (!win || !win.focused) {
        await flushElapsedBeforeTransition();
        state = null;
        return;
      }
      state.url = url;
      state.siteKey = siteKey;
      state.dateKey = toDateKey(new Date());
      state.lastTickMs = Date.now();
    } catch (_) {
      await flushElapsedBeforeTransition();
      state = null;
    }
    return;
  }
  await startOrUpdateTracking(tabId);
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) startOrUpdateTracking(tabs[0].id);
});

chrome.alarms.create("usageTick", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === "usageTick") onTick(); });
chrome.tabs.onActivated.addListener((info) => startOrUpdateTracking(info.tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) ensureTracking(tabId);
});
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    await stopTracking();
    return;
  }
  chrome.tabs.query({ active: true, windowId }, async (tabs) => {
    if (tabs[0]) await startOrUpdateTracking(tabs[0].id);
    else await stopTracking();
  });
});
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") }));
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "OPEN_DASHBOARD") {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    sendResponse({ ok: true });
  }
  return true;
});
