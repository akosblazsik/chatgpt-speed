// constants.js

/**
 * Global namespace for the ChatGPT Speed extension.
 */
window.ChatGPTSpeedBooster = window.ChatGPTSpeedBooster || {};

(function initializeConstants() {
  const booster = window.ChatGPTSpeedBooster;

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
    enabled: true,
    debug: false,
    messageLimit: 15,
    maxExtraMessages: 300,

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
Made by Bram van der Giessen

Debug mode is enabled for this extension.
To disable, open the extension popup and uncheck "Debug Mode".

⭐ GitHub: https://github.com/bramgiessen
🧑‍💻 Hire me: https://bramgiessen.com
`,
      "color:#4c8bf5; font-size:15px; font-weight:bold;"
    );
  };
})();
