// background.js

/**
 * Set up default storage values on extension install.
 */
chrome.runtime.onInstalled.addListener((details) => {
  const SETTINGS_KEY = "csb_settings";

  if (details.reason === "install") {
    chrome.storage.sync.set({
      [SETTINGS_KEY]: {
        enabled: true,
        messageLimit: 15,
        debug: false
      }
    });
    console.log("ChatGPT Speed installed.");
  }

  if (details.reason === "update") {
    console.log(
      "ChatGPT Speed updated to version",
      chrome.runtime.getManifest().version
    );
  }
});
