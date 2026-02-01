// donation_badge.js

(function initializeDonationBadge() {
  const booster = window.ChatGPTSpeedBooster;
  const log = booster.log || console.log;

  const BADGE_ATTRIBUTE = "data-chatgpt-donation-badge";

  /**
   * Donation badge that appears after activity milestones.
   */
  class DonationBadge {
    constructor() {
      this.isVisible = false;
      this.heartInterval = null;
      this.autoCloseTimeout = null;
      this.shownThisSession = false;
    }

    /**
     * Reset badge state (called on chat navigation).
     */
    reset() {
      this.forceHide();
      this.isVisible = false;
      // Don't reset shownThisSession - rate limit across chats
    }

    /**
     * Inject required CSS styles.
     */
    injectStyles() {
      const ID = "csb-donation-styles";
      if (document.getElementById(ID)) return;

      const style = document.createElement("style");
      style.id = ID;
      style.textContent = `
        @keyframes floatHeart {
          0% { transform: translateY(20px) translateX(0) scale(0.6); opacity: 0; }
          20% { opacity: 0.8; transform: translateY(0) translateX(-4px) scale(0.8); }
          50% { transform: translateY(-20px) translateX(4px) scale(1); }
          80% { opacity: 0.6; }
          100% { transform: translateY(-50px) translateX(-2px) scale(1.1); opacity: 0; }
        }

        @keyframes heart-explode {
          0% { transform: translate(0, 0) scale(0.5) rotate(0); opacity: 1; }
          50% { opacity: 1; transform: translate(var(--tx), var(--ty)) scale(1.2) rotate(var(--rot)); }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }

        @keyframes glow-pulse {
          0% { box-shadow: 0 8px 24px rgba(243, 156, 18, 0.4); }
          50% { box-shadow: 0 12px 32px rgba(243, 156, 18, 0.8); }
          100% { box-shadow: 0 8px 24px rgba(243, 156, 18, 0.4); }
        }

        .csb-heart-float {
          position: absolute;
          bottom: -15px;
          pointer-events: none;
          animation: floatHeart 3s ease-in-out forwards;
          opacity: 0;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
          z-index: 0;
        }

        .csb-donation-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 12px 20px;
          border-radius: 16px;
          font-size: 15px;
          font-weight: 600;
          color: #ffffff;
          background: linear-gradient(135deg, #f1c40f, #e67e22);
          backdrop-filter: blur(8px);
          opacity: 0;
          transform: translateY(50px) scale(0.9);
          transition:
            opacity 400ms cubic-bezier(0.19, 1, 0.22, 1),
            transform 400ms cubic-bezier(0.19, 1, 0.22, 1),
            box-shadow 180ms ease-out,
            filter 180ms ease-out;
          overflow: hidden;
          cursor: pointer;
          z-index: 9999;
          animation: glow-pulse 3s infinite ease-in-out;
          max-width: 575px;
        }

        .csb-donation-badge:hover {
          transform: translateY(-2px) scale(1.02) !important;
          filter: brightness(1.1);
        }

        .csb-heart-particle {
          position: fixed;
          pointer-events: none;
          z-index: 10000;
          will-change: transform, opacity;
          animation: heart-explode var(--duration) cubic-bezier(0.25, 1, 0.5, 1) forwards;
          font-family: "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif;
          white-space: nowrap;
        }
      `;
      document.head.appendChild(style);
    }

    /**
     * Trigger particle explosion on click.
     */
    triggerHeartExplosion(x, y) {
      const items = ["❤️", "💖", "🍺", "🍺", "Thank You!", "Thank You!"];
      const particles = 50;

      const container = document.createElement("div");
      Object.assign(container.style, {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "10000"
      });
      document.body.appendChild(container);

      for (let i = 0; i < particles; i++) {
        const p = document.createElement("div");
        p.className = "csb-heart-particle";
        const content = items[Math.floor(Math.random() * items.length)];
        p.textContent = content;

        // Style text vs emoji differently
        if (content.length > 2) {
          p.style.fontSize = `${Math.floor(Math.random() * 4) + 12}px`;
          p.style.fontWeight = "bold";
          p.style.color = "#ffffff";
          p.style.textShadow = "0 1px 3px rgba(0,0,0,0.3)";
        } else {
          p.style.fontSize = `${Math.floor(Math.random() * 14) + 14}px`;
        }

        p.style.left = x + "px";
        p.style.top = y + "px";

        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 200 + 80;

        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;
        const rot = Math.random() * 60 - 30;

        p.style.setProperty("--tx", `${tx}px`);
        p.style.setProperty("--ty", `${ty}px`);
        p.style.setProperty("--rot", `${rot}deg`);
        p.style.setProperty("--duration", `${0.6 + Math.random() * 0.4}s`);

        container.appendChild(p);
      }

      setTimeout(() => container.remove(), 1000);
    }

    /**
     * Show the donation nudge badge.
     */
    show(bodyText = null, headerText = null) {
      if (this.isVisible) return;

      // Rate limit: Don't show if shown in last 12 hours
      const lastShown = localStorage.getItem("chatgpt_speed_booster_donation_last_shown");
      const REAPPEAR_DELAY = 12 * 60 * 60 * 1000; // 12 hours

      if (lastShown) {
        const timeSinceMsg = Date.now() - parseInt(lastShown, 10);
        if (timeSinceMsg < REAPPEAR_DELAY) {
          log("[DonationBadge] Rate limited (shown recently). Skipping.");
          return;
        }
      }

      log("[DonationBadge] Showing nudge...");

      let text = bodyText || "Loving my free extension? Keep it free & fast. <u>Buy me a beer!</u> 🍻";
      let header = headerText || "High Five! ✋ Speed is working!";

      // Update timestamp
      localStorage.setItem("chatgpt_speed_booster_donation_last_shown", Date.now().toString());

      this.isVisible = true;
      this.shownThisSession = true;
      this.injectStyles();

      // Move active badge up if visible
      const activeBadge = document.querySelector("[data-chatgpt-speed-booster-badge]");
      if (activeBadge) {
        activeBadge.style.transition = "bottom 0.4s cubic-bezier(0.19, 1, 0.22, 1)";
        activeBadge.style.bottom = "180px";
      }

      const badge = document.createElement("div");
      badge.className = "csb-donation-badge";
      badge.setAttribute(BADGE_ATTRIBUTE, "1");

      badge.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:flex-start; position:relative; z-index:2;">
          <div style="font-size:15px; font-weight:800; opacity:1; margin-bottom:2px; display:flex; align-items:center; gap:3px; color:rgba(255,255,255,0.95);">
            <span>${header}</span>
          </div>
          <div style="display:flex; align-items:flex-start; gap:8px;">
            <span style="font-size:18px; line-height:1.2">🍺</span>
            <span style="font-size:14px; text-shadow:0 1px 2px rgba(0,0,0,0.2); font-weight:600; line-height:1.3;">${text}</span>
          </div>
        </div>
        <div class="close-btn" style="margin-left:16px; cursor:pointer; opacity:0.8; font-size:14px; position:relative; z-index:2; align-self:center;">✕</div>
      `;

      // Position near chat input
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
        const bottomFromTop = window.innerHeight - rect.top + 10;
        posStyles = {
          position: "fixed",
          left: `${rect.left}px`,
          bottom: `${bottomFromTop}px`,
          top: "auto",
          right: "auto"
        };
      }

      Object.assign(badge.style, posStyles);

      // Click handler - opens ko-fi
      badge.addEventListener("click", (e) => {
        if (e.target.closest(".close-btn")) return;
        e.preventDefault();
        const rect = badge.getBoundingClientRect();
        this.triggerHeartExplosion(rect.left + rect.width / 2, rect.top + rect.height / 2);
        this.hide(badge);
        setTimeout(() => window.open("https://ko-fi.com/bramgiessen", "_blank"), 400);
      });

      // Close button handler
      const closeBtn = badge.querySelector(".close-btn");
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.hide(badge);
      });

      // Auto-close timer
      const startAutoClose = (duration = 8000) => {
        if (this.autoCloseTimeout) clearTimeout(this.autoCloseTimeout);
        this.autoCloseTimeout = setTimeout(() => {
          if (document.body.contains(badge)) this.hide(badge);
        }, duration);
      };

      badge.addEventListener("mouseenter", () => {
        if (this.autoCloseTimeout) clearTimeout(this.autoCloseTimeout);
      });

      badge.addEventListener("mouseleave", () => {
        startAutoClose(5000);
      });

      // Heart spawner
      const spawnHeart = () => {
        if (!badge.isConnected) return;
        const heart = document.createElement("div");
        heart.className = "csb-heart-float";
        heart.textContent = "❤️";
        const randomLeft = Math.floor(Math.random() * 80) + 10;
        const randomDuration = Math.random() * 1.5 + 2;
        const randomSize = Math.floor(Math.random() * 6) + 12;
        heart.style.left = `${randomLeft}%`;
        heart.style.fontSize = `${randomSize}px`;
        heart.style.animationDuration = `${randomDuration}s`;
        badge.appendChild(heart);
        setTimeout(() => {
          if (heart.isConnected) heart.remove();
        }, randomDuration * 1000);
      };

      this.heartInterval = setInterval(spawnHeart, 800);
      spawnHeart();

      document.body.appendChild(badge);

      // Slide in
      requestAnimationFrame(() => {
        badge.style.opacity = "1";
        badge.style.transform = "translateY(0) scale(1)";
      });

      startAutoClose();
    }

    /**
     * Hide the badge with animation.
     */
    hide(badgeElement) {
      if (this.heartInterval) clearInterval(this.heartInterval);
      if (this.autoCloseTimeout) clearTimeout(this.autoCloseTimeout);

      if (badgeElement) {
        badgeElement.style.opacity = "0";
        badgeElement.style.transform = "translateY(50px) scale(0.9)";
        setTimeout(() => {
          if (badgeElement.isConnected) badgeElement.remove();
        }, 250);
      }

      this.isVisible = false;
    }

    /**
     * Called when active badge is shown - trigger donation nudge after delay.
     */
    onActiveBadgeShown() {
      if (this.shownThisSession) return;

      // Get stats from state - stats are already available when this is called
      const state = booster.state;
      const totalMessages = state?.stats?.totalMessages || 0;
      const renderedMessages = state?.stats?.renderedMessages || 0;
      const optimizedMessages = Math.max(0, totalMessages - renderedMessages);
      
      // Calculate speed improvement (% of messages not rendered)
      const speedImprovement = totalMessages > 0 
        ? Math.round((optimizedMessages / totalMessages) * 100)
        : 0;

      let headerText;
      let bodyText;

      if (totalMessages > 0 && speedImprovement > 0) {
        headerText = `High Five! ✋ ${totalMessages} messages are now lag-free!`;
        bodyText = `Loving my free extension? Keep it free & fast. <u>Buy me a beer!</u> 🍻`;
      } else {
        headerText = "High Five! ✋ Speed is working!";
        bodyText = "Loving my free extension? Keep it free & fast. <u>Buy me a beer!</u> 🍻";
      }

      this.show(bodyText, headerText);
    }

    /**
     * Force hide any visible badge.
     */
    forceHide() {
      const badge = document.querySelector(`[${BADGE_ATTRIBUTE}]`);
      if (badge) this.hide(badge);
    }
  }

  // Export
  booster.DonationBadge = new DonationBadge();
})();
