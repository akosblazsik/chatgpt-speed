// constants.js

/**
 * Global namespace for the ChatGPT Speed extension.
 */
window.ChatGPTSpeedBooster = window.ChatGPTSpeedBooster || {};

(function initializeConstants() {
  const booster = window.ChatGPTSpeedBooster;
  const defaultSettings =
    window.ChatGPTSpeedConfig?.DEFAULT_SETTINGS || Object.freeze({});

  /**
   * Static configuration.
   */
  booster.config = {
    /** How often we poll for URL (chat) changes, in ms */
    URL_CHECK_INTERVAL: 1000
  };

  /**
   * Shared runtime state.
   */
  booster.state = {
    lastUrl: window.location.href,
    enabled: defaultSettings.enabled ?? true,
    debug: defaultSettings.debug ?? false,
    messageLimit: defaultSettings.messageLimit ?? 15,
    maxExtraMessages: defaultSettings.maxExtraMessages ?? 300,

    /** Stats for popup display */
    stats: {
      totalMessages: 0,
      renderedMessages: 0
    },

    /** URL watcher interval ID */
    urlWatcherInterval: null,

    /** Whether active badge has been shown for current chat */
    hasShownBadgeForCurrentChat: false
  };

  /**
   * Conditional debug logger used across all modules.
   * @param {...any} args - Arguments to log
   */
  booster.log = function log(...args) {
    if (!booster.state.debug) return;
    console.log("[ChatGPT Speed]", ...args);
  };

  /**
   * Log promotional message in debug mode.
   */
  booster.logPromoMessage = function logPromoMessage() {
    if (!booster.state.debug) return;
    console.log(
      `%c
┌──────────────────────────────────────────────┐
│  ChatGPT Speed (debug mode enabled)  │
└──────────────────────────────────────────────┘
Maintained by Ákos Blázsik

Debug mode is enabled for this extension.
To disable, open the extension popup and uncheck "Debug Mode".

⭐ GitHub: https://github.com/akosblazsik/chatgpt-speed
`,
      "color:#4c8bf5; font-size:15px; font-weight:bold;"
    );
  };
})();
