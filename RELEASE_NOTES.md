# Release Notes

## v1.0.12 — Runtime messaging hardening

### 🔒 Security & reliability
- Hardened runtime page↔content messaging with stricter validation and trusted-source checks.
- Tightened message envelope handling to reduce malformed or cross-context message risks.

---

## v1.0.11 — Verified uploads packaging

### 🛠️ Improvements
- Added packaging guidance and key safety notes for Verified CRX Uploads.
- Packaging script now generates a 2048-bit RSA key when missing.
- Added light/dark Chrome Web Store screenshots to the release package.

---

## v1.0.10 — Config defaults centralization

### 🛠️ Improvements
- Centralized runtime state defaults to use shared config defaults to avoid drift.

---

## v1.0.9 — Message validation + shared config

### 🔒 Security & reliability
- Hardened page↔content message handling with strict envelopes and source/origin validation.
- Normalized settings via shared defaults + clamping across page script, boot, and popup.

### 🧭 Documentation
- Added Architecture & Trust Boundaries details for the messaging model and config flow.

---

## v1.0.8 — Ownership and metadata updates

### 🛠️ Updates
- Updated `homepage_url` to the new repository.
- Refreshed debug promo copy to reflect new maintainer.
- Added source repo link to README.

---

## v1.0.7 — Manifest & packaging hygiene

### 🛠️ Improvements
- Added `minimum_chrome_version` and `action.default_title`.
- Debug logs in background/popup now respect Debug Mode.
- Packaging updated to include only runtime icons (source icon assets excluded).
- Added `homepage_url` and `version_name` to the manifest.
- Popup now guards `chrome.tabs` calls with `runtime.lastError`.

---

## v1.0.6 — Stability and reliability fixes

### 🛠️ Fixes
- Prevented cross‑origin postMessage errors when the page is in an opaque origin state.
- Ensure `maxExtraMessages` is read in the page script (settings sync reliability).
- More resilient `maxExtraMessages` handling in navigation (invalid values fall back safely).
- Reduced race risk when loading status from sessionStorage on navigation.

### ⚡ Performance improvements
- Skip heavy mapping rebuild when no trimming is required.

---

## v1.0.5 — Additional performance tuning

### ⚡ Performance improvements
- Throttled `csb_last_status` sessionStorage writes.
- Optimized support-node traversal (avoid `Array.shift`).
- Scoped scroll-restore observer to message container.

---

## v1.0.4 — Performance and stability improvements

This release further reduces background work while keeping behavior unchanged.

### ⚡ Performance improvements
- Single‑pass turn boundary computation in trimmers.
- Smarter status dispatch (skip duplicates).
- Targeted DOM observers for message watching.
- Reduced global DOM queries for scroll/save + message counting.
- Scroll restore retries with backoff (fewer retries).
- Mutation-based button reinsertion (no polling).
- Cached scroll container lookup.

---

## v1.0.3 — Configurable max extra messages

This release adds a setting to cap how many older messages can be loaded.

### ⚙️ New setting
- Added **Max Extra Messages** to limit how many older turns can be fetched.

---

## v1.0.2 — Performance optimizations (no behavior change)

This release keeps 1.0.1 behavior, but reduces CPU/GC overhead.

### ⚡ Performance improvements
- Limit fetch interception to conversation endpoints only.
- Skip trimming work when total turns are already within the limit.
- Cache scroll container lookup to avoid repeated DOM traversal.
- Replace periodic button polling with mutation-based reinsertion.

---

## v1.0.1 — UI refresh, smarter trimming, and quality improvements

This release improves both the popup experience and the conversation trimming engine.

### ✨ Highlights
- Refreshed popup UI for clearer performance stats and settings organization.
- Added theme controls (System, Light, Dark) directly in the popup.
- Improved badge behavior to better reflect active optimization state.
- Updated extension branding assets (new logo/screenshots) and manifest metadata.
- Expanded host compatibility details for both `chat.openai.com` and `chatgpt.com`.

### ⚡ Performance improvements
- Improved turn-aware trimming logic to better preserve chat structure while reducing rendered history.
- Better handling of support nodes (tool/image/attachment-related content) connected to visible messages.
- Additional robustness in page script + trimmer flow for long conversations.

### 🧹 Cleanup & maintenance
- Removed older donation badge flow and consolidated popup-based support messaging.
- Updated README docs and popup copy for consistency with current behavior.

---

## v1.0.0 — Initial release

First public release of **ChatGPT Speed**.

### Included in initial launch
- Fetch-level conversation trimming before ChatGPT UI render.
- Configurable message/turn limit for visible history.
- Popup controls for enable/disable, limit setting, and debug mode.
- Active badge/status indicators.
- Privacy-first local-only processing with minimal permissions.
