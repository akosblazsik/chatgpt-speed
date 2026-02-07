# ChatGPT Speed

**Make long ChatGPT threads fast again.**

ChatGPT Speed is a **Chrome** extension that reduces lag in long conversations by trimming what the browser renders. This keeps the UI fast even when a chat has hundreds or thousands of messages.

**Privacy-first:** Trimming happens **locally** in your browser. The extension does **not** send your data to any server. (ChatGPT still communicates with OpenAI as usual.)

## Download

| Browser | Store Link |
| :--- | :--- |
| **Google Chrome** | [**Download from Chrome Web Store**](https://chromewebstore.google.com/detail/denmnkfiabmkhgkacnappiekcfclbogk?utm_source=item-share-cb) |

Source: https://github.com/akosblazsik/chatgpt-speed

---

## Support

If this extension is useful to you, you can buy me a coffee:

- [Buy Me a Coffee](https://buymeacoffee.com/akosblazsik)

---

## What It Does

### Performance
- **Fetch-level trimming:** Intercepts ChatGPT's conversation JSON and trims it *before* React renders, so the browser avoids loading large historical payloads.
- **Turn-aware limits:** Keeps the last N *turns* (role changes), so multi-part assistant replies stay intact.
- **Support node preservation:** Keeps tool/image/attachment helper nodes tied to visible messages.

> **Good to know:** The extension only changes what your browser renders. ChatGPT still sees and remembers your full conversation.

### Stats & UI
- **Popup dashboard:** Total messages, rendered count, and memory saved (%).
- **Theme:** System, light, or dark mode for the popup.

### Privacy & Security
- **Local processing:** All logic runs locally. No data leaves your browser.
- **Minimal permissions:** Only runs on `chat.openai.com` and `chatgpt.com`.

## Installation

### Option 1 — Install from Web Stores (Recommended)
Use the links in the [Download](#download) section above.

### Option 2 — Install Manually (Unpacked)

#### For Google Chrome (and Edge/Brave)
1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the project folder.
6. Open ChatGPT — the extension runs automatically.

## Package

To ship updates with an additional security layer, use **Verified CRX Uploads** in the Chrome Web Store
package workflow. This ensures the uploaded bundle matches the signed CRX expected by the store.

Release bundle creation:
- Run `./package.sh` to generate the zip in `target/`.
- Upload the zip via the Chrome Web Store package page with Verified CRX Uploads enabled.

### RSA Key Pair (Required)

Generate a 2048-bit RSA private key:
```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out privatekey.pem
```

### Private Key Safety (Read Carefully)

Warning: Ensure that you keep your private key safe and secure. In particular:
- Do not upload the private key to any public repository or other place.
- Do not store your private key in your Google Account. This means someone with access to the Developer Dashboard through your Google Account could publish on your behalf.
- Consider storing your private key securely using a keystore like PKCS#12 or Java Keystore.
- Warning: Do not lose your private key; otherwise, you must reach out to CWS support, and replacement can take up to one week.

## Settings

Click the extension icon to access:
- **Enable Speed:** Toggle optimization on/off.
- **Messages to Show:** Set how many recent messages to keep visible (default: 15, range: 1–100).
- **Max Extra Messages:** Cap how many older messages can be loaded beyond the base limit.
- **Debug Mode:** Enable detailed console logs for troubleshooting.
- **Save Settings:** Refreshes the current ChatGPT tab after updating settings.


## Architecture & Trust Boundaries

ChatGPT Speed uses three execution contexts with different capabilities:

1. **Page script (`src/page-script.js`, MAIN world):**
   - Can patch `window.fetch` before ChatGPT app code runs.
   - Does **not** use privileged extension APIs directly.
2. **Content scripts (`src/page-inject.js`, `src/boot.js`, `src/navigation.js`, etc.):**
   - Run in isolated extension world and can use `chrome.*` APIs.
   - Bridge state between extension storage and the page runtime.
3. **Extension UI/background (`src/popup.js`, `src/background.js`):**
   - Store settings in `chrome.storage.sync` and render popup controls.

### Context boundaries

Each context has a narrow responsibility and a clear data surface:

- **Popup/background:** Owns user settings persistence and UI.
- **Content scripts:** Mediate between extension storage/APIs and the page, and handle navigation glue.
- **Page script:** Owns fetch interception + trimming logic and reports status outward.

### Messaging hardening

Cross-context messages use a namespaced envelope:

- `__csb: true`
- `channel: "chatgpt-speed"`
- `type` + typed `payload`

Listeners validate message source and shape before acting:

- `event.source === window`
- `event.origin === window.location.origin`
- required envelope fields and expected `type`

This reduces risk of untrusted page scripts spoofing extension-internal status messages.

### Messaging channels

- **Page script → content scripts:** `window.postMessage` with the `__csb`/`channel` envelope for status + alerts.
- **Content scripts → page script:** Implicit via shared local storage updates that the page script reads on load.
- **Extension runtime:** `chrome.runtime.onMessage` for popup/background ↔ content coordination.

### Shared settings normalization

`src/config.js` provides a single `DEFAULT_SETTINGS` object and `normalizeSettings()` helper.
These are reused by page/content/popup scripts to avoid drift in defaults and clamping rules.

### Storage ownership

- **`chrome.storage.sync`:** Source of truth for user settings (popup/background writes; content reads).
- **`chrome.storage.local`:** Cached stats for popup display.
- **`localStorage` (page origin):** Settings mirror for MAIN-world access and transient extra-messages state.
- **`sessionStorage` (page origin):** Ephemeral navigation/scroll/status flags.


## CI & Permission Change Guard

Repository CI runs lint plus manifest/package validation.

If a pull request adds any new `permissions`, `optional_permissions`, or `host_permissions` in `manifest.json`, CI requires an explicit PR-body acknowledgment line:

`Permission-Review: approved`

This keeps permission widening visible and intentionally reviewed.

## License

This project is licensed under the MIT License. See `LICENSE`.
Third-party notices are in `THIRD_PARTY_LICENSES.md`.

## Disclaimer

**ChatGPT Speed** is an unofficial extension and is not affiliated with, endorsed by, or connected to OpenAI or ChatGPT in any way. "ChatGPT" is a registered trademark of OpenAI. This extension works entirely locally on your machine to improve your personal browsing experience.
