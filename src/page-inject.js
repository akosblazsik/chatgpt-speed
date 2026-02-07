// page-inject.js

/**
 * ChatGPT Speed - Page Script Injector
 * 
 * This content script runs at document_start to:
 * 1. Sync settings from browser.storage to localStorage
 * 2. Inject the page script into page context BEFORE ChatGPT loads
 * 
 * This is critical for patching window.fetch before ChatGPT's code uses it.
 */

(function injectPageScript() {
  const STORAGE_KEY = "csb_settings";
  const LOCAL_STORAGE_KEY = "csb_config";

  const configApi = window.ChatGPTSpeedConfig;
  const normalizeSettings = configApi?.normalizeSettings;
  const defaults = configApi?.DEFAULT_SETTINGS || {
    enabled: true,
    messageLimit: 15,
    maxExtraMessages: 300,
    debug: false,
    theme: "system"
  };

  /**
   * Sync settings from browser.storage to localStorage.
   */
  async function syncSettingsToLocalStorage() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY];

      if (stored) {
        const config = normalizeSettings ? normalizeSettings(stored) : {
          enabled: stored.enabled ?? defaults.enabled,
          messageLimit: stored.messageLimit ?? defaults.messageLimit,
          maxExtraMessages: stored.maxExtraMessages ?? defaults.maxExtraMessages,
          debug: stored.debug ?? defaults.debug,
          theme: stored.theme ?? defaults.theme
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
      }
    } catch {
      // Storage access failed - page-script will use defaults
    }
  }

  syncSettingsToLocalStorage();
})();
