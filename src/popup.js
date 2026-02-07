// popup.js

document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const totalMessagesEl = document.getElementById("statTotalMessages");
  const renderedMessagesEl = document.getElementById("statRenderedMessages");
  const memorySavedEl = document.getElementById("statMemorySaved");
  const statusEl = document.getElementById("statStatus");
  const toggleEnabledEl = document.getElementById("toggleEnabled");
  const toggleDebugEl = document.getElementById("toggleDebug");
  const messageLimitEl = document.getElementById("messageLimit");
  const maxExtraMessagesEl = document.getElementById("maxExtraMessages");
  const refreshBtn = document.getElementById("refreshBtn");
  const themeModeEl = document.getElementById("themeMode");

  // Storage keys
  const SETTINGS_KEY = "csb_settings";
  const STATS_CACHE_KEY = "csb_cachedStats";

  /**
   * Update status text and styling based on enabled state.
   */
  function updateStatusText(enabled) {
    statusEl.textContent = enabled ? "Active" : "Disabled";
    statusEl.classList.toggle("status-active", enabled);
    statusEl.classList.toggle("status-disabled", !enabled);
  }

  /**
   * Display stats in the popup UI.
   */
  function displayStats(stats) {
    const total = stats.totalMessages || 0;
    const rendered = stats.renderedMessages || 0;
    
    totalMessagesEl.textContent = String(total);
    renderedMessagesEl.textContent = String(rendered);
    
    // Calculate memory saved percentage
    const memorySaved = total > 0 ? Math.round(((total - rendered) / total) * 100) : 0;
    memorySavedEl.textContent = `${memorySaved}%`;
  }

  /**
   * Apply theme class to the document root.
   */
  function applyTheme(theme) {
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark", "theme-system");
    if (theme === "dark") {
      root.classList.add("theme-dark");
    } else if (theme === "light") {
      root.classList.add("theme-light");
    } else {
      root.classList.add("theme-system");
    }
  }

  /**
   * Save settings to storage and sync to localStorage for page-script.
   */
  function saveSettings() {
    const settings = {
      enabled: toggleEnabledEl.checked,
      messageLimit: parseInt(messageLimitEl.value, 10) || 10,
      maxExtraMessages: parseInt(maxExtraMessagesEl.value, 10) || 300,
      debug: toggleDebugEl.checked,
      theme: themeModeEl.value
    };

    chrome.storage.sync.set({ [SETTINGS_KEY]: settings });

    // Also sync to localStorage for page-script access
    syncSettingsToActiveTab(settings);
  }

  /**
   * Send settings to active tab's content script.
   */
  function syncSettingsToActiveTab(settings) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || !activeTab.id) return;

      chrome.tabs.sendMessage(activeTab.id, {
        type: "syncSettings",
        settings
      }).catch(() => {
        // Tab may not have content script running
      });
    });
  }

  // Load initial settings from storage
  chrome.storage.sync.get(
    { [SETTINGS_KEY]: { enabled: true, messageLimit: 15, maxExtraMessages: 300, debug: false, theme: "system" } },
    (data) => {
    const settings = data[SETTINGS_KEY];
    toggleEnabledEl.checked = settings.enabled;
    messageLimitEl.value = settings.messageLimit;
    maxExtraMessagesEl.value = settings.maxExtraMessages ?? 300;
    toggleDebugEl.checked = settings.debug;
    themeModeEl.value = settings.theme || "system";
    updateStatusText(settings.enabled);
    applyTheme(themeModeEl.value);
  });

  // Handle enabled toggle change
  toggleEnabledEl.addEventListener("change", () => {
    updateStatusText(toggleEnabledEl.checked);
    saveSettings();
  });

  // Handle message limit change
  messageLimitEl.addEventListener("change", () => {
    // Clamp value between 1 and 100
    let value = parseInt(messageLimitEl.value, 10);
    if (isNaN(value) || value < 1) value = 1;
    if (value > 100) value = 100;
    messageLimitEl.value = value;
    saveSettings();
  });

  maxExtraMessagesEl.addEventListener("change", () => {
    let value = parseInt(maxExtraMessagesEl.value, 10);
    if (isNaN(value) || value < 0) value = 0;
    if (value > 1000) value = 1000;
    maxExtraMessagesEl.value = value;
    saveSettings();
  });

  // Handle debug toggle change
  toggleDebugEl.addEventListener("change", () => {
    saveSettings();
  });

  // Handle theme change
  themeModeEl.addEventListener("change", () => {
    applyTheme(themeModeEl.value);
    saveSettings();
  });

  // Handle refresh button
  refreshBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        chrome.tabs.reload(activeTab.id);
        window.close();
      }
    });
  });

  /**
   * Fetch and display stats from the active tab.
   */
  function updateStatsUI() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab || activeTab.id == null) return;

      const url = activeTab.url || "";
      const isChatGPTTab =
        url.startsWith("https://chat.openai.com/") ||
        url.startsWith("https://chatgpt.com/");

      // Don't try to communicate with tabs where our content script doesn't run
      if (!isChatGPTTab) {
        displayStats({ totalMessages: 0, renderedMessages: 0 });
        updateStatusText(false);
        return;
      }

      // Load cached stats immediately to prevent flash of zeros
      chrome.storage.local.get(STATS_CACHE_KEY, (data) => {
        const cached = data[STATS_CACHE_KEY];
        if (cached && cached.url === url) {
          displayStats(cached.stats);
        }
      });

      // Request fresh stats from content script
      chrome.tabs.sendMessage(
        activeTab.id,
        { type: "getStats" },
        (response) => {
          if (chrome.runtime.lastError) {
            console.debug(
              "[ChatGPT Speed] No stats available:",
              chrome.runtime.lastError.message
            );
            return;
          }

          if (!response) return;

          const { totalMessages, renderedMessages, enabled } = response;

          const freshStats = { totalMessages, renderedMessages };
          displayStats(freshStats);

          // Cache for next popup open
          chrome.storage.local.set({
            [STATS_CACHE_KEY]: { url, stats: freshStats }
          });

          updateStatusText(enabled);
        }
      );
    });
  }

  updateStatsUI();

  // -------------------------------------------------------------------------
  // Footer ad-board text animation
  // -------------------------------------------------------------------------
  function initAdBoardText() {
    const board = document.querySelector(".ad-board");
    if (!board) return;
    const text = board.textContent || "";
    board.textContent = "";

    const makeLine = () => {
      const line = document.createElement("span");
      line.className = "ad-board-line";
      Array.from(text).forEach((char) => {
        const span = document.createElement("span");
        span.className = "ad-board-char";
        span.textContent = char === " " ? "\u00A0" : char;
        line.appendChild(span);
      });
      return line;
    };

    const track = document.createElement("span");
    track.className = "ad-board-track";
    track.appendChild(makeLine());
    track.appendChild(makeLine());
    board.appendChild(track);

    const charCount = Math.max(1, Array.from(text).length);
    const durationSeconds = Math.max(10, charCount * 0.15);
    board.style.setProperty("--char-count", String(charCount));
    board.style.setProperty("--duration", `${durationSeconds}s`);
  }

  initAdBoardText();

});
