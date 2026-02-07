# ChatGPT Speed vs Chrome Extension Best Practices (Manifest V3)

Date: 2026-02-07

## Purpose
This document evaluates the current repository against practical Chrome extension best practices (MV3), highlights strong patterns already implemented, and identifies high-impact follow-up work.

## Executive Summary

ChatGPT Speed is in a **strong position** for a focused MV3 extension:

- It uses a correct MV3 architecture with a service worker background and staged content scripts.
- It keeps permissions narrow and host access tightly scoped to ChatGPT domains.
- It has meaningful cross-context hardening (message envelope + source/origin checks + trusted runtime sender checks).
- It includes local validation/tooling scripts for linting, manifest integrity, packaging sanity, and permission widening checks.

Primary gaps are now **operational maturity** rather than core architecture: no repository CI workflow, no automated tests around critical message schema behavior, and no formal architecture note for contributor onboarding.

## Comparison Matrix

| Area | Best-practice expectation | Current repository state | Assessment |
|---|---|---|---|
| MV3 architecture | Service worker background and no persistent background page | `manifest_version: 3` and `background.service_worker` are used | ✅ Strong |
| Least privilege | Minimal extension permissions and narrowly scoped host permissions | `storage`, `activeTab`, and only `chat.openai.com` + `chatgpt.com` host patterns | ✅ Strong |
| Cross-context messaging security | Validate trust boundary for `window.postMessage` + runtime messages | Uses namespaced envelope (`__csb`, `channel`), checks `event.source`, `event.origin`, and validates runtime sender identity | ✅ Strong |
| Shared settings model | Centralized defaults/normalization reused across extension contexts | `src/config.js` shared by page/content/popup flows; local fallback paths exist | ✅ Good |
| Privacy by design | Local-first processing, avoid unnecessary remote collection | Trimming logic runs in-browser; no telemetry pipeline implemented | ✅ Strong |
| Quality gates | Lint + policy checks + release checks run automatically in CI | Local scripts exist (`lint`, `validate:manifest`, `validate:package`, `check:permissions`) but no `.github/workflows` gate yet | ⚠️ Needs improvement |
| Maintainability | Clear architecture docs and contributor guardrails | Security posture is visible in code/docs, but architecture/trust-boundary guide is still implicit | ⚠️ Needs improvement |

## Detailed Findings

### 1) MV3 foundation and script lifecycle are well-designed
The extension follows MV3 requirements and separates responsibilities across service worker, content scripts, and MAIN world script injection. This is aligned with Chrome's modern extension lifecycle and reduces legacy risk.

**Why it matters:** Correct context separation is the baseline for reliability and reviewability in MV3.

### 2) Permission minimization is handled correctly
The project requests only `storage` and `activeTab`, and host permissions are constrained to two ChatGPT URL patterns.

**Why it matters:** Smaller permission surface improves user trust and lowers Web Store review friction.

### 3) Messaging trust boundaries are stronger than average
The repository uses a namespaced message envelope for page/content communication and applies strict listener filtering (`event.source`, `event.origin`, envelope fields). Runtime messages additionally validate sender trust with extension-id + origin/tab checks.

**Why it matters:** This substantially reduces accidental message spoof acceptance and keeps privileged paths bounded.

### 4) Config normalization is mostly centralized
`DEFAULT_SETTINGS` and `normalizeSettings()` are shared, reducing drift risk across popup/content/page logic.

**Why it matters:** Shared normalization avoids subtle cross-context bugs in setting boundaries.

### 5) Tooling exists, but automation around it is missing
The repo includes practical validation scripts for linting, manifest/package checks, and permission widening. However, these protections rely on manual execution because no CI workflow is configured.

**Why it matters:** Best-practice controls only protect reliably when automated on every PR/release.

## High-Impact Recommendations

### Priority 1 — Add CI enforcement (highest ROI)
Create a GitHub Actions workflow that runs:

1. `npm ci`
2. `npm run ci:checks`
3. `npm run check:permissions`

This turns existing good scripts into consistent policy gates.

### Priority 2 — Add focused tests for message schema and boundary checks
Add lightweight unit-style tests for critical validators and envelope acceptance/rejection logic.

Suggested targets:
- Runtime sender trust helper
- `window.message` envelope acceptance logic
- Config normalization clamping edge cases

### Priority 3 — Add an architecture/trust-boundary note
Document context boundaries (popup/content/page/background), messaging channels, and storage ownership.

This reduces regression risk when contributors modify fetch patching or messaging.

## Suggested 30-Day Roadmap

1. **Week 1:** Add CI workflow wiring to existing scripts.
2. **Week 2:** Add validator-focused tests around message/schema pathways.
3. **Week 3:** Add architecture + trust-boundary documentation section.
4. **Week 4:** Tighten release checklist automation (version coherence and package integrity output).

## Bottom Line

ChatGPT Speed is currently **well aligned** with Chrome extension MV3 best practices in its architecture, permissions, and security boundary handling. The main next step is to formalize and automate what is already good—primarily through CI and focused regression tests—so the current posture remains stable as the extension evolves.
