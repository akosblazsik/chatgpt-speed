// active_badge.js

(function initializeActiveBadge() {
  const booster = window.ChatGPTSpeedBooster;
  const state = booster.state;
  const log = booster.log;

  const BADGE_ATTRIBUTE = "data-chatgpt-speed-booster-badge";
  const REFRESH_BADGE_ATTRIBUTE = "data-chatgpt-speed-booster-refresh-badge";
  const AUTO_REFRESH_FLAG = "csb_auto_refreshed";

  /**
   * Show a small badge near the chat input.
   * @param {string} text - Badge text
   * @param {string} icon - Emoji icon
   * @param {string} attribute - Data attribute for the badge
   * @param {number} duration - How long to show (ms)
   * @param {number} stackOffset - Additional bottom offset to avoid overlap
   */
  function showBadge(text, icon, attribute, duration, stackOffset = 0) {
    // Remove previous badge of same type if any
    const existingBadge = document.querySelector(`[${attribute}]`);
    if (existingBadge) existingBadge.remove();

    const badge = document.createElement("div");
    badge.setAttribute(attribute, "1");

    // Icon + text
    badge.innerHTML = `<span style="margin-right:4px">${icon}</span><span>${text}</span>`;

    // Find chat input to position relative to it
    const inputEl = document.querySelector("#prompt-textarea");
    let targetEl = inputEl;

    if (inputEl) {
      const wrapper = inputEl.closest('[class*="bg-token-bg-primary"]') || inputEl.closest("form");
      if (wrapper) targetEl = wrapper;
    }

    let posStyles = {
      position: "fixed",
      left: "20px",
      bottom: `${150 + stackOffset}px`
    };

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      let bottomVal = window.innerHeight - rect.top + 10 + stackOffset;

      // If donation badge is visible, stack above it
      if (booster.DonationBadge && booster.DonationBadge.isVisible) {
        bottomVal = 180 + stackOffset;
      }

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
      zIndex: "9999",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "4px",
      padding: "5px 12px",
      borderRadius: "999px",
      fontSize: "14px",
      fontWeight: "500",
      color: "#ffffff",
      background: "linear-gradient(135deg, #069b76, #13b58f)",
      boxShadow: "0 6px 18px rgba(15, 23, 42, 0.35)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      pointerEvents: "none",
      opacity: "0",
      transform: "translateY(6px) scale(0.98)",
      transition: "opacity 180ms ease-out, transform 180ms ease-out, filter 180ms ease-out"
    });

    document.body.appendChild(badge);

    // Slide in
    requestAnimationFrame(() => {
      badge.style.opacity = "1";
      badge.style.transform = "translateY(0) scale(1)";
    });

    // Fade out after duration
    setTimeout(() => {
      badge.style.opacity = "0";
      badge.style.transform = "translateY(6px) scale(0.98)";
      setTimeout(() => {
        if (badge.isConnected) badge.remove();
      }, 250);
    }, duration);

    return badge;
  }

  /**
   * Show a small "Speed Active" badge near the chat input.
   * Auto-hides after 5 seconds.
   */
  function showActiveBadge() {
    const badge = showBadge("Speed Active", "⚡", BADGE_ATTRIBUTE, 5000, 0);

    // Trigger donation badge after a short delay
    if (booster.DonationBadge) {
      setTimeout(() => booster.DonationBadge.onActiveBadgeShown(), 100);
    }

    return badge;
  }

  /**
   * Show a "Refreshed for performance" badge.
   * Auto-hides after 6 seconds.
   */
  function showRefreshBadge() {
    // Stack above the active badge (50px offset)
    showBadge("Refreshed to keep ChatGPT fast", "🔄", REFRESH_BADGE_ATTRIBUTE, 6000, 50);
    log("Showing refresh badge");
  }

  /**
   * Check if we should show the refresh badge (set before auto-refresh).
   */
  function checkAndShowRefreshBadge() {
    try {
      const wasAutoRefreshed = sessionStorage.getItem(AUTO_REFRESH_FLAG);
      if (wasAutoRefreshed === "true") {
        // Clear the flag
        sessionStorage.removeItem(AUTO_REFRESH_FLAG);
        // Show refresh badge after a delay (let page settle)
        setTimeout(() => {
          showRefreshBadge();
        }, 1500);
      }
    } catch {
      // sessionStorage may not be available
    }
  }

  /**
   * Mark that the next page load should show refresh badge.
   */
  function markForRefreshBadge() {
    try {
      sessionStorage.setItem(AUTO_REFRESH_FLAG, "true");
    } catch {
      // sessionStorage may not be available
    }
  }

  /**
   * Reset active badge state (called on chat navigation).
   */
  function resetActiveBadge() {
    state.hasShownBadgeForCurrentChat = false;
    const badge = document.querySelector(`[${BADGE_ATTRIBUTE}]`);
    if (badge) badge.remove();
    const refreshBadge = document.querySelector(`[${REFRESH_BADGE_ATTRIBUTE}]`);
    if (refreshBadge) refreshBadge.remove();
  }

  /**
   * Show badge if not already shown for this chat.
   */
  function showActiveBadgeOnce() {
    if (state.hasShownBadgeForCurrentChat) return;
    if (!state.enabled) return;

    state.hasShownBadgeForCurrentChat = true;
    showActiveBadge();
  }

  // Check for refresh badge on load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndShowRefreshBadge);
  } else {
    checkAndShowRefreshBadge();
  }

  // Export
  booster.activeBadge = {
    show: showActiveBadge,
    showOnce: showActiveBadgeOnce,
    reset: resetActiveBadge,
    showRefresh: showRefreshBadge,
    markForRefresh: markForRefreshBadge
  };
})();
