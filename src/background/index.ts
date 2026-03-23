/**
 * Background service worker entry.
 * Initializes the time tracker and message handlers.
 */

import { initTracker } from "./tracker";

initTracker();

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

chrome.runtime.onMessage.addListener(
  (message: { type?: string }, _sender, sendResponse) => {
    if (message.type === "OPEN_DASHBOARD") {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
      sendResponse({ ok: true });
    }
    return true;
  }
);
