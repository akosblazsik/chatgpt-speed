// navigation.js

/**
 * ChatGPT Speed - Navigation UI
 * 
 * Provides "Load X older messages" button for progressively loading
 * more messages (at cost of performance).
 */

(function initializeNavigation() {
  const booster = window.ChatGPTSpeedBooster;
  const state = booster.state;
  const log = booster.log;

  const EXTRA_MESSAGES_KEY = "csb_extra_messages";
  const NAV_FLAG_KEY = "csb_navigating";
  const SCROLL_RESTORE_KEY = "csb_scroll_restore";
  const NAV_ATTRIBUTE = "data-csb-navigation";

  let loadMoreButton = null;
  let hasOlderMessages = false;
  let buttonInserted = false;

  // ---- State Management ----

  function checkNavigationFlag() {
    try {
      const isNavigating = sessionStorage.getItem(NAV_FLAG_KEY);
      
      // Deterministic Handshake: Wait for page-script.js (async) to ACK that it read the flag
      // This ensures we don't delete the flag too early (race condition) or too late (sticky state)
      if (isNavigating) {
        const checkAck = setInterval(() => {
          if (sessionStorage.getItem("csb_ack")) {
            sessionStorage.removeItem(NAV_FLAG_KEY);
            sessionStorage.removeItem("csb_ack");
            clearInterval(checkAck);
            // log("Handshake complete: Flag and Ack removed"); 
          }
        }, 50);
        
        // Safety timeout (5s) to prevent flag from sticking forever if page-script fails
        setTimeout(() => {
           clearInterval(checkAck);
           if (sessionStorage.getItem(NAV_FLAG_KEY)) {
             sessionStorage.removeItem(NAV_FLAG_KEY);
             // log("Handshake timeout: Force removed flag");
           }
        }, 5000);
      }
      
      if (!isNavigating) {
        clearExtraMessages();
        log("Manual refresh detected - resetting to newest messages only");
      } else {
        // This is a navigation reload - set up scroll restoration watcher
        setupScrollRestoreWatcher();
      }
    } catch {
      // sessionStorage not available
    }
  }

  function getExtraMessages() {
    try {
      const stored = localStorage.getItem(EXTRA_MESSAGES_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.url === window.location.href) {
          return data.extra || 0;
        }
      }
    } catch {
      // localStorage not available
    }
    return 0;
  }

  function setExtraMessages(extra) {
    try {
      sessionStorage.setItem(NAV_FLAG_KEY, "true");
      localStorage.setItem(EXTRA_MESSAGES_KEY, JSON.stringify({
        url: window.location.href,
        extra: extra
      }));
    } catch {
      // localStorage not available
    }
  }

  function clearExtraMessages() {
    try {
      localStorage.removeItem(EXTRA_MESSAGES_KEY);
    } catch {
      // localStorage not available
    }
  }

  // ---- Scroll Position Management ----

  function getScrollContainer() {
    // ChatGPT uses various scroll containers - try multiple selectors
    const selectors = [
      // The main scrollable div inside the conversation
      'div[class*="react-scroll-to-bottom"]',
      // Overflow container inside main
      'main div[class*="overflow-y-auto"]',
      // Alternative - parent of first message
      'article[data-testid^="conversation-turn-"]'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        // For the article, get its scrollable parent
        if (selector.includes('article')) {
          let parent = el.parentElement;
          while (parent && parent !== document.body) {
            const style = getComputedStyle(parent);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
              log("Found scroll container via article parent:", parent.className);
              return parent;
            }
            parent = parent.parentElement;
          }
        } else {
          log("Found scroll container:", selector);
          return el;
        }
      }
    }
    
    log("Could not find scroll container!");
    return null;
  }

  function saveScrollPosition() {
    try {
      const container = getScrollContainer();
      if (!container) return;

      // Find the first visible message to anchor to
      const articles = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn-"]'));
      
      let anchorId = null;
      let anchorType = "testid"; // 'testid' or 'uuid'
      let anchorOffset = 0;

      for (const article of articles) {
        const rect = article.getBoundingClientRect();
        // Check if top of article is within or below the top of the viewport
        if (rect.top >= 0 || rect.bottom > 50) {
          // Prefer strict UUID if available (user suggested data-turn-id, checking variations)
          // Often it's on a child element or the article itself
          // We will try to find a stable UUID
          const uuid = article.getAttribute("data-turn-id") || 
                       article.querySelector('[data-message-id]')?.getAttribute('data-message-id');

          if (uuid) {
            anchorId = uuid;
            anchorType = "uuid";
          } else {
            anchorId = article.getAttribute("data-testid");
            anchorType = "testid";
          }

          anchorOffset = rect.top; 
          break;
        }
      }

      if (anchorId) {
        const scrollData = {
          anchorId: anchorId,
          anchorType: anchorType,
          anchorOffset: anchorOffset
        };
        sessionStorage.setItem(SCROLL_RESTORE_KEY, JSON.stringify(scrollData));
        log("Saved scroll anchor:", scrollData);
      }
    } catch (e) {
      log("Error saving scroll position:", e);
    }
  }

  function restoreScrollPositionNow() {
    const stored = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (!stored) return false;
    
    try {
      const data = JSON.parse(stored);
      
      if (data.anchorId) {
        let anchorElement = null;

        if (data.anchorType === "uuid") {
           anchorElement = document.querySelector(`article[data-turn-id="${data.anchorId}"]`) || 
                           document.querySelector(`[data-message-id="${data.anchorId}"]`)?.closest('article');
        } else {
           anchorElement = document.querySelector(`article[data-testid="${data.anchorId}"]`);
        }
        
        if (anchorElement) {
          sessionStorage.removeItem(SCROLL_RESTORE_KEY);
          
          log("Found anchor element:", data.anchorId, "Type:", data.anchorType);
          
          // Step 1: Use scrollIntoView to quickly get the element on screen
          // This handles the large (97k+ pixel) offsets reliably
          anchorElement.scrollIntoView({ block: 'start', behavior: 'instant' });
          
          // Step 2: Fine-tune the position based on the original offset
          // Now the element should be near the top of the viewport
          // We need to adjust so it's at data.anchorOffset from the top
          const container = getScrollContainer();
          if (container && data.anchorOffset !== undefined) {
            // After scrollIntoView, element is at the top (rect.top ≈ 0)
            // We want it at anchorOffset from top, so scroll up by anchorOffset
            // (negative anchorOffset means element was partially scrolled off top)
            const elementRect = anchorElement.getBoundingClientRect();
            const adjustment = elementRect.top - data.anchorOffset;
            
            if (Math.abs(adjustment) > 1) {
              container.scrollTop += adjustment;
              log("Fine-tuned scroll by:", adjustment);
            }
          }
          
          log("Scroll restored to anchor element");
          return true;
        } else {
          log("Anchor element not found:", data.anchorId);
        }
      }
    } catch (e) {
      log("Error restoring scroll position:", e);
    }
    return false;
  }

  // Watch for messages to be rendered and then restore scroll
  let scrollRestoreObserver = null;
  let scrollRestoreRetryCount = 0;
  const MAX_SCROLL_RESTORE_RETRIES = 10;

  function attemptScrollRestore() {
    if (restoreScrollPositionNow()) {
      // Success!
      if (scrollRestoreObserver) {
        scrollRestoreObserver.disconnect();
        scrollRestoreObserver = null;
      }
      scrollRestoreRetryCount = 0;
      log("Scroll restored successfully");
      return;
    }

    // If we still have scroll data saving, the anchor wasn't found yet
    const hasScrollData = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (!hasScrollData) {
      // Data was cleared (no restore needed or already done)
      scrollRestoreRetryCount = 0;
      return;
    }

    // Retry if under limit
    scrollRestoreRetryCount++;
    if (scrollRestoreRetryCount < MAX_SCROLL_RESTORE_RETRIES) {
      log(`Scroll restore retry ${scrollRestoreRetryCount}/${MAX_SCROLL_RESTORE_RETRIES}...`);
      setTimeout(attemptScrollRestore, 500);
    } else {
      log("Scroll restore failed after max retries - anchor element never appeared");
      sessionStorage.removeItem(SCROLL_RESTORE_KEY);
      scrollRestoreRetryCount = 0;
    }
  }

  function setupScrollRestoreWatcher() {
    // Check if we have scroll data to restore
    const hasScrollData = sessionStorage.getItem(SCROLL_RESTORE_KEY);
    if (!hasScrollData) return;

    log("Setting up scroll restore watcher");
    scrollRestoreRetryCount = 0;

    // Use MutationObserver to watch for message articles appearing
    scrollRestoreObserver = new MutationObserver((mutations, observer) => {
      // Look for article elements (messages)
      const articles = document.querySelectorAll('article[data-testid^="conversation-turn-"]');
      
      // Wait until at least 5 articles are rendered (or fewer if that's all there are)
      if (articles.length >= 5) {
        // Enough messages rendered - begin restoration attempts
        observer.disconnect();
        scrollRestoreObserver = null;
        
        // Wait briefly for layout to stabilize, then start trying immediately
        log(`${articles.length} articles detected, starting scroll restore...`);
        setTimeout(attemptScrollRestore, 50);
      }
    });

    // Start observing
    scrollRestoreObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Fallback timeout - if observer doesn't trigger within 3 seconds, start trying anyway
    setTimeout(() => {
      if (scrollRestoreObserver) {
        scrollRestoreObserver.disconnect();
        scrollRestoreObserver = null;
        log("Fallback: Starting scroll restore attempts");
        attemptScrollRestore();
      }
    }, 3000);
  }

  // ---- Navigation Action ----

  function loadOlderMessages() {
    const limit = state.messageLimit || 10;
    const currentExtra = getExtraMessages();
    
    // Calculate new messages added during this session
    let newMessages = 0;
    if (state.stats && state.stats.totalMessages && state.stats.initialTotalMessages) {
      newMessages = Math.max(0, state.stats.totalMessages - state.stats.initialTotalMessages);
    }
    
    // Increment extra messages by the limit PLUS any new messages that pushed old ones out
    // If user added 15 messages, we need to request 15 + 15 = 30 extra to see 15 old ones.
    const newExtra = currentExtra + limit + newMessages;
    
    log(`Loading ${limit} more older messages (total extra: ${newExtra})`);
    
    // Save scroll position before reload
    saveScrollPosition();
    
    setExtraMessages(newExtra);
    window.location.reload();
  }

  // ---- Button Creation ----

  // Helper to calculate how many messages to show on the button
  function getMessagesToLoadCount() {
    const limit = state.messageLimit || 15;
    
    // If we have stats, use them to be more accurate
    if (state.stats && state.stats.totalMessages > 0 && state.stats.renderedMessages > 0) {
      // Total hidden = Total - Rendered
      const remainingHidden = Math.max(0, state.stats.totalMessages - state.stats.renderedMessages);
      
      // If remaining hidden is less than limit, show that instead
      // e.g. Limit 15, but only 3 hidden -> Load 3 older messages
      if (remainingHidden > 0 && remainingHidden < limit) {
        return remainingHidden;
      }
    }
    
    return limit;
  }

  // Helper to update button HTML
  function updateButtonContent(button) {
    const count = getMessagesToLoadCount();
    button.innerHTML = `
      <span style="display: block;">Load ${count} previous messages</span>
      <span style="display: block; font-size: 10px; opacity: 0.7; margin-top: 2px;">(configure amount in extension settings)</span>
    `;
  }

  function createLoadMoreButton() {
    const wrapper = document.createElement("div");
    wrapper.setAttribute(NAV_ATTRIBUTE, "top");
    
    Object.assign(wrapper.style, {
      display: "flex",
      justifyContent: "center",
      padding: "20px 0",
      marginBottom: "10px"
    });
    
    const button = document.createElement("button");
    updateButtonContent(button); // Use helper

    Object.assign(button.style, {
      flexDirection: "column",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "8px 16px",
      borderRadius: "6px",
      fontSize: "13px",
      fontWeight: "400",
      color: "#ececf1",
      background: "#343541",
      border: "1px solid #565869",
      boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      cursor: "pointer",
      transition: "background 150ms ease",
      fontFamily: "inherit"
    });

    button.addEventListener("mouseenter", () => {
      button.style.background = "#40414f";
    });

    button.addEventListener("mouseleave", () => {
      button.style.background = "#343541";
    });

    button.addEventListener("click", loadOlderMessages);
    
    wrapper.appendChild(button);
    return wrapper;
  }

  // ---- Find chat container and insert button ----

  function getMessagesContainer() {
    // Find the container that holds the messages
    // Look for the first article (message) and get its parent
    const firstArticle = document.querySelector('article[data-testid^="conversation-turn-"]');
    if (firstArticle) {
      return firstArticle.parentElement;
    }
    return null;
  }

  function insertButtonAtTop(retryCount = 0) {
    if (buttonInserted && loadMoreButton && loadMoreButton.isConnected) {
      return;
    }
    if (!hasOlderMessages) {
      return;
    }

    const container = getMessagesContainer();
    if (!container) {
      if (retryCount < 10) {
        setTimeout(() => insertButtonAtTop(retryCount + 1), 500);
      }
      return;
    }

    // Remove existing button if any (cleanup)
    document.querySelectorAll(`[${NAV_ATTRIBUTE}]`).forEach(el => el.remove());

    loadMoreButton = createLoadMoreButton();
    
    // Insert at the very beginning of the messages container
    container.insertBefore(loadMoreButton, container.firstChild);
    
    buttonInserted = true;
  }

  function removeButton() {
    if (loadMoreButton && loadMoreButton.isConnected) {
      loadMoreButton.remove();
    }
    loadMoreButton = null;
    buttonInserted = false;
  }

  function updateButtonText() {
    if (loadMoreButton && loadMoreButton.isConnected) {
      const btn = loadMoreButton.querySelector('button');
      if (btn) {
         updateButtonContent(btn);
         log("Updated button text");
      }
    }
  }


  // ---- Status Handler ----

  function handleStatusUpdate(status) {
    log("handleStatusUpdate received:", JSON.stringify(status));
    
    if (!status) return;

    const hadOlderMessages = hasOlderMessages;
    hasOlderMessages = status.hasOlderMessages ?? false;
    
    // Safety check: Don't show button if total messages are less than or equal to rendered messages
    // This prevents "Load Older" button from appearing on new short chats due to race conditions or flags
    // We used to check against limit, but that had race conditions. Comparing Total vs Rendered is the ultimate truth.
    if (hasOlderMessages && status.totalMessages && status.renderedMessages) {
       if (status.totalMessages <= status.renderedMessages) {
         log(`Safety check: Ignoring hasOlderMessages=true because Total (${status.totalMessages}) <= Rendered (${status.renderedMessages})`);
         hasOlderMessages = false;
       }
    }

    log("Has older messages:", hasOlderMessages, "buttonInserted:", buttonInserted);

    // Check if button was removed from DOM (e.g. by React navigation)
    if (buttonInserted && loadMoreButton && !loadMoreButton.isConnected) {
      log("Button disconnected from DOM - resetting state");
      buttonInserted = false;
      loadMoreButton = null;
    }

    if (hasOlderMessages && !buttonInserted) {
      log("Calling insertButtonAtTop because hasOlderMessages=true and buttonInserted=false");
      insertButtonAtTop();
    } else if (!hasOlderMessages && buttonInserted) {
      removeButton();
    } else {
      log("No action needed - hasOlder:", hasOlderMessages, "buttonInserted:", buttonInserted);
    }
  }

  // ---- Initialization ----

  function tryInsertButton() {
    if (hasOlderMessages && !buttonInserted) {
      insertButtonAtTop();
    }
  }

  let buttonCheckInterval = null;

  function startButtonVisibilityChecker() {
    if (buttonCheckInterval) return;
    
    buttonCheckInterval = setInterval(() => {
      // If we should have a button but it's gone from DOM, re-insert it
      if (hasOlderMessages) {
        if (!loadMoreButton || !loadMoreButton.isConnected) {
          log("Button missing from DOM - reinserting");
          buttonInserted = false;
          loadMoreButton = null;
          insertButtonAtTop();
        }
      }
    }, 3000); // Check every 3 seconds
  }

  function initialize() {
    log("Navigation.initialize() called, state.enabled =", state.enabled);
    
    checkNavigationFlag();

    if (!state.enabled) {
      log("Navigation skipped - extension disabled");
      return;
    }

    log("Initializing navigation at", Date.now());

    // Listen for status updates from page-script via postMessage
    window.addEventListener("message", (event) => {
      if (event.data && event.data.type === "csb-status") {
        handleStatusUpdate(event.data.payload);
      }
    });

    // Try to insert button once page settles
    setTimeout(tryInsertButton, 2000);
    setTimeout(tryInsertButton, 4000);
    
    // Start periodic checker for button visibility
    startButtonVisibilityChecker();
    
    // Check for any status that was dispatched before we initialized (race condition fix)
    try {
      const storedStatus = sessionStorage.getItem("csb_last_status");
      if (storedStatus) {
        const status = JSON.parse(storedStatus);
        log("Found stored status from before init:", status);
        handleStatusUpdate(status);
      }
    } catch (e) {
      // sessionStorage might not be available
    }
  }

  function cleanup() {
    removeButton();
    if (buttonCheckInterval) {
      clearInterval(buttonCheckInterval);
      buttonCheckInterval = null;
    }
  }

  // Export
  booster.navigation = {
    initialize,
    cleanup,
    loadOlder: loadOlderMessages,
    clearExtraMessages,
    getExtraMessages,
    updateButtonText
  };

  // Auto-initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  window.addEventListener("beforeunload", cleanup);
})();
