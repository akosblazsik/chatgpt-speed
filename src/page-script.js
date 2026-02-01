// page-script.js

/**
 * ChatGPT Speed - Page Script (Fetch Proxy)
 * 
 * This script runs in the page context (not content script isolated world).
 * It patches window.fetch to intercept ChatGPT API responses and trim
 * conversation data BEFORE React renders it.
 */

(function initPageScript() {
  // ============================================================================
  // Configuration
  // ============================================================================

  const LOCAL_STORAGE_KEY = "csb_config";
  const EXTRA_MESSAGES_KEY = "csb_extra_messages";

  const DEFAULT_CONFIG = {
    enabled: true,
    messageLimit: 15,
    debug: false
  };

  // Track turns since load for performance warning feature
  let turnsSinceRefresh = 0;
  let baselineTurnCount = null;
  let currentConversationId = null;

  // ============================================================================
  // Trimmer
  // ============================================================================

  const HIDDEN_ROLES = new Set(["system", "tool", "thinking"]);

  function isVisibleMessage(node) {
    const role = node.message?.author?.role;
    if (!role) return false;
    return !HIDDEN_ROLES.has(role);
  }

  /**
   * Trim conversation mapping to show the last N messages (plus any extra).
   * 
   * @param {Object} data - Conversation data with mapping and current_node
   * @param {number} limit - Base number of turns to show
   * @param {number} extraMessages - Additional messages to show beyond limit
   * @returns {Object|null} - Trim result
   */
  function trimMapping(data, limit, extraMessages = 0) {
    const mapping = data.mapping;
    const currentNode = data.current_node;

    if (!mapping || !currentNode || !mapping[currentNode]) {
      return null;
    }

    // Build path from current_node to root
    const path = [];
    let cursor = currentNode;
    const visited = new Set();

    while (cursor) {
      const node = mapping[cursor];
      if (!node || visited.has(cursor)) break;
      visited.add(cursor);
      path.push(cursor);
      cursor = node.parent ?? null;
    }

    path.reverse();

    // Count total visible turns
    let visibleTotal = 0;
    let lastVisibleRole = null;

    for (const nodeId of path) {
      const node = mapping[nodeId];
      if (node && isVisibleMessage(node)) {
        const role = node.message?.author?.role ?? "";
        if (role !== lastVisibleRole) {
          visibleTotal++;
          lastVisibleRole = role;
        }
      }
    }

    // Calculate effective limit (base + extra)
    const effectiveLimit = Math.max(1, limit + extraMessages);

    // Find cut point (keep last effectiveLimit turns)
    let turnCount = 0;
    let cutIndex = 0;
    let lastRole = null;

    for (let i = path.length - 1; i >= 0; i--) {
      const nodeId = path[i];
      if (!nodeId) continue;

      const node = mapping[nodeId];
      if (node && isVisibleMessage(node)) {
        const role = node.message?.author?.role ?? "";
        if (role !== lastRole) {
          turnCount++;
          lastRole = role;
        }
        if (turnCount > effectiveLimit) {
          cutIndex = i + 1;
          break;
        }
      }
    }

    const keptRaw = path.slice(cutIndex);

    if (keptRaw.length === 0) {
      return null;
    }

    // Preserve original root node
    const originalRootId = path[0];
    const originalRootNode = originalRootId ? mapping[originalRootId] : null;
    const hasOriginalRoot =
      originalRootId && originalRootNode && originalRootNode.message;

    function isSupportNode(node) {
      const role = node?.message?.author?.role ?? "";
      if (role === "tool") return true;
      const contentType = node?.message?.content?.content_type;
      if (contentType && String(contentType).includes("image")) return true;
      const meta = node?.message?.metadata;
      if (meta?.attachments || meta?.files || meta?.image || meta?.image_id) return true;
      return false;
    }

    const supportSet = new Set();
    const supportChildrenMap = new Map();

    // Include tool/image support nodes connected to kept nodes
    const queue = [];
    for (const id of keptRaw) queue.push({ id, depth: 0, parentIsSupport: false });

    while (queue.length > 0) {
      const { id, depth, parentIsSupport } = queue.shift();
      if (depth >= 3) continue;
      const node = mapping[id];
      if (!node) continue;
      const children = Array.isArray(node.children) ? node.children : [];
      for (const childId of children) {
        if (!childId || supportSet.has(childId)) continue;
        const child = mapping[childId];
        if (!child) continue;
        const childIsSupport = isSupportNode(child);
        if (childIsSupport || parentIsSupport) {
          supportSet.add(childId);
          queue.push({ id: childId, depth: depth + 1, parentIsSupport: childIsSupport || parentIsSupport });
        }
      }
    }

    // Build new mapping: keep a linear chain for keptRaw, and attach support children
    const newMapping = {};
    let turnsKept = 0;
    let prevRoleKept = null;

    if (hasOriginalRoot) {
      newMapping[originalRootId] = {
        ...originalRootNode,
        parent: null,
        children: keptRaw[0] ? [keptRaw[0]] : []
      };
    }

    for (const supportId of supportSet) {
      const supportNode = mapping[supportId];
      if (!supportNode) continue;
      const parentId = supportNode.parent;
      if (!parentId) continue;
      if (!supportChildrenMap.has(parentId)) supportChildrenMap.set(parentId, []);
      supportChildrenMap.get(parentId).push(supportId);
    }

    for (let i = 0; i < keptRaw.length; i++) {
      const id = keptRaw[i];
      if (!id) continue;
      const originalNode = mapping[id];
      if (!originalNode) continue;

      const prevId = i === 0 ? (hasOriginalRoot ? originalRootId : null) : keptRaw[i - 1];
      const nextId = keptRaw[i + 1] ?? null;
      const extraChildren = supportChildrenMap.get(id) || [];
      const children = nextId ? [nextId, ...extraChildren] : [...extraChildren];

      newMapping[id] = {
        ...originalNode,
        parent: prevId ?? null,
        children
      };

      const role = originalNode.message?.author?.role ?? "";
      if (role !== prevRoleKept && isVisibleMessage(originalNode)) {
        turnsKept++;
        prevRoleKept = role;
      }
    }

    for (const supportId of supportSet) {
      if (newMapping[supportId]) continue;
      const supportNode = mapping[supportId];
      if (!supportNode) continue;
      const parentId = supportNode.parent;
      if (!parentId || !newMapping[parentId]) continue;
      const children = Array.isArray(supportNode.children)
        ? supportNode.children.filter((childId) => supportSet.has(childId))
        : [];
      newMapping[supportId] = {
        ...supportNode,
        parent: parentId,
        children
      };
    }

    const newRoot = hasOriginalRoot ? originalRootId : keptRaw[0];
    const newCurrentNode = keptRaw[keptRaw.length - 1];

    if (!newRoot || !newCurrentNode) {
      return null;
    }

    return {
      mapping: newMapping,
      current_node: newCurrentNode,
      root: newRoot,
      keptCount: keptRaw.length,
      totalCount: path.length,
      visibleKept: turnsKept,
      visibleTotal,
      hasOlderMessages: turnsKept < visibleTotal
    };
  }

  // ============================================================================
  // Logging
  // ============================================================================

  function log(...args) {
    if (window.__CSB_DEBUG__) {
      console.log("[CSB:PageScript]", ...args);
    }
  }

  // ============================================================================
  // Config Management
  // ============================================================================

  function loadConfig() {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          enabled: parsed.enabled ?? DEFAULT_CONFIG.enabled,
          messageLimit: Math.max(1, parsed.messageLimit ?? DEFAULT_CONFIG.messageLimit),
          debug: parsed.debug ?? DEFAULT_CONFIG.debug
        };
      }
    } catch {
      // Fallback to defaults
    }
    return DEFAULT_CONFIG;
  }

  function getConfig() {
    const stored = loadConfig();
    window.__CSB_CONFIG__ = stored;
    window.__CSB_DEBUG__ = stored.debug;
    return stored;
  }

  /**
   * Get extra messages to show beyond the base limit.
   */
  function getExtraMessages() {
    try {
      // Manual Refresh Detection:
      // If the 'csb_navigating' flag is NOT present in sessionStorage, it means this
      // is a manual refresh (or fresh load), so we should ignore/clear any extra messages.
      // This prevents the "sticky extra messages" bug on manual refresh.
      const isNavigating = sessionStorage.getItem("csb_navigating");
      
      const stored = localStorage.getItem(EXTRA_MESSAGES_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.url === window.location.href) {
          // If we are not navigating (flag missing), return 0 to enforce "clean slate"
          // We rely on navigation.js to clean up the localStorage item later.
          if (!isNavigating) {
             return 0;
          }
          
          // Signal to navigation.js that we have read the flag
          sessionStorage.setItem("csb_ack", "true");
          
          return data.extra || 0;
        }
      }
    } catch {
      // Fallback
    }
    return 0;
  }

  // ============================================================================
  // Status Dispatch
  // ============================================================================

  function dispatchStatus(status) {
    // Use postMessage to communicate with content script (across context boundary)
    window.postMessage({
      type: "csb-status",
      payload: status
    }, "*");
    
    // Also persist to sessionStorage as backup for timing issues
    try {
      sessionStorage.setItem("csb_last_status", JSON.stringify({
        ...status,
        url: window.location.href
      }));
    } catch (e) {
      // sessionStorage might not be available
    }
  }

  // ============================================================================
  // Performance Warning Logic (when too many new messages accumulate)
  // ============================================================================

  let performanceWarningShown = false;

  function checkPerformanceWarning(currentTurnCount, limit, extraMessages, conversationId) {
    // Detect conversation change - reset warning and extra messages
    if (conversationId && conversationId !== currentConversationId) {
      log("Conversation changed from", currentConversationId, "to", conversationId, "- Resetting state");
      currentConversationId = conversationId;
      baselineTurnCount = null;
      turnsSinceRefresh = 0;
      performanceWarningShown = false;
      
      // Clear extra messages to start fresh in new conversation
      localStorage.removeItem("csb_extra_messages");
      log("Cleared extraMessages for new conversation");
    }

    // Only warn when not showing extra messages (user hasn't clicked "load more")
    if (extraMessages > 0) {
      return;
    }

    if (baselineTurnCount === null) {
      baselineTurnCount = currentTurnCount;
      turnsSinceRefresh = 0;
      log("Baseline set:", baselineTurnCount);
      return;
    }

    const newTurns = currentTurnCount - baselineTurnCount;
    
    if (newTurns > turnsSinceRefresh) {
      turnsSinceRefresh = newTurns;
      log("Turns since refresh:", turnsSinceRefresh, "Limit:", limit);

      // Show warning when turns exceed limit
      if (turnsSinceRefresh >= limit && !performanceWarningShown) {
        performanceWarningShown = true;
        log("Performance warning triggered - dispatching via postMessage");
        window.postMessage({
          type: "csb-performance-warning",
          payload: {
            turnsSinceRefresh: turnsSinceRefresh,
            limit: limit
          }
        }, "*");
      }
    }
  }

  // ============================================================================
  // Fetch Interception
  // ============================================================================

  function isConversationRequest(method, url) {
    if (method !== "GET") return false;
    if (!url.pathname.startsWith("/backend-api/")) return false;
    return true;
  }

  function isJsonResponse(res) {
    const contentType = res.headers.get("content-type") || "";
    return contentType.toLowerCase().includes("application/json");
  }

  function createModifiedResponse(originalRes, modifiedData) {
    const text = JSON.stringify(modifiedData);

    const headers = new Headers(originalRes.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    headers.set("content-type", "application/json; charset=utf-8");

    const response = new Response(text, {
      status: originalRes.status,
      statusText: originalRes.statusText,
      headers
    });

    try {
      if (originalRes.url) {
        Object.defineProperty(response, "url", { value: originalRes.url });
      }
      if (originalRes.type) {
        Object.defineProperty(response, "type", { value: originalRes.type });
      }
    } catch {
      // Ignore
    }

    return response;
  }

  async function interceptedFetch(nativeFetch, ...args) {
    const cfg = getConfig();

    if (!cfg.enabled) {
      return nativeFetch(...args);
    }

    const [input, init] = args;
    let urlString;
    let method;

    if (input instanceof Request) {
      urlString = input.url;
      method = (init?.method ?? input.method).toUpperCase();
    } else if (input instanceof URL) {
      urlString = input.href;
      method = (init?.method ?? "GET").toUpperCase();
    } else {
      urlString = String(input);
      method = (init?.method ?? "GET").toUpperCase();
    }

    const url = new URL(urlString, location.href);

    if (!isConversationRequest(method, url)) {
      return nativeFetch(...args);
    }

    const res = await nativeFetch(...args);

    try {
      if (!isJsonResponse(res)) {
        return res;
      }

      const clone = res.clone();
      const json = await clone.json().catch(() => null);

      if (!json || typeof json !== "object") {
        return res;
      }

      if (!json.mapping || !json.current_node) {
        return res;
      }

      let extraMessages = getExtraMessages();

      // Detect conversation switch (SPA navigation)
      // Link interceptor in boot.js handles forcing full page loads,
      // but this is a fallback in case SPA navigation still occurs
      if (json.conversation_id && json.conversation_id !== currentConversationId) {
        // Reset state if we had a previous conversation
        if (currentConversationId !== null) {
          log("Conversation ID changed. Resetting state for fresh load.");
          localStorage.removeItem("csb_extra_messages");
          sessionStorage.removeItem("csb_last_status");
          sessionStorage.removeItem("csb_navigating");
          sessionStorage.removeItem("csb_ack");
          extraMessages = 0;
        }
        
        // Track the conversation ID
        log("Tracking conversation:", json.conversation_id);
        currentConversationId = json.conversation_id;
        baselineTurnCount = null;
        turnsSinceRefresh = 0;
      }

      const trimmed = trimMapping(json, cfg.messageLimit, extraMessages);

      if (!trimmed) {
        return res;
      }

      const totalBefore = trimmed.visibleTotal;
      const keptAfter = trimmed.visibleKept;
      const effectiveLimit = cfg.messageLimit + extraMessages;

      log(`Trimmed: ${keptAfter}/${totalBefore} turns (limit: ${cfg.messageLimit}, extra: ${extraMessages}, hasMore: ${trimmed.hasOlderMessages})`);

      // Check for performance warning
      checkPerformanceWarning(totalBefore, cfg.messageLimit, extraMessages, json.conversation_id);

      // Dispatch status
      dispatchStatus({
        totalMessages: totalBefore,
        renderedMessages: keptAfter,
        extraMessages: extraMessages,
        hasOlderMessages: trimmed.hasOlderMessages
      });

      const modifiedData = {
        ...json,
        mapping: trimmed.mapping,
        current_node: trimmed.current_node,
        root: trimmed.root
      };

      return createModifiedResponse(res, modifiedData);
    } catch (error) {
      log("Error in fetch interceptor:", error);
      return res;
    }
  }

  // ============================================================================
  // Initialization
  // ============================================================================

  function patchFetch() {
    if (window.__CSB_PROXY_PATCHED__) {
      log("Already patched, skipping");
      return;
    }

    const nativeFetch = window.fetch.bind(window);

    window.fetch = async (...args) => {
      return interceptedFetch(nativeFetch, ...args);
    };

    window.__CSB_PROXY_PATCHED__ = true;
    log("Fetch proxy installed");

    window.postMessage({ type: "csb-proxy-ready" }, location.origin);
  }

  function setupConfigListener() {
    window.addEventListener("csb-config", (event) => {
      const detail = event.detail;
      let config = null;

      if (typeof detail === "string") {
        try {
          config = JSON.parse(detail);
        } catch {
          return;
        }
      } else if (detail && typeof detail === "object") {
        config = detail;
      }

      if (config && typeof config === "object") {
        window.__CSB_DEBUG__ = config.debug ?? false;
        window.__CSB_CONFIG__ = {
          enabled: config.enabled ?? DEFAULT_CONFIG.enabled,
          messageLimit: Math.max(1, config.messageLimit ?? DEFAULT_CONFIG.messageLimit),
          debug: config.debug ?? DEFAULT_CONFIG.debug
        };
        log("Config updated:", window.__CSB_CONFIG__);
      }
    });
  }

  // Entry point
  if (typeof window.__CSB_DEBUG__ === "undefined") {
    window.__CSB_DEBUG__ = false;
  }

  setupConfigListener();
  patchFetch();

  log("Fetch proxy installed - trimming enabled");

  log("Page Script loaded");
})();
