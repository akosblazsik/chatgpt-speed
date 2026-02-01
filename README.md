# ChatGPT Speed

**Fix lag & freezing in long ChatGPT conversations**

ChatGPT Speed is a **Chrome and Firefox** extension for ChatGPT that eliminates browser freezing and input lag by strictly controlling how many messages are loaded at once. It transforms sluggish, memory-hogging chats into **lightning-fast, crash-free experiences**—no matter how deep the discussion goes, even with hundreds of messages.

**🔐 Remain full privacy**: All processing happens **fully locally** in your browser. **Nothing** is sent to any server.

## 📥 Download

| Browser | Store Link |
| :--- | :--- |
| **Google Chrome** | [**Download from Chrome Web Store**](https://chromewebstore.google.com/detail/finipiejpmpccemiedioehhpgcafnndo?utm_source=item-share-cb) |
| **Mozilla Firefox** | [**Download from Firefox Add-ons**](https://addons.mozilla.org/en-GB/firefox/addon/chatgpt-speed-booster/) |

---

## Features

### 🚀 Performance
- **Smart Interception Technology**: We don't just hide elements—we fix the root cause. The extension locally intercepts the data stream to "trim" the conversation before it even reaches your screen. This means your browser never has to load those heavy, old messages in the first place.
- **100% Local & Privacy-Safe**: We believe speed shouldn't cost you your privacy. This entire process happens **locally on your machine**. The extension intercepts the data stream within your browser, optimizes it, and displays it—**absolutely no data is sent to us, to OpenAI, or to any third-party server**. Your conversations stay strictly between you and ChatGPT.
- **Zero Lag**: Type and scroll instantly, even in chats with thousands of messages. It's the essential upgrade for heavy ChatGPT users.

> **💡 Good to know:** Your AI experience stays exactly the same! This extension only removes the lag and sluggishness. It optimizes *what your browser displays*—ChatGPT's memory and context are completely unaffected. The AI still sees and remembers your entire conversation. You get all the speed, with none of the trade-offs.

### 🧭 Smart Navigation
- **Load Older Messages**: Seamlessly load previous messages with a click, maintaining your scroll position.
- **Scroll Anchoring**: Intelligent scroll restoration that handles dynamic content resizing (code blocks, images) without jumping.

### 📊 Real-time Stats
- **Popup Dashboard**: View total messages, rendered count, and memory saved.

### 🛡️ Privacy & Security
- **Local Processing**: All logic runs locally. No data leaves your browser.
- **Minimal Permissions**: Only runs on `chat.openai.com` and `chatgpt.com`.

## Installation

### **Option 1 — Install from Web Stores (Recommended)**
Use the links in the [Download](#-download) section above.

### **Option 2 — Install Manually (Unpacked)**

#### 📦 For Google Chrome (and Edge/Brave)
1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked**.
5. Select the project folder.
6. Open ChatGPT — the extension runs automatically.

#### 🦊 For Mozilla Firefox
1. Download or clone this repository.
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. Select the `manifest.json` file.

## Settings

Click the extension icon to access:
- **Enable Speed**: Toggle optimization on/off.
- **Messages to Keep**: Set how many recent messages to keep visible (default: 15).
- **Debug Mode**: Enable detailed console logs for troubleshooting.

## License

This project is licensed under the MIT License. See `LICENSE`.
Third-party notices are in `THIRD_PARTY_LICENSES.md`.

## Disclaimer

**ChatGPT Speed** is an unofficial extension and is not affiliated with, endorsed by, or connected to OpenAI or ChatGPT in any way. "ChatGPT" is a registered trademark of OpenAI. This extension works entirely locally on your machine to improve your personal browsing experience.

