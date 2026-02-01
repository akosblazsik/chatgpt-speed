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
  const refreshBtn = document.getElementById("refreshBtn");

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
   * Save settings to storage and sync to localStorage for page-script.
   */
  function saveSettings() {
    const settings = {
      enabled: toggleEnabledEl.checked,
      messageLimit: parseInt(messageLimitEl.value, 10) || 10,
      debug: toggleDebugEl.checked
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
  chrome.storage.sync.get({ [SETTINGS_KEY]: { enabled: true, messageLimit: 15, debug: false } }, (data) => {
    const settings = data[SETTINGS_KEY];
    toggleEnabledEl.checked = settings.enabled;
    messageLimitEl.value = settings.messageLimit;
    toggleDebugEl.checked = settings.debug;
    updateStatusText(settings.enabled);
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

  // Handle debug toggle change
  toggleDebugEl.addEventListener("change", () => {
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
  // Heart Animation for Support Card
  // -------------------------------------------------------------------------
  function initHeartAnimation() {
    const card = document.querySelector(".support-card");
    if (!card) return;

    function spawnHeart() {
      const heart = document.createElement("div");
      heart.classList.add("heart-float");
      heart.textContent = "❤️";

      const randomLeft = Math.floor(Math.random() * 80) + 10;
      const randomDuration = Math.random() * 1.5 + 2;
      const randomSize = Math.floor(Math.random() * 8) + 10;

      heart.style.left = `${randomLeft}%`;
      heart.style.fontSize = `${randomSize}px`;
      heart.style.animationDuration = `${randomDuration}s`;

      card.appendChild(heart);

      setTimeout(() => {
        heart.remove();
      }, randomDuration * 1000);
    }

    setInterval(spawnHeart, 1200);
    spawnHeart();
  }

  initHeartAnimation();
});
