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

  // ---- Settings sync to localStorage (for page-script access) -----------

  function syncSettingsToLocalStorage(settings) {
    try {
      const cfg = {
        enabled: settings.enabled ?? true,
        messageLimit: settings.messageLimit ?? 10,
        maxExtraMessages: settings.maxExtraMessages ?? 300,
        debug: settings.debug ?? false
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
    chrome.storage.sync.get({ [SETTINGS_KEY]: { enabled: true, messageLimit: 15, maxExtraMessages: 300, debug: false } }, (data) => {
      const settings = data[SETTINGS_KEY];
      state.enabled = settings.enabled;
      state.debug = settings.debug;
      state.messageLimit = settings.messageLimit;
      state.maxExtraMessages = settings.maxExtraMessages ?? 300;

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
        const settings = changes[SETTINGS_KEY].newValue;
        state.enabled = settings.enabled;
        state.debug = settings.debug;
        state.messageLimit = settings.messageLimit;
        state.maxExtraMessages = settings.maxExtraMessages ?? 300;

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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message) return;

    // Handle stats request from popup
    if (message.type === "getStats") {
      sendResponse({
        totalMessages: state.stats.totalMessages,
        renderedMessages: state.stats.renderedMessages,
        enabled: state.enabled
      });
      return true;
    }

    // Handle settings sync from popup
    if (message.type === "syncSettings") {
      syncSettingsToLocalStorage(message.settings);
      return true;
    }
  });

  // ---- Listen for status updates from page-script -----------------------

  function setupStatusListener() {
    // Listen for status updates from page-script via postMessage (cross-context)
    window.addEventListener("message", (event) => {
      if (!event.data || !event.data.type) return;
      
      // Handle status updates
      if (event.data.type === "csb-status") {
        const status = event.data.payload;
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
      if (event.data.type === "csb-performance-warning") {
        showPerformanceWarning(event.data.payload);
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
      performanceWarningShown = true;
      log("Performance warning triggered!");
      showPerformanceWarning({ turnsSinceRefresh: newMessages, limit: limit });
    }
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
    log("Message watcher state reset");
  }

  // ---- Performance Warning Badge -----------------------------------------

  /**
   * Show a performance warning badge when many new messages are added.
   */
  function showPerformanceWarning(detail) {
    // Create and show a warning badge
    const existingBadge = document.getElementById("csb-performance-warning-badge");
    if (existingBadge) return; // Already showing
    
    const badge = document.createElement("div");
    badge.id = "csb-performance-warning-badge";
    
    // Find chat input to position relative to it (same as other badges)
    const inputEl = document.querySelector("#prompt-textarea");
    let targetEl = inputEl;

    if (inputEl) {
      const wrapper = inputEl.closest('[class*="bg-token-bg-primary"]') || inputEl.closest("form");
      if (wrapper) targetEl = wrapper;
    }

    let posStyles = {
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

    Object.assign(badge.style, {
      ...posStyles,
      background: "linear-gradient(135deg, #ff9500, #ff5e3a)",
      color: "#fff",
      padding: "10px 16px",
      borderRadius: "10px",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      zIndex: "9999",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: "13px",
      fontWeight: "500",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      cursor: "pointer",
      transition: "transform 0.2s ease, opacity 0.3s ease",
      maxWidth: "400px"
    });
    
    const messageCount = detail?.turnsSinceRefresh || "many";
    
    badge.innerHTML = `
      <span>💡</span>
      <span>You've added ${messageCount} new messages. If performance becomes slow, <strong>refresh the page</strong> to restore speed!</span>
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
    
    document.body.appendChild(badge);
    log("Performance warning badge shown");
    
    // Auto-dismiss after 7 seconds
    setTimeout(dismissBadge, 7000);
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
        
        // Clear navigation handshake flags
        try {
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
  });

  // Initialize when ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }
})();
