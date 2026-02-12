// config.js

(function initializeSharedConfig() {
  const DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    messageLimit: 15,
    autoRefreshEnabled: false,
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
      autoRefreshEnabled: input.autoRefreshEnabled ?? DEFAULT_SETTINGS.autoRefreshEnabled,
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
