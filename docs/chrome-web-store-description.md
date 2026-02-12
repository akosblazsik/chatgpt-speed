ChatGPT Speed keeps the UI fast even when a chat has hundreds or thousands of messages.

Privacy-first: Trimming happens locally in your browser. The extension does not send your data to any server. (ChatGPT still communicates with OpenAI as usual.)

What it does:
• Fetch-level trimming: Intercepts ChatGPT’s conversation JSON and trims it before React renders, reducing heavy payloads.
• Turn-aware limits: Keeps the last N turns (role changes), so multi-part replies stay intact.
• Support node preservation: Keeps tool/image/attachment helper nodes tied to visible messages.
• Popup dashboard: Total messages, rendered count, and memory saved (%).
• Popup settings: Enable Speed, message limits, and auto-refresh preferences in one place.
• Theme: System, light, or dark mode for the popup.
• Local processing: All logic runs locally. No data leaves your browser.
• Minimal permissions: Only runs on chat.openai.com and chatgpt.com.
• Good to know: The extension only changes what your browser renders. ChatGPT still sees and remembers your full conversation.

Support:
If this open-source extension is useful, you can buy me a coffee: https://buymeacoffee.com/akosblazsik

Source:
https://github.com/akosblazsik/chatgpt-speed

License:
MIT License. Third-party notices in THIRD_PARTY_LICENSES.md.

Disclaimer:
ChatGPT Speed is an unofficial extension and is not affiliated with, endorsed by, or connected to OpenAI or ChatGPT. “ChatGPT” is a registered trademark of OpenAI. This extension runs entirely locally to improve your personal browsing experience.
