# Release Notes

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
