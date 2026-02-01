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

  /**
   * Sync settings from browser.storage to localStorage.
   */
  async function syncSettingsToLocalStorage() {
    try {
      const result = await chrome.storage.sync.get(STORAGE_KEY);
      const stored = result[STORAGE_KEY];

      if (stored) {
        const config = {
          enabled: stored.enabled ?? true,
          messageLimit: stored.messageLimit ?? 10,
          debug: stored.debug ?? false
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config));
      }
    } catch {
      // Storage access failed - page-script will use defaults
    }
  }

  // Execute immediately:
  // Start syncing settings (async)
  // page-script.js is now loaded via manifest (world: MAIN)
  syncSettingsToLocalStorage();
})();
