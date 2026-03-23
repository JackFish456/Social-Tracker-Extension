/**
 * Shared type definitions for the Usage Tracker extension.
 * Centralizing types enables consistency across background, content, and dashboard.
 */

/** Normalized site keys - used for storage, display, and URL matching */
export type SiteKey = "youtube" | "instagram" | "strava";

/** Usage data stored per date: { "2025-03-22": 3600 } = 1 hour on that date */
export interface DailyUsage {
  [dateKey: string]: number;
}

/** Per-site usage: { youtube: { "2025-03-22": 3600 }, ... } */
export interface UsageBySite {
  youtube: DailyUsage;
  instagram: DailyUsage;
  strava: DailyUsage;
}

/** Bubble position options */
export type BubblePosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

/** Per-site weekly cap in minutes; 0 or null = disabled */
export interface WeeklyCaps {
  youtube: number | null;
  instagram: number | null;
  strava: number | null;
}

/** Full storage schema - merged from usage + UI keys */
export interface StorageData {
  usage: UsageBySite;
  bubbleHidden: boolean;
  lastUpdated: number;
  bubblePosition: BubblePosition;
  snoozeUntil: number;
  weeklyCaps: WeeklyCaps;
  hintDismissed: boolean;
}

/** Chart data point for rendering time-series */
export interface ChartDataPoint {
  date: string;
  total: number;
  youtube: number;
  instagram: number;
  strava: number;
}
