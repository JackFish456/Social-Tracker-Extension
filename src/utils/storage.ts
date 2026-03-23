/**
 * Chrome storage helpers with typed access.
 * Usage and UI state are stored in separate keys to avoid data races.
 */

import type { StorageData, UsageBySite, BubblePosition, WeeklyCaps } from "../types";
import { SUPPORTED_SITES } from "../config";

const STORAGE_KEY_LEGACY = "usageTracker";
const STORAGE_KEY_USAGE = "usageTracker_usage";
const STORAGE_KEY_UI = "usageTracker_ui";

const DEFAULT_POSITION: BubblePosition = "top-right";
const DEFAULT_CAPS: WeeklyCaps = { youtube: null, instagram: null, strava: null };

function emptyUsage(): UsageBySite {
  return { youtube: {}, instagram: {}, strava: {} };
}

function sanitizeUsage(usage: unknown): UsageBySite {
  if (!usage || typeof usage !== "object") return emptyUsage();
  const raw = usage as Record<string, unknown>;
  if (raw.youtube || raw.instagram || raw.strava) {
    const out = emptyUsage();
    for (const site of SUPPORTED_SITES) {
      const s = raw[site];
      if (s && typeof s === "object") {
        for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
          if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[site][k] = v;
        }
      }
    }
    return out;
  }
  return emptyUsage();
}

function sanitizeCaps(caps: unknown): WeeklyCaps {
  if (!caps || typeof caps !== "object") return { ...DEFAULT_CAPS };
  const raw = caps as Record<string, unknown>;
  const out = { ...DEFAULT_CAPS };
  for (const site of SUPPORTED_SITES) {
    const v = raw[site];
    if (v === null || v === undefined) continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n >= 0) out[site] = Math.round(n);
  }
  return out;
}

function parsePosition(v: unknown): BubblePosition {
  const valid: BubblePosition[] = ["top-right", "top-left", "bottom-right", "bottom-left"];
  if (typeof v === "string" && valid.includes(v)) return v;
  return DEFAULT_POSITION;
}

async function migrateFromLegacy(raw: Record<string, unknown>): Promise<void> {
  const usage = sanitizeUsage(raw.usage);
  const bubbleHidden = Boolean(raw.bubbleHidden);
  await chrome.storage.local.set({
    [STORAGE_KEY_USAGE]: { usage, lastUpdated: Date.now() },
    [STORAGE_KEY_UI]: {
      bubbleHidden,
      bubblePosition: DEFAULT_POSITION,
      snoozeUntil: 0,
      weeklyCaps: DEFAULT_CAPS,
      hintDismissed: true,
    },
  });
  await chrome.storage.local.remove(STORAGE_KEY_LEGACY);
}

/**
 * Reads usage storage. Handles both old format (raw usage) and new format ({ usage, lastUpdated }).
 */
function parseUsageStorage(raw: unknown): { usage: UsageBySite; lastUpdated: number } {
  if (!raw || typeof raw !== "object") {
    return { usage: emptyUsage(), lastUpdated: 0 };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.usage && typeof obj.usage === "object") {
    return {
      usage: sanitizeUsage(obj.usage),
      lastUpdated: typeof obj.lastUpdated === "number" ? obj.lastUpdated : 0,
    };
  }
  return { usage: sanitizeUsage(raw), lastUpdated: 0 };
}

export async function getStorageData(): Promise<StorageData> {
  const result = await chrome.storage.local.get([
    STORAGE_KEY_LEGACY,
    STORAGE_KEY_USAGE,
    STORAGE_KEY_UI,
  ]);

  const legacy = result[STORAGE_KEY_LEGACY];
  if (legacy && typeof legacy === "object") {
    await migrateFromLegacy(legacy as Record<string, unknown>);
    return getStorageData();
  }

  const { usage, lastUpdated } = parseUsageStorage(result[STORAGE_KEY_USAGE]);
  const uiRaw = result[STORAGE_KEY_UI];
  const ui = uiRaw && typeof uiRaw === "object" ? (uiRaw as Record<string, unknown>) : {};

  return {
    usage,
    lastUpdated,
    bubbleHidden: Boolean(ui.bubbleHidden),
    bubblePosition: parsePosition(ui.bubblePosition),
    snoozeUntil: typeof ui.snoozeUntil === "number" ? ui.snoozeUntil : 0,
    weeklyCaps: sanitizeCaps(ui.weeklyCaps),
    hintDismissed: Boolean(ui.hintDismissed),
  };
}

/**
 * Increments usage. Writes only usage key. Updates lastUpdated.
 */
export async function incrementUsage(
  site: keyof UsageBySite,
  dateKey: string,
  deltaSeconds: number
): Promise<void> {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
  const result = await chrome.storage.local.get(STORAGE_KEY_USAGE);
  const { usage } = parseUsageStorage(result[STORAGE_KEY_USAGE]);
  const current = usage[site][dateKey] ?? 0;
  usage[site][dateKey] = current + deltaSeconds;
  await chrome.storage.local.set({
    [STORAGE_KEY_USAGE]: { usage, lastUpdated: Date.now() },
  });
}

/**
 * Sets bubble hidden. Clears snooze when unhiding.
 */
export async function setBubbleHidden(hidden: boolean): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY_UI);
  const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object")
    ? (result[STORAGE_KEY_UI] as Record<string, unknown>)
    : {};
  ui.bubbleHidden = hidden;
  if (!hidden) ui.snoozeUntil = 0;
  await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
}

export async function setBubblePosition(position: BubblePosition): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY_UI);
  const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object")
    ? (result[STORAGE_KEY_UI] as Record<string, unknown>)
    : {};
  ui.bubblePosition = position;
  await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
}

export async function setSnoozeUntil(ms: number): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY_UI);
  const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object")
    ? (result[STORAGE_KEY_UI] as Record<string, unknown>)
    : {};
  ui.snoozeUntil = ms;
  ui.bubbleHidden = true;
  await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
}

export async function setWeeklyCaps(caps: WeeklyCaps): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY_UI);
  const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object")
    ? (result[STORAGE_KEY_UI] as Record<string, unknown>)
    : {};
  ui.weeklyCaps = sanitizeCaps(caps);
  await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
}

/**
 * Clears snooze when it has expired. Call from bubble when snoozeUntil < now.
 */
export async function clearSnoozeIfExpired(): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY_UI);
  const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object")
    ? (result[STORAGE_KEY_UI] as Record<string, unknown>)
    : {};
  const until = typeof ui.snoozeUntil === "number" ? ui.snoozeUntil : 0;
  if (until > 0 && Date.now() >= until) {
    ui.snoozeUntil = 0;
    ui.bubbleHidden = false;
    await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
  }
}

export async function setHintDismissed(dismissed: boolean): Promise<void> {
  const result = await chrome.storage.local.get(STORAGE_KEY_UI);
  const ui = (result[STORAGE_KEY_UI] && typeof result[STORAGE_KEY_UI] === "object")
    ? (result[STORAGE_KEY_UI] as Record<string, unknown>)
    : {};
  ui.hintDismissed = dismissed;
  await chrome.storage.local.set({ [STORAGE_KEY_UI]: ui });
}
