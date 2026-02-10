# Chrome Web Store: Privacy/Permissions Notes

## Offscreen justification
The extension uses an offscreen document only to observe the system color scheme
via `matchMedia("(prefers-color-scheme: dark)")` so it can update the toolbar icon
to the appropriate light/dark variant. The offscreen page does not access page
content, collect user data, or make network requests. It only sends a small
message to the service worker when the system theme changes.

