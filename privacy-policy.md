# Privacy Policy for ChatGPT Speed

_Last updated: Jan. 11th 2026_

ChatGPT Speed is designed with privacy as a top priority.  
This extension does **not** collect, store, transmit, or share any personal data.

## 🔒 Data Collection
ChatGPT Speed collects **no data whatsoever**, including:

- No personal information  
- No browsing history  
- No authentication data  
- No chat content  
- No usage analytics  
- No device identifiers  
- No telemetry of any kind  

The extension contains **no tracking scripts**, **no analytics**, and **no external network requests**.

## 🧠 How the Extension Works
The extension operates entirely within the user’s browser.  
It enhances performance on ChatGPT by:

- Intercepting fetch requests to trim large response data before it hits the UI layer.
- Managing DOM nodes to keep the page lightweight.
- Restoring messages locally from cache when requested.

All logic runs locally and never leaves the user’s device.

## 🔑 Permissions Explanation
The extension requires minimal permissions:

### `storage`
Used only to save the extension’s own settings (enabled/disabled, message limits).  
No user data or chat contents are stored persistently.

### `activeTab`
Used only so the popup can send messages to the content script on the current ChatGPT tab.  
No access to other websites.

### Host permissions (`https://chat.openai.com/*`, `https://chatgpt.com/*`)
Required to intercept network requests and modify the DOM for performance optimization.  
No data is collected or transmitted.

## 🌐 Data Transfer
ChatGPT Speed does **not** send any data to any server.  
There are **no** external APIs, remote code, or cloud services.

## 📬 Contact
If you have privacy questions or concerns, please open an issue on GitHub.
