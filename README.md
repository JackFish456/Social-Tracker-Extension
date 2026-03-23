# Usage Tracker

A Chrome extension (Manifest V3) that tracks daily active usage time on **YouTube**, **Instagram**, and **Strava**. Data is stored locally and displayed in a floating bubble and a dashboard with charts.

## Features

- **Active time only**: Counts time when the tab is active, the window is focused, and you're on a supported site
- **Floating bubble**: Minimal bubble on supported pages showing today and week usage; can be collapsed or hidden
- **Dashboard**: 7-day or 30-day charts, summary stats (today, week, month), breakdown by site
- **Local storage**: All data stays in `chrome.storage.local`; nothing is sent externally

## Supported Sites

| Site Key | Domains |
|----------|---------|
| youtube | youtube.com and subdomains (m.youtube.com, music.youtube.com, etc.) |
| instagram | instagram.com and subdomains |
| strava | strava.com and subdomains |

## Project Structure

```
.
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker (built)
├── content.js             # Content script (built)
├── content.css            # Bubble styles
├── dashboard.html         # Dashboard page
├── dashboard.js           # Dashboard React app (built)
├── dashboard.css          # Dashboard styles
├── package.json           # Dependencies and build scripts
├── build.js               # Build script (esbuild)
├── tsconfig.json          # TypeScript config
├── src/
│   ├── types.ts           # Shared types
│   ├── config.ts          # Supported sites config
│   ├── background/
│   │   ├── index.ts       # Service worker entry
│   │   └── tracker.ts     # Time-tracking logic
│   ├── content/
│   │   ├── index.ts       # Content script entry
│   │   └── bubble.tsx     # Floating bubble UI
│   ├── dashboard/
│   │   ├── index.tsx      # Dashboard entry
│   │   ├── Dashboard.tsx  # Main dashboard
│   │   └── Chart.tsx      # Bar chart component
│   └── utils/
│       ├── site.ts        # URL/site detection
│       ├── format.ts      # Formatting (seconds, date keys)
│       ├── storage.ts     # Chrome storage helpers
│       └── chart.ts       # Chart data series
└── README.md
```

## Setup & Load

### No-build (ready to use)

The extension includes pre-built vanilla JS files (`background.js`, `content.js`, `dashboard.js`). You can load it immediately without any build step:

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right)
3. Click **Load unpacked**
4. Select the extension folder (the one containing `manifest.json`)

### Optional: Build from TypeScript/React source

The `src/` directory contains TypeScript and React sources. To rebuild:

```bash
npm install
npm run build
```

Or directly: `node build.js`

This overwrites `background.js`, `content.js`, and `dashboard.js` with bundled output. Requires Node.js 18+ and npm.

## How It Works

### Background Service Worker

- Listens to tab activation, tab URL changes, and window focus
- Uses `chrome.alarms` to tick every 1 minute (reliable when the worker suspends)
- On each tick, checks that the active tab is focused, on a supported URL, and same date; if so, increments that site's usage for today
- Responds to `OPEN_DASHBOARD` messages to open the dashboard in a new tab

### Content Script (Bubble)

- Runs on YouTube, Instagram, and Strava
- Injects a small floating bubble (top-right)
- Polls storage every 60s and listens for `chrome.storage.onChanged` to update usage
- On YouTube fullscreen, hides the bubble; shows it again when exiting fullscreen
- Bubble hidden state is persisted in storage; can be toggled from the dashboard

### Dashboard

- React app loaded in a full tab (`dashboard.html`)
- Reads from `chrome.storage.local` and shows summary stats, 7/30‑day chart, and per-site breakdown
- "Show bubble on sites" toggle controls the persisted bubble visibility

## Data Format

- **Storage key**: `usageTracker`
- **Usage**: `usage[site][dateKey]` = seconds (e.g. `usage.youtube["2025-03-22"] = 3600`)
- **Dates**: `YYYY-MM-DD` in local timezone

## Future Enhancements

- Add more sites (extend `config.ts` and manifest `host_permissions`)
- Export data (CSV/JSON)
- Daily goals or limits
- Optional sync (e.g. across devices)

## Limitations & Assumptions

- **Granularity**: Time is recorded in 1‑minute intervals (Chrome alarm minimum)
- **Accuracy**: Time is only counted when tab + window are focused; background tabs and minimized windows are not counted
- **Timezone**: All dates use the browser's local timezone
- **Build tooling**: The build uses Node/npm; if Node is unavailable, use an alternative (e.g. online bundler) or pre-built artifacts
