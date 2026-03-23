/**
 * Background time-tracking logic.
 * Tracks active usage only when: tab active, window focused, URL is supported.
 * Uses chrome.alarms for periodic ticks (MV3 service workers can suspend; alarms wake them).
 */

import { getSiteKeyFromUrl } from "../utils/site";
import { toDateKey } from "../utils/format";
import { incrementUsage } from "../utils/storage";
import type { SiteKey } from "../types";

const TICK_INTERVAL_MINUTES = 1;
const MAX_FLUSH_SEC = 120; // Cap to avoid runaway overcount (e.g. clock skew, long suspend)

interface TrackState {
  tabId: number;
  windowId: number;
  url: string;
  siteKey: SiteKey;
  dateKey: string;
  lastTickMs: number;
}

let state: TrackState | null = null;

function resetState(): void {
  state = null;
}

/**
 * Returns true if we should be counting time right now.
 */
async function isCurrentlyActive(): Promise<boolean> {
  if (!state) return false;
  try {
    const tab = await chrome.tabs.get(state.tabId);
    const win = tab.windowId !== undefined ? await chrome.windows.get(tab.windowId) : null;
    const focused = win?.focused ?? false;
    const url = tab.url ?? "";
    const siteKey = getSiteKeyFromUrl(url);
    const today = toDateKey(new Date());
    return (
      focused &&
      tab.active &&
      siteKey === state.siteKey &&
      today === state.dateKey &&
      url === state.url
    );
  } catch {
    return false;
  }
}

/**
 * Flushes elapsed time before state transition. Prevents undercount on quick tab/window/url switches.
 * Caps delta to MAX_FLUSH_SEC to avoid runaway overcount.
 */
async function flushElapsedBeforeTransition(): Promise<void> {
  if (!state) return;
  const deltaMs = Date.now() - state.lastTickMs;
  const deltaSec = Math.floor(deltaMs / 1000);
  if (deltaSec <= 0) return;
  const capped = Math.min(deltaSec, MAX_FLUSH_SEC);
  if (!Number.isFinite(capped) || capped <= 0) return;
  await incrementUsage(state.siteKey, state.dateKey, capped);
}

/**
 * Called every TICK_INTERVAL. Computes elapsed seconds and increments storage.
 */
async function onTick(): Promise<void> {
  if (!state) return;
  const active = await isCurrentlyActive();
  if (!active) {
    await flushElapsedBeforeTransition();
    resetState();
    return;
  }
  const now = Date.now();
  const deltaMs = now - state.lastTickMs;
  const deltaSec = Math.min(Math.floor(deltaMs / 1000), MAX_FLUSH_SEC);
  if (deltaSec > 0) {
    await incrementUsage(state.siteKey, state.dateKey, deltaSec);
    state.lastTickMs = now;
  }
}

/**
 * Starts or updates tracking when a tab becomes the active one.
 */
export async function startOrUpdateTracking(tabId: number): Promise<void> {
  if (state && state.tabId !== tabId) {
    await flushElapsedBeforeTransition();
  }
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url ?? "";
    const siteKey = getSiteKeyFromUrl(url);
    if (!siteKey) {
      resetState();
      return;
    }
    const dateKey = toDateKey(new Date());
    const win = tab.windowId !== undefined ? await chrome.windows.get(tab.windowId) : null;
    const focused = win?.focused ?? false;
    if (!tab.active || !focused) {
      resetState();
      return;
    }
    const now = Date.now();
    state = { tabId, windowId: tab.windowId ?? 0, url, siteKey, dateKey, lastTickMs: now };
  } catch {
    resetState();
  }
}

/**
 * Stops tracking (e.g. on tab switch, window change).
 */
export async function stopTracking(): Promise<void> {
  await flushElapsedBeforeTransition();
  resetState();
}

/**
 * Ensures we're tracking the correct tab. Call when tab activated or URL changed.
 */
export async function ensureTracking(tabId: number): Promise<void> {
  if (state?.tabId === tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const url = tab.url ?? "";
      const siteKey = getSiteKeyFromUrl(url);
      if (!siteKey || !tab.active) {
        await flushElapsedBeforeTransition();
        resetState();
        return;
      }
      const today = toDateKey(new Date());
      const win = tab.windowId !== undefined ? await chrome.windows.get(tab.windowId) : null;
      if (!win?.focused) {
        await flushElapsedBeforeTransition();
        resetState();
        return;
      }
      state.url = url;
      state.siteKey = siteKey;
      state.dateKey = today;
      state.lastTickMs = Date.now();
    } catch {
      await flushElapsedBeforeTransition();
      resetState();
    }
    return;
  }
  await startOrUpdateTracking(tabId);
}

export function initTracker(): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) startOrUpdateTracking(tabs[0].id!);
  });

  chrome.alarms.create("usageTick", {
    periodInMinutes: TICK_INTERVAL_MINUTES,
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "usageTick") onTick();
  });

  chrome.tabs.onActivated.addListener(async (info) => {
    await startOrUpdateTracking(info.tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) ensureTracking(tabId);
  });

  chrome.windows.onFocusChanged.addListener(async (windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      await stopTracking();
      return;
    }
    chrome.tabs.query({ active: true, windowId }, async (tabs) => {
      if (tabs[0]) await startOrUpdateTracking(tabs[0].id!);
      else await stopTracking();
    });
  });
}
