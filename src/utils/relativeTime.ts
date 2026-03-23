/**
 * Relative time formatting for freshness labels.
 */

/**
 * Returns human-readable relative time (e.g. "just now", "1 min ago", "5 min ago").
 */
export function formatRelativeTime(ms: number): string {
  const now = Date.now();
  const diffSec = Math.floor((now - ms) / 1000);
  if (diffSec < 10) return "just now";
  if (diffSec < 60) return "less than 1 min ago";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr === 1) return "1 hour ago";
  if (diffHr < 24) return `${diffHr} hours ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "1 day ago";
  return `${diffDay} days ago`;
}
