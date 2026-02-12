# Release Notes

## v1.0.21 — Project chat URL support for load-previous button

### 🛠️ Fixes
- Fixed conversation ID parsing so `Load previous messages` works on project chat URLs like `/g/.../c/<conversation-id>`.
- Preserved existing behavior for regular `/c/<conversation-id>` chats.

### 🧾 Documentation
- Updated Chrome Web Store description copy to reflect current settings and on-demand older message loading.

---

## v1.0.20 — Remove max extra messages setting

### ⚙️ Settings
- Removed **Max Extra Messages** from the popup settings UI.
- Removed the related `maxExtraMessages` config/state/storage paths from runtime scripts.
- Loading older messages now increments based on current limit and session message growth without a separate max-extra cap.

### 🧾 Documentation
- Updated README and docs references to reflect the removed setting.

---

## v1.0.19 — Auto-refresh and navigation bugfixes

### 🛠️ Fixes
- Fixed premature `Load previous messages` button visibility on new or switching chats.
- Added stronger status guards using URL/conversation identity to prevent stale state bleed between chats.
- Reset navigation state and stale session status on conversation changes.
- Deferred auto-refresh while ChatGPT is actively streaming, then trigger safely after generation settles.
- Switched auto-refresh to background tab reload messaging as primary path for better runtime stability.

---

## v1.0.18 — Popup auto-refresh settings

### ⚙️ Settings
- Added `Auto-refresh` toggle to the popup settings.
- Auto-refresh now uses the existing `Messages to Show` threshold.
- Extended shared settings normalization/defaults so popup/content/page scripts keep a consistent settings shape.

### 🧾 Documentation
- Updated README settings docs and Chrome Web Store description copy to include auto-refresh preferences.

---

## v1.0.17 — Header badges + shorter warning copy

### 🎨 UI
- Moved status badges into the page header (next to the model selector).
- Shortened performance warning copy for better fit.

---

## v1.0.16 — Navigation button theme support

### 🎨 UI
- Made the “Load previous messages” button adapt to light/dark themes.
- Added live theme-change tracking so the button updates without reloads.

### 📷 Store assets
- Refreshed light/dark Chrome Web Store screenshots.

### 🧾 Documentation
- Added Chrome Web Store description and privacy copy.

---

## v1.0.15 — Theme-aware action icons

### 🎨 Branding
- Added light/dark action icon switching, tied to popup theme or system theme.
- Reserved full-color 16/32/48/128 icons for manifest usage.

---

## v1.0.14 — Icon refresh

### 🎨 Branding
- Updated extension icons to the new 16/48/128 assets.

---

## v1.0.13 — Tooling and CI checks

### 🛠️ Maintenance
- Added ESLint for extension JavaScript with baseline safety rules.
- Added CI workflow to run lint and manifest/package validation.
- Added permission-widening guard that requires an explicit review note.
- Documented context boundaries, messaging channels, and storage ownership in README.

---

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
