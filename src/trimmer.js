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

  // Build visible turn boundaries in one pass
  const turnStarts = [];
  let lastVisibleRole = null;

  for (let i = 0; i < path.length; i++) {
    const nodeId = path[i];
    const node = mapping[nodeId];
    if (node && isVisibleMessage(node)) {
      const role = node.message?.author?.role ?? "";
      if (role !== lastVisibleRole) {
        turnStarts.push(i);
        lastVisibleRole = role;
      }
    }
  }

  const visibleTotal = turnStarts.length;
  const effectiveLimit = Math.max(1, limit);

  let cutIndex = 0;
  if (visibleTotal > effectiveLimit) {
    const startTurnIndex = visibleTotal - effectiveLimit;
    cutIndex = turnStarts[startTurnIndex];
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
    const { id, depth, parentIsSupport } = queue.pop();
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
  let prevRole = null;

  // Add original root node first
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
    if (role !== prevRole && isVisibleMessage(originalNode)) {
      turnsKept++;
      prevRole = role;
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
    totalCount,
    visibleKept: turnsKept,
    visibleTotal
  };
}

// Export for page-script
if (typeof window !== "undefined") {
  window.__CSB_TRIMMER__ = { trimMapping, isVisibleMessage, HIDDEN_ROLES };
}
