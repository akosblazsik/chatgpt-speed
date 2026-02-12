// background.js

const ICONS = {
  light: {
    16: "assets/icons/16-light.png",
    32: "assets/icons/32-light.png",
    48: "assets/icons/48-light.png",
    128: "assets/icons/128-light.png"
  },
  dark: {
    16: "assets/icons/16-dark.png",
    32: "assets/icons/32-dark.png",
    48: "assets/icons/48-dark.png",
    128: "assets/icons/128-dark.png"
  }
};

const ICON_THEME_KEY = "csb_icon_theme";
const ICON_PREF_KEY = "csb_icon_theme_pref";
const ICON_SYSTEM_KEY = "csb_icon_system_is_dark";
const ICON_IMAGE_CACHE = {
  light: null,
  dark: null
};
let iconThemePreference = "system";
let lastSystemIsDark = null;

async function loadIconImageData(iconSet) {
  const entries = Object.entries(iconSet);
  const imageDataEntries = await Promise.all(
    entries.map(async ([size, relPath]) => {
      const url = chrome.runtime.getURL(relPath);
      const response = await fetch(url);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const s = Number(size);
      const canvas = new OffscreenCanvas(s, s);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0, s, s);
      const imageData = ctx.getImageData(0, 0, s, s);
      return [size, imageData];
    })
  );
  return Object.fromEntries(imageDataEntries);
}

async function setActionIcon(isDark) {
  const useDarkIcon = !isDark;
  const themeKey = useDarkIcon ? "dark" : "light";
  const iconSet = useDarkIcon ? ICONS.dark : ICONS.light;
  if (!ICON_IMAGE_CACHE[themeKey]) {
    ICON_IMAGE_CACHE[themeKey] = await loadIconImageData(iconSet);
  }
  chrome.action.setIcon({ imageData: ICON_IMAGE_CACHE[themeKey] }, () => {
    if (chrome.runtime.lastError) {
      console.warn("csb icon setIcon failed:", chrome.runtime.lastError.message);
    }
  });
  chrome.storage.local.set({ [ICON_THEME_KEY]: useDarkIcon ? "dark" : "light" });
}

function applyIconThemePreference(pref) {
  iconThemePreference = pref;
  chrome.storage.local.set({ [ICON_PREF_KEY]: pref });
  if (pref === "system") {
    if (lastSystemIsDark == null) return;
    setActionIcon(lastSystemIsDark);
    return;
  }
  setActionIcon(pref === "dark");
}

async function ensureOffscreenDocument() {
  if (!chrome.offscreen?.createDocument) return;
  const hasDoc = await chrome.offscreen.hasDocument?.();
  if (hasDoc) return;

  await chrome.offscreen.createDocument({
    url: "src/offscreen.html",
    reasons: ["MATCH_MEDIA"],
    justification: "Observe prefers-color-scheme to update action icon."
  });
}

/**
 * Set up default storage values on extension install.
 */
chrome.runtime.onInstalled.addListener((details) => {
  const SETTINGS_KEY = "csb_settings";

  function logIfDebug(...args) {
    chrome.storage.sync.get({ [SETTINGS_KEY]: { debug: false } }, (data) => {
      const settings = data[SETTINGS_KEY] || {};
      if (settings.debug) {
        console.log(...args);
      }
    });
  }

  if (details.reason === "install") {
    chrome.storage.sync.set({
      [SETTINGS_KEY]: {
        enabled: true,
        messageLimit: 15,
        maxExtraMessages: 300,
        autoRefreshEnabled: false,
        autoRefreshAfter: 15,
        debug: false
      }
    });
    logIfDebug("ChatGPT Speed installed.");
  }

  if (details.reason === "update") {
    logIfDebug(
      "ChatGPT Speed updated to version",
      chrome.runtime.getManifest().version
    );
  }

  ensureOffscreenDocument();
});

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreenDocument();
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender?.id !== chrome.runtime.id) return;
  if (!message || typeof message !== "object") return;
  if (message.type === "setIconTheme") {
    lastSystemIsDark = Boolean(message.isDark);
    chrome.storage.local.set({ [ICON_SYSTEM_KEY]: lastSystemIsDark });
    if (iconThemePreference === "system") {
      setActionIcon(lastSystemIsDark);
    }
  } else if (message.type === "setIconThemePreference") {
    const theme = message.theme;
    if (theme === "system" || theme === "light" || theme === "dark") {
      applyIconThemePreference(theme);
    }
  }
});

chrome.storage.local.get(
  { [ICON_PREF_KEY]: "system", [ICON_SYSTEM_KEY]: null },
  (data) => {
    iconThemePreference = data[ICON_PREF_KEY];
    lastSystemIsDark = data[ICON_SYSTEM_KEY];
    if (iconThemePreference === "system") {
      if (lastSystemIsDark != null) {
        setActionIcon(lastSystemIsDark);
      }
      return;
    }
    setActionIcon(iconThemePreference === "dark");
  }
);
