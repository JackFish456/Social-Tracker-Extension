/**
 * Configuration and constants for supported sites.
 * Adding a new site: extend SUPPORTED_SITES, HOSTNAME_SUFFIXES, and SITE_NAMES.
 */

import type { SiteKey } from "./types";

/** Canonical list of supported site keys */
export const SUPPORTED_SITES: readonly SiteKey[] = [
  "youtube",
  "instagram",
  "strava",
] as const;

/**
 * Hostname suffix -> site key. A URL hostname matches if it equals or ends with .suffix.
 * Supports subdomains: m.youtube.com, music.youtube.com, www.instagram.com, etc.
 */
export const HOSTNAME_SUFFIXES: Record<string, SiteKey> = {
  "youtube.com": "youtube",
  "instagram.com": "instagram",
  "strava.com": "strava",
};

/** Human-readable display names */
export const SITE_NAMES: Record<SiteKey, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  strava: "Strava",
};
