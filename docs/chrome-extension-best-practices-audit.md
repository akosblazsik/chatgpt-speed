# ChatGPT Speed: Chrome Extension Best-Practices Audit

## Scope
This audit compares the current repository implementation against common Chrome Extension (Manifest V3) best practices in five areas:

1. Permissions and host access minimization
2. Security boundaries and message hygiene
3. Reliability and service worker/content script architecture
4. Performance and storage usage
5. UX, privacy, and maintainability

---

## Executive summary

**Overall assessment: Good foundation with a few high-value hardening opportunities.**

- ✅ The extension follows MV3 and keeps permissions relatively narrow.
- ✅ It avoids remote code execution patterns and keeps logic local-first.
- ✅ It handles page-load timing carefully (`document_start`, MAIN world fetch patching).
- ⚠️ It can improve cross-context message validation (`window.postMessage` + listener filtering).
- ⚠️ It has minor configuration consistency drift between scripts that can cause subtle behavior mismatch.

---

## What aligns well with best practices

### 1) Minimal permissions and constrained host scope
- `manifest.json` limits hosts to ChatGPT domains only and uses just `storage` and `activeTab` permissions.
- This is aligned with “least privilege” expectations for store review and user trust.

### 2) Manifest V3 architecture is correctly used
- Uses a service worker (`background.service_worker`) and content scripts, consistent with MV3 requirements.
- Content scripts are split by phase (`document_start` and `document_idle`) to control ordering.

### 3) Performance-oriented data handling
- Intercepts and trims conversation payloads before rendering, reducing UI load for long threads.
- Uses change detection before status dispatch to avoid unnecessary updates.

### 4) Progressive fallback behavior
- Multiple `try/catch` guards around storage and parsing keep the extension resilient when data is absent/corrupt.
- Stats are cached in `storage.local` for better popup responsiveness.

### 5) Privacy posture is directionally strong
- The repo messaging and implementation emphasize local processing and no third-party telemetry.

---

## Gaps and recommendations vs best practices

### A) Cross-context messaging: tighten trust boundary (**High priority hardening**) 

**Observed pattern**
- Page script posts status with `window.postMessage(..., "*")`.
- Content script listens to `window.message` and consumes `event.data` without checking `event.source` or origin.

**Why this matters**
- Any script executing in the page can emit similarly shaped messages.
- In this codebase impact appears mostly to stats/UI integrity (not direct privileged API abuse), but message spoofing can still degrade trust and diagnostics.

**Recommendation**
- In listeners, require:
  - `event.source === window`
  - strict type checks and payload schema checks
  - optional nonce/session token shared by page+content scripts
- Prefer a distinct namespace envelope, e.g. `{ __csb: true, type: "status", ... }`.

### B) Configuration consistency drift across components (**Medium**) 

**Observed pattern**
- `page-inject.js` syncs only `{ enabled, messageLimit, debug }`.
- Other scripts may evolve to depend on additional settings fields over time.

**Why this matters**
- Inconsistent config mirrors can create surprising startup behavior depending on load order and stale localStorage values.

**Recommendation**
- Centralize a single config normalizer and reuse it from all script entry points.
- Keep one authoritative default object and import/share it.

### C) Message listener strictness in runtime messaging (**Medium**) 

**Observed pattern**
- `chrome.runtime.onMessage` handler in content script accepts messages by `type` only.

**Recommendation**
- Validate sender context where feasible (extension origin checks), and payload shape.
- Return explicit booleans and avoid unnecessary `return true` unless async response is expected.

### D) Storage location strategy review (**Low/Medium**) 

**Observed pattern**
- Uses `chrome.storage.sync` for settings and mirrors values into page `localStorage` for MAIN world access.

**Recommendation**
- This is pragmatic, but document the rationale and constraints.
- Consider tighter sync write discipline and explicit migration/versioning of settings blobs.

### E) Maintainability: codify quality gates (**Low**) 

**Observed pattern**
- Repository has no visible lint/test automation for extension scripts.

**Recommendation**
- Add lightweight CI checks (ESLint + manifest validation + basic packaging smoke test).
- Add a security checklist in CONTRIBUTING/README for messaging and permission changes.

---

## Suggested prioritized action plan

1. **Harden `window.postMessage` channel** with source/type/schema checks.
2. **Unify config serialization defaults** across `page-inject`, `boot`, and `page-script`.
3. **Add lint + manifest validation CI** to prevent regressions.
4. **Document trust boundaries** (MAIN world vs isolated content scripts) in README/ARCHITECTURE notes.

---

## Best-practices scorecard (subjective)

- Permission minimization: **8.5/10**
- MV3 compliance/structure: **8.5/10**
- Messaging security hygiene: **6.5/10**
- Performance architecture: **9/10**
- Maintainability/tooling: **6/10**

**Overall: 7.7/10** (solid implementation with clear hardening opportunities).

---

## Proposed implementation details for prioritized points (1, 2, 4)

### Point 1 — Harden cross-context `postMessage` channel

Implementation proposal:

- Wrap all extension-internal page/content messages with a strict envelope:
  - `__csb: true`
  - `channel: "chatgpt-speed"`
  - `type`
  - `payload` (when relevant)
- Emit with `targetOrigin = window.location.origin`.
- Validate in listeners before acting:
  - `event.source === window`
  - `event.origin === window.location.origin`
  - envelope exists and has expected `channel` and `type`

Expected effect:

- Reduces message spoofing risk from unrelated page scripts.
- Keeps stats/performance-warning signal paths deterministic.

### Point 2 — Unify settings defaults and normalization

Implementation proposal:

- Introduce shared `src/config.js` with:
  - `DEFAULT_SETTINGS`
  - `normalizeSettings(input)` for numeric clamping and safe fallback defaults
- Load `src/config.js` before dependent scripts in all relevant contexts:
  - `page-inject.js`, `page-script.js` (MAIN), `boot.js`, and popup page.
- Replace ad-hoc defaults in these scripts with the shared helper.

Expected effect:

- Eliminates config drift across execution contexts and startup edge cases.
- Makes future setting additions less error-prone.

### Point 4 — Document trust boundaries

Implementation proposal:

- Add an "Architecture & Trust Boundaries" section to README that explains:
  - MAIN world page script vs isolated content scripts vs popup/background responsibilities.
  - Why and how cross-context messages are validated.
  - Where settings are normalized and why.

Expected effect:

- Improves contributor safety when changing messaging, storage, or permissions.
- Makes security posture explicit for reviewers and store compliance checks.
