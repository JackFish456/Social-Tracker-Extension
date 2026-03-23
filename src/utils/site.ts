/**
 * Site detection via URL hostname matching.
 * Supports subdomains (m.youtube.com, music.youtube.com, www.instagram.com, etc.).
 */

import { HOSTNAME_SUFFIXES } from "../config";
import type { SiteKey } from "../types";

/**
 * Returns the site key for a given URL, or null if not supported.
 * Uses hostname parsing; host must equal or end with .{suffix} for a supported site.
 */
export function getSiteKeyFromUrl(url: string): SiteKey | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    for (const [suffix, key] of Object.entries(HOSTNAME_SUFFIXES)) {
      if (host === suffix || host.endsWith("." + suffix)) return key;
    }
  } catch {
    // Invalid URL
  }
  return null;
}

/**
 * Checks if a URL belongs to a supported site.
 */
export function isSupportedUrl(url: string): boolean {
  return getSiteKeyFromUrl(url) !== null;
}
