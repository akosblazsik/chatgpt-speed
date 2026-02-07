// background.js

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
});
