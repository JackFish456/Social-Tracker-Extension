/**
 * Chart data helpers for 7-day and 30-day series.
 * Returns array of { date, total, youtube, instagram, strava } for each day.
 */

import { toDateKey } from "./format";
import type { UsageBySite, ChartDataPoint } from "../types";

export function getChartSeries(
  usage: UsageBySite,
  days: 7 | 30
): ChartDataPoint[] {
  const result: ChartDataPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    const youtube = usage.youtube[key] ?? 0;
    const instagram = usage.instagram[key] ?? 0;
    const strava = usage.strava[key] ?? 0;
    result.push({
      date: key,
      total: youtube + instagram + strava,
      youtube,
      instagram,
      strava,
    });
  }
  return result;
}
