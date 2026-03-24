# How to use Usage Tracker

This guide is for **end users** who want to install the extension and understand what each part does. For developers, see [README.md](README.md).

## What this extension does

**Usage Tracker** records how much **active** time you spend on **YouTube**, **Instagram**, and **Strava** in Chrome. It does **not** block sites by default. You can set optional **weekly time caps** per site; when you go over a cap, the extension **warns** you in the UI—it does not stop you from using the site.

All data stays **on your computer** in Chrome’s local storage. Nothing is uploaded to a server.

---

## Install the extension (first time)

1. Download or clone this repository so you have the folder that contains `manifest.json`.
2. Open Google Chrome.
3. Go to `chrome://extensions`.
4. Turn **Developer mode** **on** (switch in the top-right).
5. Click **Load unpacked**.
6. Choose the extension folder (the one with `manifest.json`).

You should see **Usage Tracker** in your extensions list. If Chrome shows errors, make sure you selected the correct folder and that `manifest.json` is present.

---

## Open the dashboard

- Click the **Usage Tracker** icon in the Chrome toolbar (puzzle piece → pin the extension if you do not see it).

The dashboard shows:

- **Today**, **this week**, and **this month** totals (all supported sites combined).
- A **chart** for the last **7** or **30** days, with a color per site.
- A **By site** breakdown for the selected period.
- **Settings** (bubble position, weekly caps—see below).

The page also shows when data was last updated.

---

## The floating bubble (on supported sites)

On YouTube, Instagram, and Strava, a small **bubble** appears on the page (default: top-right). It shows **today** and **this week** for the **current site**.

| Action | What it does |
|--------|----------------|
| Expand / collapse | See more or less detail without leaving the page. |
| Hide bubble | Hides the bubble until you turn it back on from the dashboard (“Show bubble on sites”). |
| **Snooze bubble 1h** (dashboard) or snooze from the bubble | Hides the bubble for **one hour**, then it can show again (if not globally hidden). |
| Open dashboard | From the bubble, you can open the full dashboard in a new tab. |

**YouTube fullscreen:** The bubble hides while a video is fullscreen and comes back when you exit fullscreen.

**First visit:** You may see a short hint on the bubble; you can dismiss it.

---

## Settings explained

### Show bubble on sites

- **Checked:** The bubble appears on supported sites (unless snoozed, hidden from the bubble, or fullscreen on YouTube).
- **Unchecked:** No bubble on pages; tracking still runs in the background when you use those sites actively.

### Bubble position

Choose **top right**, **top left**, **bottom right**, or **bottom left** so the bubble stays out of the way of controls you use often.

### Weekly caps (warnings only)

- Enter a number of **minutes per week** for each site, or leave empty / **Off** to disable.
- If your **rolling 7-day** usage for that site reaches the cap, the UI shows that you are **over cap** (dashboard and bubble). This is a **reminder only**—the extension does not block access.

---

## What counts as “usage”

Time is counted only when **all** of the following are true:

- The tab is for a supported site (YouTube, Instagram, or Strava).
- That tab is the **active** tab in its window.
- The Chrome window is **focused** (not behind another app, not minimized in a way that unfocuses it).

Background tabs, other sites, and unfocused windows are **not** counted. Counts update on a **roughly one-minute** schedule (Chrome alarm granularity), so very short visits may not add a full minute.

---

## Privacy

- Data is stored locally under Chrome’s extension storage.
- No account sign-in and no cloud sync in this project.
- Uninstalling the extension may remove its stored data; export features are not built in yet (see README for possible future work).

---

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| Bubble never appears | Turn on “Show bubble on sites” on the dashboard; check you are on youtube.com, instagram.com, or strava.com; disable snooze; on YouTube, exit fullscreen. |
| Times look wrong | Remember only **focused, active tab** time counts; short visits may round to the next minute tick. |
| Dashboard is blank or old | Refresh the dashboard tab; use a supported Chrome version; reload the extension on `chrome://extensions`. |
| Changed code and nothing updates | If you develop from source, run a production build so `background.js`, `content.js`, and `dashboard.js` update, then reload the extension. |

For build steps and architecture, see [README.md](README.md).
