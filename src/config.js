// config.js

(function initializeSharedConfig() {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    messageLimit: 15,
    maxExtraMessages: 300,
    autoRefreshEnabled: false,
    autoRefreshAfter: 15,
    debug: false,
    theme: "system"
  });

  function clampNumber(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    if (parsed < min) return min;
    if (parsed > max) return max;
    return parsed;
  }

  function normalizeSettings(input = {}) {
    return {
      enabled: input.enabled ?? DEFAULT_SETTINGS.enabled,
      messageLimit: clampNumber(
        input.messageLimit,
        DEFAULT_SETTINGS.messageLimit,
        1,
        100
      ),
      maxExtraMessages: clampNumber(
        input.maxExtraMessages,
        DEFAULT_SETTINGS.maxExtraMessages,
        0,
        1000
      ),
      autoRefreshEnabled: input.autoRefreshEnabled ?? DEFAULT_SETTINGS.autoRefreshEnabled,
      autoRefreshAfter: clampNumber(
        input.autoRefreshAfter,
        DEFAULT_SETTINGS.autoRefreshAfter,
        1,
        200
      ),
      debug: input.debug ?? DEFAULT_SETTINGS.debug,
      theme: ["system", "light", "dark"].includes(input.theme)
        ? input.theme
        : DEFAULT_SETTINGS.theme
    };
  }

  const api = {
    DEFAULT_SETTINGS,
    normalizeSettings
  };

  window.ChatGPTSpeedConfig = api;
})();
