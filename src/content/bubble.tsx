/**
 * Floating bubble UI for supported pages.
 * Supports position, snooze, weekly cap warnings, and first-time hint.
 */

import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  getStorageData,
  setBubbleHidden,
  setSnoozeUntil,
  setHintDismissed,
  clearSnoozeIfExpired,
} from "../utils/storage";
import { formatSeconds, toDateKey } from "../utils/format";
import { getSiteKeyFromUrl } from "../utils/site";
import { SITE_NAMES } from "../config";
import type { SiteKey, UsageBySite } from "../types";

function getWeekTotal(usage: UsageBySite, siteKey: SiteKey): number {
  const now = new Date();
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    total += usage[siteKey][key] ?? 0;
  }
  return total;
}

function BubbleApp() {
  const [collapsed, setCollapsed] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [siteKey, setSiteKey] = useState<SiteKey | null>(null);
  const [todaySec, setTodaySec] = useState(0);
  const [weekSec, setWeekSec] = useState(0);
  const [position, setPosition] = useState<"top-right" | "top-left" | "bottom-right" | "bottom-left">("top-right");
  const [weeklyCaps, setWeeklyCaps] = useState<Record<SiteKey, number | null>>({
    youtube: null,
    instagram: null,
    strava: null,
  });
  const [hintDismissed, setHintDismissedState] = useState(true);

  const refresh = useCallback(async () => {
    await clearSnoozeIfExpired();
    const data = await getStorageData();
    setHidden(data.bubbleHidden);
    setSnoozed(data.snoozeUntil > 0 && Date.now() < data.snoozeUntil);
    setPosition(data.bubblePosition);
    setWeeklyCaps(data.weeklyCaps);
    setHintDismissedState(data.hintDismissed);
    const key = getSiteKeyFromUrl(window.location.href);
    setSiteKey(key ?? null);
    if (key) {
      const today = toDateKey(new Date());
      const todayVal = data.usage[key][today] ?? 0;
      setTodaySec(todayVal);
      setWeekSec(getWeekTotal(data.usage, key));
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local") return;
      if (changes.usageTracker_usage || changes.usageTracker_ui || changes.usageTracker) refresh();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [refresh]);

  const toggleCollapse = () => setCollapsed((c) => !c);
  const toggleHide = async () => {
    const next = !hidden;
    await setBubbleHidden(next);
    setHidden(next);
  };
  const handleSnooze = async () => {
    await setSnoozeUntil(Date.now() + 60 * 60 * 1000);
    setSnoozed(true);
    setHidden(true);
  };
  const openDashboard = () => {
    chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
  };
  const dismissHint = async () => {
    await setHintDismissed(true);
    setHintDismissedState(true);
  };

  const cap = siteKey ? weeklyCaps[siteKey] : null;
  const capExceeded = cap != null && cap > 0 && weekSec >= cap * 60;

  if (hidden || snoozed || !siteKey) return null;

  return (
    <div
      className={`ut-bubble-wrapper ut-pos-${position}`}
      role="group"
      aria-label={`${SITE_NAMES[siteKey]} usage tracker`}
    >
      <div className={`ut-bubble ${capExceeded ? "ut-bubble-cap-over" : ""}`}>
        <button
          type="button"
          className="ut-bubble-main"
          onClick={openDashboard}
          aria-label={`Open dashboard. ${SITE_NAMES[siteKey]}: ${formatSeconds(todaySec)} today, ${formatSeconds(weekSec)} this week`}
        >
          <span className="ut-bubble-site">{SITE_NAMES[siteKey]}</span>
          {!collapsed && (
            <>
              <span className="ut-bubble-today">{formatSeconds(todaySec)} today</span>
              <span className="ut-bubble-week">{formatSeconds(weekSec)} this week</span>
            </>
          )}
        </button>
        <button
          type="button"
          className="ut-bubble-toggle"
          onClick={toggleCollapse}
          title={collapsed ? "Expand" : "Collapse"}
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "▸" : "▾"}
        </button>
        <button
          type="button"
          className="ut-bubble-snooze"
          onClick={handleSnooze}
          title="Snooze bubble for 1 hour"
          aria-label="Snooze bubble for 1 hour"
        >
          zz
        </button>
        <button
          type="button"
          className="ut-bubble-hide"
          onClick={toggleHide}
          title="Hide bubble"
          aria-label="Hide bubble"
        >
          ×
        </button>
      </div>

      {!hintDismissed && (
        <div className="ut-bubble-hint" role="status">
          <p>Click this bubble to open your dashboard.</p>
          <button
            type="button"
            className="ut-bubble-hint-dismiss"
            onClick={dismissHint}
            aria-label="Dismiss hint"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}

function useFullscreenHide() {
  const [hideForFullscreen, setHideForFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setHideForFullscreen(document.fullscreenElement !== null);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return hideForFullscreen;
}

function BubbleWithFullscreen() {
  const fullscreen = useFullscreenHide();
  if (fullscreen) return null;
  return <BubbleApp />;
}

export function mountBubble(container: HTMLElement): void {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <BubbleWithFullscreen />
    </React.StrictMode>
  );
}
