# Usage Tracker

A **Chrome extension** (Manifest V3) that measures **active** time on **YouTube**, **Instagram**, and **Strava**. It shows a small on-page bubble, a full **dashboard** with charts, and optional **weekly cap reminders** (warnings only—no blocking). Everything is stored **locally**; nothing is sent to external servers.

**Repository:** [Social-Tracker-Extension](https://github.com/JackFish456/Social-Tracker-Extension) (this codebase ships as the extension **Usage Tracker** in `manifest.json`.)

---

## User guide

Step-by-step installation and feature explanations (bubble, dashboard, caps, what counts as time) live in **[HOW_TO_USE.md](HOW_TO_USE.md)**.

---

## Features at a glance

| Feature | Description |
|--------|-------------|
| **Active time only** | Counts time when the tab is active, the window is focused, and the URL is a supported site. |
| **Floating bubble** | Today / week for the current site; collapse, hide, snooze 1h, open dashboard; position is configurable. |
| **Dashboard** | Summary (today / week / month), **7** or **30**‑day chart, per-site breakdown, bubble visibility and position, weekly caps. |
| **Weekly caps** | Optional minutes per site per week; UI highlights when you are over—**does not block** the site. |
| **Local-only data** | `chrome.storage.local`; no network upload for usage. |

### Supported sites

| Site | Matching |
|------|----------|
| YouTube | `youtube.com` and subdomains (e.g. `m.youtube.com`, `music.youtube.com`) |
| Instagram | `instagram.com` and subdomains |
| Strava | `strava.com` and subdomains |

---

## Quick install (no build)

Prebuilt bundles (`background.js`, `content.js`, `dashboard.js`) are included. You can load the extension immediately:

1. Chrome → `chrome://extensions` → enable **Developer mode**
2. **Load unpacked** → select the folder that contains `manifest.json`

Details and UX notes: [HOW_TO_USE.md](HOW_TO_USE.md).

---

## Development

### Requirements

- **Node.js 18+** (for the build script only)
- npm (comes with Node)

### Commands

```bash
npm install
npm run build
```

- **`npm run build`** — one-shot production bundle (overwrites the three JS files at the repo root).
- **`npm run dev`** — `node build.js --watch` for iterative work; reload the extension in Chrome after rebuilds.

The bundler is **esbuild** (`build.js`); sources live under `src/` (TypeScript + React for the dashboard and bubble).

### Project layout

```
.
├── manifest.json           # MV3 manifest
├── background.js           # Service worker (built)
├── content.js / content.css
├── dashboard.html / dashboard.js / dashboard.css
├── build.js                # esbuild entry
├── tsconfig.json
├── package.json
├── HOW_TO_USE.md           # End-user guide
└── src/
    ├── types.ts
    ├── config.ts           # Sites and display names
    ├── background/         # Tracker + action / messages
    ├── content/            # Bubble UI
    ├── dashboard/          # Dashboard UI
    └── utils/              # storage, format, site, chart, …
```

---

## How it works (technical)

### Background (service worker)

- Subscribes to tab activation, navigation, and window focus.
- Uses `chrome.alarms` (~1 minute) so counting survives worker suspension.
- Each tick: if the active tab is focused, on a supported URL, and the calendar day is consistent, increments that site’s seconds for today.
- Toolbar click opens `dashboard.html`; `OPEN_DASHBOARD` message opens the dashboard in a new tab.

### Content script

- Injected on the three host patterns; renders the bubble, syncs from storage (and on `storage` changes), respects bubble position, snooze, hide, fullscreen on YouTube, and weekly-cap hints.

### Dashboard

- Full-page React app: aggregates usage, chart series, settings (bubble, caps).

### Data model (simplified)

- Storage is keyed for usage and UI state (see `src/types.ts` and `src/utils/storage.ts`).
- Per-day usage: `usage[site][YYYY-MM-DD]` = seconds in **local** timezone.

---

## Limitations

- **Granularity:** About **one minute** between ticks (alarm minimum and design).
- **Accuracy:** Only **focused** active-tab time; not a full “screen time” product across all apps.
- **Caps:** Reminders only; not a parental control or hard block.

---

## Possible future enhancements

- More sites (`config.ts` + `host_permissions` in `manifest.json`)
- Export (CSV/JSON)
- Stronger goals / limits (still opt-in and clear about behavior)

---

## License / contributing

Add a `LICENSE` file if you want a standard open-source license. Issues and PRs can target the GitHub repo above.
