// Offscreen document for observing system color scheme.

const media = window.matchMedia("(prefers-color-scheme: dark)");

function notifyTheme() {
  const isDark = media.matches;
  chrome.runtime.sendMessage({
    type: "setIconTheme",
    isDark
  });
}

notifyTheme();
media.addEventListener("change", notifyTheme);
