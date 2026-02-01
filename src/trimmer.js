// trimmer.js

/**
 * Trimming algorithm for ChatGPT conversation data.
 * Keeps only the last N turns (role transitions) in the conversation.
 */

// Roles that are hidden/internal (not visible to users)
const HIDDEN_ROLES = new Set(["system", "tool", "thinking"]);

/**
 * Check if a node is a visible message.
 * @param {Object} node - Chat node
 * @returns {boolean}
 */
function isVisibleMessage(node) {
  const role = node.message?.author?.role;
  if (!role) return false;
  return !HIDDEN_ROLES.has(role);
}

/**
 * Trim conversation mapping to keep only the last N turns.
 * 
 * A "turn" is a contiguous sequence of messages from the same role.
 * This matches how ChatGPT renders messages (multiple nodes = 1 bubble).
 * 
 * @param {Object} data - Conversation data with mapping and current_node
 * @param {number} limit - Number of turns to keep
 * @returns {Object|null} - Trim result or null if trimming not possible
 */
function trimMapping(data, limit) {
  const mapping = data.mapping;
  const currentNode = data.current_node;

  if (!mapping || !currentNode || !mapping[currentNode]) {
    return null;
  }

  // Build path from current_node to root by following parent links
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

  // Reverse to chronological order (oldest first)
  path.reverse();

  const totalCount = path.length;
  const effectiveLimit = Math.max(1, limit);

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

  // Find cut point by counting turns backwards
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

  // Filter to only visible nodes
  const kept = keptRaw.filter((id) => {
    const node = mapping[id];
    return node && isVisibleMessage(node);
  });

  if (kept.length === 0) {
    return null;
  }

  // Preserve original root node
  const originalRootId = path[0];
  const originalRootNode = originalRootId ? mapping[originalRootId] : null;
  const hasOriginalRoot = originalRootId && originalRootNode;

  // Build new mapping
  const newMapping = {};
  let turnsKept = 0;
  let prevRole = null;

  // Add original root node first
  if (hasOriginalRoot) {
    newMapping[originalRootId] = {
      ...originalRootNode,
      parent: null,
      children: kept[0] ? [kept[0]] : []
    };
  }

  // Add kept visible nodes
  for (let i = 0; i < kept.length; i++) {
    const id = kept[i];
    if (!id) continue;

    const prevId = i === 0 ? (hasOriginalRoot ? originalRootId : null) : kept[i - 1];
    const nextId = kept[i + 1] ?? null;
    const originalNode = mapping[id];

    if (originalNode) {
      newMapping[id] = {
        ...originalNode,
        parent: prevId ?? null,
        children: nextId ? [nextId] : []
      };

      const role = originalNode.message?.author?.role ?? "";
      if (role !== prevRole && isVisibleMessage(originalNode)) {
        turnsKept++;
        prevRole = role;
      }
    }
  }

  const newRoot = hasOriginalRoot ? originalRootId : kept[0];
  const newCurrentNode = kept[kept.length - 1];

  if (!newRoot || !newCurrentNode) {
    return null;
  }

  return {
    mapping: newMapping,
    current_node: newCurrentNode,
    root: newRoot,
    keptCount: kept.length,
    totalCount,
    visibleKept: turnsKept,
    visibleTotal
  };
}

// Export for page-script
if (typeof window !== "undefined") {
  window.__CSB_TRIMMER__ = { trimMapping, isVisibleMessage, HIDDEN_ROLES };
}
