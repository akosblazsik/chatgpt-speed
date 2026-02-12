# Afteraudit 1.0.17

Date: 2026-02-10

## Scope
Release 1.0.17 changes: moved status/refresh/performance badges into the page header (next to the model selector) and shortened the performance warning copy.

## Checks Performed
1. Reviewed header badge container creation and reuse in `active_badge.js`.
2. Reviewed performance warning badge placement and copy updates in `boot.js`.
3. Verified fallback positioning when the header container is unavailable.
4. Verified badge auto-dismiss behavior and click-to-dismiss behavior remain intact.
5. Confirmed manifest version bump and release notes entry for 1.0.17.

## Findings
1. No new high-risk issues found in the changed areas.
2. Header badge containers are reused via a shared data attribute to avoid duplicates.
3. Performance warning copy is shorter and better suited to header placement.

## Residual Risks
1. Header selectors (`header#page-header`, model switcher test id) are external DOM dependencies and may break if the host UI changes.
2. Header badge layout relies on inline styles and could be affected by host page CSS changes.

## Recommendations
1. Keep the chat-input fallback path to preserve badge visibility if header selectors change.
2. If header DOM churn is observed, consider a lightweight retry or observer to reattach the badge container.
