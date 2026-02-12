// boot.js

(function initializeContentScript() {
  const booster = window.ChatGPTSpeedBooster;
  const state = booster.state;
  const log = booster.log;
  const config = booster.config;

  let promoInterval = null;

  // Storage keys
  const SETTINGS_KEY = "csb_settings";
  const LOCAL_STORAGE_KEY = "csb_config";
  const MESSAGE_CHANNEL = "chatgpt-speed";

  const configApi = window.ChatGPTSpeedConfig;
  const normalizeSettings = configApi?.normalizeSettings;
  const defaultSettings = configApi?.DEFAULT_SETTINGS || {
    enabled: true,
    messageLimit: 15,
    maxExtraMessages: 300,
    autoRefreshEnabled: false,
    debug: false,
    theme: "system"
  };

  // ---- Settings sync to localStorage (for page-script access) -----------

  function syncSettingsToLocalStorage(settings) {
    try {
      const cfg = normalizeSettings
        ? normalizeSettings(settings)
        : {
            enabled: settings.enabled ?? defaultSettings.enabled,
            messageLimit: settings.messageLimit ?? defaultSettings.messageLimit,
            maxExtraMessages: settings.maxExtraMessages ?? defaultSettings.maxExtraMessages,
            autoRefreshEnabled:
              settings.autoRefreshEnabled ?? defaultSettings.autoRefreshEnabled,
            debug: settings.debug ?? defaultSettings.debug,
            theme: settings.theme ?? defaultSettings.theme
          };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cfg));

      // Also dispatch event for page-script if it's already running
      window.dispatchEvent(
        new CustomEvent("csb-config", { detail: JSON.stringify(cfg) })
      );


    } catch {
      // localStorage may not be available
    }
  }

  // ---- Storage: enabled + debug flags -----------------------------------

  function initializeStorageListeners() {
    chrome.storage.sync.get({ [SETTINGS_KEY]: defaultSettings }, (data) => {
      const settings = normalizeSettings
        ? normalizeSettings(data[SETTINGS_KEY])
        : data[SETTINGS_KEY];
      state.enabled = settings.enabled;
      state.debug = settings.debug;
      state.messageLimit = settings.messageLimit;
      state.maxExtraMessages = settings.maxExtraMessages;
      state.autoRefreshEnabled = settings.autoRefreshEnabled;

      // Sync to localStorage for page-script
      syncSettingsToLocalStorage(settings);

      startPromoLogging();

      // Show badge on initial load after a delay to let page settle
      if (state.enabled) {
        setTimeout(() => {
          booster.activeBadge.showOnce();
        }, 1500);
      }
      
      // Update navigation button text if it exists (race condition fix)
      if (booster.navigation && booster.navigation.updateButtonText) {
        booster.navigation.updateButtonText();
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "sync") return;

      if (changes[SETTINGS_KEY]) {
        const settings = normalizeSettings
          ? normalizeSettings(changes[SETTINGS_KEY].newValue)
          : changes[SETTINGS_KEY].newValue;
        state.enabled = settings.enabled;
        state.debug = settings.debug;
        state.messageLimit = settings.messageLimit;
        state.maxExtraMessages = settings.maxExtraMessages;
        state.autoRefreshEnabled = settings.autoRefreshEnabled;

        // Sync to localStorage
        syncSettingsToLocalStorage(settings);

        log("Settings changed:", settings);
        
        // Update navigation button text if it exists
        if (booster.navigation && booster.navigation.updateButtonText) {
          booster.navigation.updateButtonText();
        }
      }
    });
  }

  // ---- Message listener for popup and settings sync ---------------------

  function isTrustedRuntimeSender(sender) {
    if (!sender || typeof sender !== "object") return false;
    if (sender.id !== chrome.runtime.id) return false;

    // Messages from extension pages (popup/options) won't include sender.tab.
    const extensionOrigin = chrome.runtime.getURL("");
    if (typeof sender.url === "string" && sender.url.startsWith(extensionOrigin)) {
      return true;
    }

    // Messages from other content scripts include sender.tab.
    if (!Number.isInteger(sender.tab?.id)) return false;

    const tabUrl = sender.tab?.url;
    if (typeof tabUrl !== "string") return false;

    return tabUrl.startsWith(window.location.origin + "/");
  }

  function isGetStatsMessage(message) {
    if (!message || typeof message !== "object") return false;
    return message.type === "getStats";
  }

  function isSyncSettingsMessage(message) {
    if (!message || typeof message !== "object") return false;
    if (message.type !== "syncSettings") return false;
    if (!message.settings || typeof message.settings !== "object") return false;
    return true;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isTrustedRuntimeSender(sender)) {
      return;
    }

    if (!message || typeof message !== "object" || typeof message.type !== "string") {
      sendResponse({ ok: false, error: "invalid_message" });
      return true;
    }

    // Handle stats request from popup
    if (isGetStatsMessage(message)) {
      sendResponse({
        ok: true,
        totalMessages: state.stats.totalMessages,
        renderedMessages: state.stats.renderedMessages,
        enabled: state.enabled
      });
      return true;
    }

    // Handle settings sync from popup
    if (isSyncSettingsMessage(message)) {
      syncSettingsToLocalStorage(message.settings);
      sendResponse({ ok: true });
      return true;
    }

    sendResponse({ ok: false, error: "unsupported_message" });
    return true;
  });

  // ---- Listen for status updates from page-script -----------------------

  function setupStatusListener() {
    // Listen for status updates from page-script via postMessage (cross-context)
    window.addEventListener("message", (event) => {
      const data = event.data;
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        !data ||
        typeof data !== "object" ||
        data.__csb !== true ||
        data.channel !== MESSAGE_CHANNEL ||
        typeof data.type !== "string"
      ) {
        return;
      }
      
      // Handle status updates
      if (data.type === "csb-status") {
        const status = data.payload;
        if (status && typeof status === "object") {
          state.stats.totalMessages = status.totalMessages || 0;
          state.stats.renderedMessages = status.renderedMessages || 0;
          
          // Store initial total to calculate updates during streaming
          if (!state.stats.initialTotalMessages) {
            state.stats.initialTotalMessages = status.totalMessages || 0;
          }
          
          // Show badges when first valid stats arrive
          if (state.enabled && status.totalMessages > 0) {
            booster.activeBadge.showOnce();
          }
          
          // Update navigation button text if it exists (for accurate "Load X older" count)
          if (booster.navigation && booster.navigation.updateButtonText) {
            booster.navigation.updateButtonText();
          }
        }
      }
      
      // Handle performance warning
      if (data.type === "csb-performance-warning") {
        showPerformanceWarning(data.payload);
      }
    });
  }

  // ---- Message Counter for Performance Warning ----------------------------

  let messageWatcherObserver = null;
  let messageObserverTarget = null;
  let baselineMessageCount = null;
  let lastKnownMessageCount = 0;
  let performanceWarningShown = false;
  let checkDebounceTimer = null;
  let checkScheduled = false;
  let pendingLastStatusTimer = null;
  let pendingLastStatusUrl = null;
  let autoRefreshPending = false;
  let waitForStreamEndTimer = null;

  /**
   * Count the number of visible message turns in the DOM.
   */
  function getMessageContainer() {
    const firstArticle = document.querySelector('article[data-testid^="conversation-turn-"]');
    return firstArticle?.parentElement || null;
  }

  function countMessageTurns() {
    const container = getMessageContainer();
    if (!container) return 0;
    const articles = container.querySelectorAll('article[data-testid^="conversation-turn-"]');
    return articles.length;
  }

  /**
   * Check if we should show the performance warning based on new messages.
   */
  function checkForPerformanceWarning() {
    if (!state.enabled) return;

    const currentCount = countMessageTurns();
    
    if (currentCount === 0) return;

    // Set baseline on first check
    if (baselineMessageCount === null) {
      baselineMessageCount = currentCount;
      lastKnownMessageCount = currentCount;

      return;
    }

    // Only process if message count increased
    if (currentCount <= lastKnownMessageCount) {
      return;
    }

    lastKnownMessageCount = currentCount;
    const newMessages = currentCount - baselineMessageCount;
    const limit = state.messageLimit || 15;

    // Update stats for popup
    if (state.stats) {
      // Calculate how many messages were added since we started watching
      const messagesAddedSinceBase = currentCount - baselineMessageCount;
      
      // Update totals
      // If we have a previous total, add the new messages to it
      // Otherwise fallback to current count
      state.stats.renderedMessages = currentCount;
      
      if (state.stats.initialTotalMessages) {
        state.stats.totalMessages = state.stats.initialTotalMessages + messagesAddedSinceBase;
      } else {
        // Fallback if we don't have initial total
        state.stats.totalMessages = Math.max(state.stats.totalMessages || 0, currentCount);
      }
      

    }

    // Show warning when enough new messages have been added
    if (newMessages >= limit && !performanceWarningShown) {
      log("Performance warning threshold reached");
      const triggered = showPerformanceWarning({
        turnsSinceRefresh: newMessages,
        limit
      });
      if (triggered) {
        performanceWarningShown = true;
      }
    }
  }

  function triggerAutoRefresh(detail) {
    if (autoRefreshPending) return;
    autoRefreshPending = true;
    const turns = detail?.turnsSinceRefresh ?? "many";
    log(`Auto-refresh triggered at ${turns} new messages (limit: ${state.messageLimit})`);
    booster.activeBadge.markForRefresh();
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "csbAutoRefreshTab" }, () => {
        if (!chrome.runtime.lastError) return;
        log("Background auto-refresh failed; falling back to location.reload()");
        window.location.reload();
      });
    }, 250);
  }

  function isResponseStreaming() {
    return Boolean(
      document.querySelector('[data-testid="stop-button"]') ||
      document.querySelector('[data-testid="composer-stop-button"]') ||
      document.querySelector('button[aria-label*="Stop"]')
    );
  }

  function clearStreamWaitTimer() {
    if (!waitForStreamEndTimer) return;
    clearInterval(waitForStreamEndTimer);
    waitForStreamEndTimer = null;
  }

  /**
   * Debounced check for performance warning.
   */
  function debouncedCheckPerformanceWarning() {
    if (checkDebounceTimer) {
      clearTimeout(checkDebounceTimer);
    }
    checkDebounceTimer = setTimeout(() => {
      checkDebounceTimer = null;
      if (checkScheduled) return;
      checkScheduled = true;

      const runCheck = () => {
        checkScheduled = false;
        checkForPerformanceWarning();
      };

      if ("requestIdleCallback" in window) {
        requestIdleCallback(runCheck, { timeout: 1000 });
      } else {
        requestAnimationFrame(runCheck);
      }
    }, 2000); // Wait 2 seconds after last mutation
  }

  /**
   * Start watching the DOM for new messages.
   */
  function startMessageWatcher() {
    if (messageWatcherObserver) {
      messageWatcherObserver.disconnect();
    }

    function getObserverTarget() {
      const firstArticle = document.querySelector('article[data-testid^="conversation-turn-"]');
      if (firstArticle && firstArticle.parentElement) {
        return firstArticle.parentElement;
      }
      return document.querySelector('main') || document.body;
    }

    messageObserverTarget = getObserverTarget();

    messageWatcherObserver = new MutationObserver((mutations) => {
      if (messageObserverTarget && messageObserverTarget !== document.body) {
        const nextTarget = getObserverTarget();
        if (nextTarget && nextTarget !== messageObserverTarget) {
          messageObserverTarget = nextTarget;
          messageWatcherObserver.disconnect();
          messageWatcherObserver.observe(messageObserverTarget, {
            childList: true,
            subtree: true
          });
          log("Message watcher target updated");
          return;
        }
      }

      const hasRelevantMutation = mutations.some(mutation => {
        if (mutation.type !== 'childList') return false;
        if (mutation.addedNodes.length === 0) return false;
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'ARTICLE' || node.querySelector?.('article')) {
              return true;
            }
          }
        }
        return false;
      });

      if (hasRelevantMutation) {
        debouncedCheckPerformanceWarning();
      }
    });

    messageWatcherObserver.observe(messageObserverTarget, {
      childList: true,
      subtree: true
    });

    log("Message watcher started");

    // Set initial baseline after a delay
    setTimeout(() => {
      if (baselineMessageCount === null) {
        const count = countMessageTurns();
        if (count > 0) {
          baselineMessageCount = count;
          lastKnownMessageCount = count;
          log("Initial message baseline set:", baselineMessageCount);
        }
      }
    }, 2000);
  }

  /**
   * Reset message watcher state (called on URL/chat change).
   */
  function resetMessageWatcher() {
    baselineMessageCount = null;
    lastKnownMessageCount = 0;
    performanceWarningShown = false;
    messageObserverTarget = null;
    if (checkDebounceTimer) {
      clearTimeout(checkDebounceTimer);
      checkDebounceTimer = null;
    }
    checkScheduled = false;
    if (pendingLastStatusTimer) {
      clearTimeout(pendingLastStatusTimer);
      pendingLastStatusTimer = null;
    }
    clearStreamWaitTimer();
    pendingLastStatusUrl = null;
    log("Message watcher state reset");
  }

  // ---- Performance Warning Badge -----------------------------------------

  /**
   * Show a performance warning badge when many new messages are added.
   */
  function showPerformanceWarning(detail) {
    if (isResponseStreaming()) {
      if (!waitForStreamEndTimer) {
        let checks = 0;
        waitForStreamEndTimer = setInterval(() => {
          checks += 1;
          if (checks > 60) {
            clearStreamWaitTimer();
            return;
          }
          if (isResponseStreaming()) return;
          clearStreamWaitTimer();
          const triggered = showPerformanceWarning(detail);
          if (triggered) {
            performanceWarningShown = true;
          }
        }, 500);
      }
      return false;
    }

    if (state.autoRefreshEnabled) {
      triggerAutoRefresh(detail);
      return true;
    }

    // Create and show a warning badge
    const existingBadge = document.getElementById("csb-performance-warning-badge");
    if (existingBadge) return true; // Already showing
    
    const badge = document.createElement("div");
    badge.id = "csb-performance-warning-badge";
    
    const header = document.querySelector("header#page-header");
    let headerContainer = null;
    if (header) {
      headerContainer = header.querySelector('[data-csb-header-badges]');
      if (!headerContainer) {
        headerContainer = document.createElement("div");
        headerContainer.setAttribute("data-csb-header-badges", "1");
        Object.assign(headerContainer.style, {
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          marginLeft: "8px",
          pointerEvents: "auto",
          whiteSpace: "nowrap"
        });
        const modelButton = header.querySelector('[data-testid="model-switcher-dropdown-button"]');
        if (modelButton && modelButton.parentElement) {
          modelButton.parentElement.insertAdjacentElement("afterend", headerContainer);
        } else {
          header.appendChild(headerContainer);
        }
      }
    }

    let posStyles = {};
    if (headerContainer) {
      posStyles = {
        position: "relative",
        left: "auto",
        right: "auto",
        top: "auto",
        bottom: "auto"
      };
    } else {
      // Find chat input to position relative to it (fallback)
      const inputEl = document.querySelector("#prompt-textarea");
      let targetEl = inputEl;

      if (inputEl) {
        const wrapper = inputEl.closest('[class*="bg-token-bg-primary"]') || inputEl.closest("form");
        if (wrapper) targetEl = wrapper;
      }

      posStyles = {
        position: "fixed",
        left: "20px",
        bottom: "150px"
      };

      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        const bottomVal = window.innerHeight - rect.top + 10;
        posStyles = {
          position: "fixed",
          left: `${rect.left}px`,
          bottom: `${bottomVal}px`,
          top: "auto",
          right: "auto"
        };
      }
    }

    Object.assign(badge.style, {
      ...posStyles,
      background: "linear-gradient(135deg, #ff9500, #ff5e3a)",
      color: "#fff",
      padding: headerContainer ? "6px 10px" : "10px 16px",
      borderRadius: headerContainer ? "8px" : "10px",
      boxShadow: headerContainer ? "0 2px 8px rgba(0,0,0,0.25)" : "0 4px 20px rgba(0,0,0,0.3)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: headerContainer ? "12px" : "13px",
      fontWeight: "500",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      cursor: "pointer",
      transition: "transform 0.2s ease, opacity 0.3s ease",
      maxWidth: headerContainer ? "280px" : "400px"
    });
    
    const messageCount = detail?.turnsSinceRefresh || "many";
    
    badge.innerHTML = `
      <span>💡</span>
      <span>${messageCount} new messages. <strong>Refresh</strong> for speed!</span>
    `;
    
    badge.addEventListener("mouseenter", () => {
      badge.style.transform = "scale(1.02)";
    });
    
    badge.addEventListener("mouseleave", () => {
      badge.style.transform = "scale(1)";
    });
    
    const dismissBadge = () => {
      badge.style.opacity = "0";
      setTimeout(() => badge.remove(), 300);
    };
    
    badge.addEventListener("click", dismissBadge);
    
    if (headerContainer) {
      headerContainer.appendChild(badge);
    } else {
      badge.style.zIndex = "9999";
      document.body.appendChild(badge);
    }
    log("Performance warning badge shown");
    
    // Auto-dismiss after 7 seconds
    setTimeout(dismissBadge, 7000);
    return true;
  }

  // ---- Shameless self promotion -----------------------------------------

  function startPromoLogging() {
    if (!state.debug) return;
    if (promoInterval) return;

    booster.logPromoMessage();

    promoInterval = setInterval(() => {
      booster.logPromoMessage();
    }, 5 * 60000);
  }

  function stopPromoLogging() {
    if (promoInterval) {
      clearInterval(promoInterval);
      promoInterval = null;
    }
  }

  // ---- URL watcher (for chat navigation) --------------------------------

  function startUrlWatcher() {
    if (state.urlWatcherInterval) {
      clearInterval(state.urlWatcherInterval);
    }

    state.urlWatcherInterval = setInterval(() => {
      if (window.location.href !== state.lastUrl) {
        state.lastUrl = window.location.href;
        log("URL changed → resetting for new chat");

        // Reset badges for new chat
        booster.activeBadge.reset();
        // Reset stats for new conversation - will be updated when page-script dispatches new status
        // We reset here to avoid showing stale stats from previous conversation
        state.stats = {
          totalMessages: 0,
          renderedMessages: 0,
          initialTotalMessages: null  // Reset this too so it gets set fresh for new convo
        };

        // Reset navigation state (always show newest on new chat)
        if (booster.navigation && booster.navigation.clearExtraMessages) {
          booster.navigation.clearExtraMessages();
        }
        if (booster.navigation && booster.navigation.resetForConversationChange) {
          booster.navigation.resetForConversationChange();
        }
        
        // Clear navigation handshake flags
        try {
          sessionStorage.removeItem("csb_last_status");
          sessionStorage.removeItem("csb_navigating");
          sessionStorage.removeItem("csb_ack");
        } catch(e) {}

        // Reset and restart message watcher for new chat
        resetMessageWatcher();
        setTimeout(() => {
          startMessageWatcher();
        }, 2000);

        // Show badge after URL change (let page settle)
        if (state.enabled) {
          setTimeout(() => {
            booster.activeBadge.showOnce();
          }, 1500);
        }
      }
    }, config.URL_CHECK_INTERVAL);
  }

  // ---- Entry point ------------------------------------------------------

  /**
   * Intercept clicks on sidebar chat links to force full page navigation.
   * This ensures a clean state when switching conversations.
   */
  function setupChatLinkInterceptor() {
    document.addEventListener("click", (event) => {
      // Find if click was on a chat link (may be nested inside the <a>)
      const link = event.target.closest('a[href*="/c/"]');
      
      if (link && link.href) {
        const currentPath = window.location.pathname;
        const linkPath = new URL(link.href).pathname;
        
        // Only intercept if navigating to a different conversation
        if (linkPath !== currentPath && linkPath.startsWith('/c/')) {
          event.preventDefault();
          event.stopPropagation();
          
          // Clear extraMessages before navigating
          localStorage.removeItem("csb_extra_messages");
          
          // Clear all session state for clean switch
          sessionStorage.removeItem("csb_last_status");
          sessionStorage.removeItem("csb_navigating");
          sessionStorage.removeItem("csb_ack");
          
          log("Intercepted chat link click, forcing full navigation to:", linkPath);
          window.location.href = link.href;
        }
      }
    }, true); // Use capture phase to intercept before React
    
    log("Chat link interceptor set up");
  }

  function initialize() {
    log("Initializing ChatGPT Speed");

    initializeStorageListeners();
    setupStatusListener();
    startUrlWatcher();
    setupChatLinkInterceptor();
    
    // Start message watcher after page settles
    setTimeout(() => {
      startMessageWatcher();
    }, 3000);
    
    // Check for any status that was dispatched before we initialized
    // (sessionStorage backup for timing issues)
    setTimeout(() => {
      try {
        const storedStatus = sessionStorage.getItem("csb_last_status");
        if (storedStatus && state.stats.totalMessages === 0) {
          const status = JSON.parse(storedStatus);
          // Validate URL matches current page
          if (status && status.url === window.location.href) {
            state.stats.totalMessages = status.totalMessages || 0;
            state.stats.renderedMessages = status.renderedMessages || 0;
            log("Stats loaded from sessionStorage backup:", state.stats);
            
            // Update navigation button
            if (booster.navigation && booster.navigation.updateButtonText) {
              booster.navigation.updateButtonText();
            }
          }
        }
        if (storedStatus) {
          const status = JSON.parse(storedStatus);
          if (status && status.url) {
            pendingLastStatusUrl = status.url;
            if (!pendingLastStatusTimer) {
              pendingLastStatusTimer = setTimeout(() => {
                try {
                  if (pendingLastStatusUrl && window.location.href !== pendingLastStatusUrl) {
                    sessionStorage.removeItem("csb_last_status");
                  }
                } catch (e) {
                  // sessionStorage might not be available
                }
                pendingLastStatusTimer = null;
                pendingLastStatusUrl = null;
              }, 10000);
            }
          }
        }
      } catch (e) {
        // sessionStorage might not be available
      }
    }, 500);
  }

  // Clean up on page unload
  window.addEventListener("beforeunload", () => {
    stopPromoLogging();
    if (state.urlWatcherInterval) {
      clearInterval(state.urlWatcherInterval);
    }
    if (messageWatcherObserver) {
      messageWatcherObserver.disconnect();
    }
    if (checkDebounceTimer) {
      clearTimeout(checkDebounceTimer);
    }
    clearStreamWaitTimer();
  });

  // Initialize when ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
