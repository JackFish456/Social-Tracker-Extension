/**
 * Content script entry.
 * Injects the floating bubble and handles dashboard-opening requests.
 */

import { getSiteKeyFromUrl } from "../utils/site";
import { mountBubble } from "./bubble";

function main() {
  if (!getSiteKeyFromUrl(window.location.href)) return;

  const container = document.createElement("div");
  container.id = "usage-tracker-root";
  document.body.appendChild(container);
  mountBubble(container);
}

main();
