/**
 * Lightweight bar chart for usage over time.
 * Stacked bars with hover/focus tooltips. Keyboard-accessible.
 */

import React, { useState, useCallback } from "react";
import { formatSeconds } from "../utils/format";
import { SITE_NAMES } from "../config";
import type { ChartDataPoint } from "../types";

interface ChartProps {
  data: ChartDataPoint[];
  height?: number;
}

const COLORS = {
  youtube: "#ff4444",
  instagram: "#e1306c",
  strava: "#fc4c02",
};

function formatDateForDisplay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function Chart({ data, height = 180 }: ChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleBarFocus = useCallback((i: number) => () => setActiveIndex(i), []);
  const handleBarBlur = useCallback(() => setActiveIndex(null), []);
  const handleBarMouseEnter = useCallback((i: number) => () => setActiveIndex(i), []);
  const handleBarMouseLeave = useCallback(() => setActiveIndex(null), []);

  if (data.length === 0) return null;

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const gap = 2;
  const active = activeIndex != null ? data[activeIndex] : null;

  return (
    <div className="ut-chart-container">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="ut-chart"
        role="img"
        aria-label="Usage over time bar chart"
      >
        {data.map((d, i) => {
          const x = (i / data.length) * 100;
          let y = height;
          const parts: { h: number; fill: string }[] = [];
          if (d.youtube > 0) parts.push({ h: (d.youtube / maxTotal) * height, fill: COLORS.youtube });
          if (d.instagram > 0) parts.push({ h: (d.instagram / maxTotal) * height, fill: COLORS.instagram });
          if (d.strava > 0) parts.push({ h: (d.strava / maxTotal) * height, fill: COLORS.strava });
          const barWidth = Math.max(1, 100 / data.length - gap);
          const isActive = activeIndex === i;
          return (
            <g key={d.date}>
              <rect
                x={x + gap / 2}
                y={0}
                width={barWidth}
                height={height}
                fill="transparent"
                className="ut-chart-bar-hit"
                tabIndex={0}
                focusable
                onFocus={handleBarFocus(i)}
                onBlur={handleBarBlur}
                onMouseEnter={handleBarMouseEnter(i)}
                onMouseLeave={handleBarMouseLeave}
                aria-label={`${formatDateForDisplay(d.date)}: ${formatSeconds(d.total)} total. YouTube ${formatSeconds(d.youtube)}, Instagram ${formatSeconds(d.instagram)}, Strava ${formatSeconds(d.strava)}`}
              />
              {parts.map((p, j) => {
                y -= p.h;
                return (
                  <rect
                    key={j}
                    x={x + gap / 2}
                    y={y}
                    width={barWidth}
                    height={Math.max(0.5, p.h)}
                    fill={p.fill}
                    rx={1}
                    className={isActive ? "ut-chart-bar-active" : ""}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {active && (
        <div
          className="ut-chart-tooltip"
          role="tooltip"
          id="ut-chart-tooltip"
        >
          <div className="ut-chart-tooltip-date">{formatDateForDisplay(active.date)}</div>
          <div className="ut-chart-tooltip-total">{formatSeconds(active.total)} total</div>
          <div className="ut-chart-tooltip-breakdown">
            {active.youtube > 0 && <span>YouTube: {formatSeconds(active.youtube)}</span>}
            {active.instagram > 0 && <span>Instagram: {formatSeconds(active.instagram)}</span>}
            {active.strava > 0 && <span>Strava: {formatSeconds(active.strava)}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
