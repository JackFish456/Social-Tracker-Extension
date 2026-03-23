/**
 * Main dashboard view: summary stats, period toggle, chart, settings.
 */

import React, { useState, useEffect, useCallback } from "react";
import { getStorageData, setBubbleHidden, setBubblePosition, setSnoozeUntil, setWeeklyCaps } from "../utils/storage";
import { formatSeconds, toDateKey } from "../utils/format";
import { formatRelativeTime } from "../utils/relativeTime";
import { getChartSeries } from "../utils/chart";
import { Chart } from "./Chart";
import { SITE_NAMES } from "../config";
import type { StorageData, UsageBySite, BubblePosition, WeeklyCaps } from "../types";

function sumRange(usage: UsageBySite, siteKey: keyof UsageBySite, days: number): number {
  const now = new Date();
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    total += usage[siteKey][toDateKey(d)] ?? 0;
  }
  return total;
}

function weekTotalForSite(usage: UsageBySite, site: keyof UsageBySite): number {
  return sumRange(usage, site, 7);
}

const POSITION_OPTIONS: { value: BubblePosition; label: string }[] = [
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
];

function DashboardApp() {
  const [data, setData] = useState<StorageData | null>(null);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    const d = await getStorageData();
    setData(d);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local") return;
      if (changes.usageTracker_usage || changes.usageTracker_ui || changes.usageTracker) refresh();
    };
    chrome.storage.onChanged.addListener(handler);
    return () => chrome.storage.onChanged.removeListener(handler);
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!data) {
    return (
      <div className="ut-dash">
        <div className="ut-dash-loading">Loading…</div>
      </div>
    );
  }

  const today = toDateKey(new Date());
  const todayTotal =
    (data.usage.youtube[today] ?? 0) +
    (data.usage.instagram[today] ?? 0) +
    (data.usage.strava[today] ?? 0);
  const weekTotal = sumRange(data.usage, "youtube", 7) +
    sumRange(data.usage, "instagram", 7) +
    sumRange(data.usage, "strava", 7);
  const monthTotal = sumRange(data.usage, "youtube", 30) +
    sumRange(data.usage, "instagram", 30) +
    sumRange(data.usage, "strava", 30);

  const series = getChartSeries(data.usage, period);
  const hasAnyUsage = weekTotal > 0 || monthTotal > 0 || todayTotal > 0;

  const capsExceeded: (keyof UsageBySite)[] = [];
  for (const site of ["youtube", "instagram", "strava"] as const) {
    const cap = data.weeklyCaps[site];
    if (cap != null && cap > 0) {
      const used = weekTotalForSite(data.usage, site);
      if (used >= cap * 60) capsExceeded.push(site);
    }
  }

  return (
    <div className="ut-dash">
      <header className="ut-dash-header">
        <h1>Usage Tracker</h1>
        <div className="ut-dash-header-actions">
          <label className="ut-dash-bubble-toggle">
            <input
              type="checkbox"
              checked={!data.bubbleHidden}
              onChange={(e) => {
                setBubbleHidden(!e.target.checked).then(refresh);
              }}
              aria-describedby="ut-dash-bubble-desc"
            />
            <span id="ut-dash-bubble-desc">Show bubble on sites</span>
          </label>
          <button
            type="button"
            className="ut-dash-snooze-btn"
            onClick={() => {
              setSnoozeUntil(Date.now() + 60 * 60 * 1000).then(refresh);
            }}
            aria-label="Snooze bubble for 1 hour"
          >
            Snooze bubble 1h
          </button>
        </div>
      </header>

      {data.lastUpdated > 0 && (
        <p className="ut-dash-freshness" aria-live="polite">
          Last updated {formatRelativeTime(data.lastUpdated)}
        </p>
      )}

      <section className="ut-dash-summary">
        <div className="ut-dash-stat">
          <span className="ut-dash-stat-label">Today</span>
          <span className="ut-dash-stat-value">{formatSeconds(todayTotal)}</span>
          {todayTotal === 0 && (
            <span className="ut-dash-stat-empty">No usage yet today</span>
          )}
        </div>
        <div className="ut-dash-stat">
          <span className="ut-dash-stat-label">This week</span>
          <span className="ut-dash-stat-value">{formatSeconds(weekTotal)}</span>
        </div>
        <div className="ut-dash-stat">
          <span className="ut-dash-stat-label">This month</span>
          <span className="ut-dash-stat-value">{formatSeconds(monthTotal)}</span>
        </div>
      </section>

      <section className="ut-dash-chart-section">
        <div className="ut-dash-period">
          <button
            type="button"
            className={period === 7 ? "ut-dash-period-btn active" : "ut-dash-period-btn"}
            onClick={() => setPeriod(7)}
            aria-pressed={period === 7}
            aria-label="Show 7 days"
          >
            7 days
          </button>
          <button
            type="button"
            className={period === 30 ? "ut-dash-period-btn active" : "ut-dash-period-btn"}
            onClick={() => setPeriod(30)}
            aria-pressed={period === 30}
            aria-label="Show 30 days"
          >
            30 days
          </button>
        </div>
        <div className="ut-dash-chart-wrap">
          {hasAnyUsage ? (
            <Chart data={series} height={180} />
          ) : (
            <div className="ut-dash-empty" role="status">
              <p className="ut-dash-empty-title">No usage yet for this period</p>
              <p className="ut-dash-empty-hint">
                Use supported sites (YouTube, Instagram, Strava) and we&apos;ll track automatically.
              </p>
            </div>
          )}
        </div>
        <div className="ut-dash-legend">
          <span className="ut-dash-legend-item" style={{ color: "#ff4444" }}>YouTube</span>
          <span className="ut-dash-legend-item" style={{ color: "#e1306c" }}>Instagram</span>
          <span className="ut-dash-legend-item" style={{ color: "#fc4c02" }}>Strava</span>
        </div>
      </section>

      <section className="ut-dash-breakdown">
        <h2>By site</h2>
        <ul className="ut-dash-breakdown-list">
          {(["youtube", "instagram", "strava"] as const).map((site) => {
            const total = sumRange(data.usage, site, period);
            const cap = data.weeklyCaps[site];
            const exceeded = cap != null && cap > 0 && weekTotalForSite(data.usage, site) >= cap * 60;
            return (
              <li
                key={site}
                className={`ut-dash-breakdown-item ${exceeded ? "ut-dash-breakdown-over" : ""}`}
              >
                <span>{SITE_NAMES[site]}{exceeded && " (over cap)"}</span>
                <span>{formatSeconds(total)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="ut-dash-settings" aria-labelledby="ut-settings-heading">
        <h2 id="ut-settings-heading">Settings</h2>

        <div className="ut-dash-setting">
          <label htmlFor="ut-bubble-position">Bubble position</label>
          <select
            id="ut-bubble-position"
            value={data.bubblePosition}
            onChange={(e) => {
              setBubblePosition(e.target.value as BubblePosition).then(refresh);
            }}
            aria-describedby="ut-bubble-position-desc"
          >
            {POSITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span id="ut-bubble-position-desc" className="ut-dash-setting-desc">
            Where the floating bubble appears on supported sites
          </span>
        </div>

        <div className="ut-dash-setting">
          <h3>Weekly caps (warnings only)</h3>
          <p className="ut-dash-setting-desc">Set a cap per site to get warnings when exceeded. No blocking.</p>
          {(["youtube", "instagram", "strava"] as const).map((site) => {
            const cap = data.weeklyCaps[site];
            const displayVal = cap == null || cap === 0 ? "" : String(cap);
            return (
              <div key={site} className="ut-dash-cap-row">
                <label htmlFor={`ut-cap-${site}`}>{SITE_NAMES[site]}</label>
                <input
                  id={`ut-cap-${site}`}
                  type="number"
                  min={0}
                  placeholder="Off"
                  value={displayVal}
                  onChange={(e) => {
                    const v = e.target.value ? parseInt(e.target.value, 10) : null;
                    const next: WeeklyCaps = { ...data.weeklyCaps, [site]: v != null && v >= 0 ? v : null };
                    setWeeklyCaps(next).then(refresh);
                  }}
                  aria-label={`${SITE_NAMES[site]} weekly cap in minutes`}
                />
                <span className="ut-dash-cap-unit">min/week</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default DashboardApp;
