/**
 * Formatting utilities for display.
 * Keeps display logic in one place to ensure consistency.
 */

/**
 * Formats seconds into a human-readable string (e.g. "1h 23m", "45m", "12s").
 * Uses h/m/s units for clarity. No decimal seconds.
 */
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 && h === 0) parts.push(`${s}s`);
  return parts.length ? parts.join(" ") : "0m";
}

/**
 * Returns YYYY-MM-DD for a given Date (local timezone).
 * Used as the storage key for daily usage.
 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
