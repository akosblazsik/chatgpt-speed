# ChatGPT Speed vs Chrome Extension Best Practices (MV3)

Date: 2026-02-07

## Purpose
This document compares the current repository state to widely accepted Chrome Extension Manifest V3 best practices, with direct evidence from source files and concrete follow-up actions.

## Executive Summary

ChatGPT Speed is **largely aligned** with MV3 best practices for permission minimization, local-first processing, and context separation. The project also includes notable trust-boundary hardening (message envelope + origin/source checks) that many small extensions skip.

Main opportunity areas are now operational rather than structural: automated lint/tests in CI, stricter schema validation for all runtime message payloads, and stronger release hygiene checks.

## Comparison Matrix

| Area | Best-practice expectation | Current status | Assessment |
|---|---|---|---|
| Manifest & MV3 | MV3, service worker background, no persistent background page | Uses `manifest_version: 3` and a service worker background | ✅ Strong |
| Permission minimization | Keep API + host permissions minimal and scoped | Uses `storage`, `activeTab`, and only ChatGPT host patterns | ✅ Strong |
| Cross-context security | Validate message source/origin and namespace internal events | Validates `source`, `origin`, envelope, channel, and type for `window.message` | ✅ Strong |
| Config consistency | One source of defaults + normalization shared by all contexts | `src/config.js` defines `DEFAULT_SETTINGS` and `normalizeSettings()` used across scripts | ✅ Strong |
| Privacy posture | Local processing, no remote telemetry unless explicitly needed | README states local processing; core logic performs local trimming | ✅ Strong |
| Reliability | Defensive coding around storage/runtime errors | Multiple guarded storage/runtime call sites and graceful fallbacks | ✅ Good |
| Tooling & governance | Linting/testing/CI gates for regressions and security checks | No CI/lint config present in repository | ⚠️ Needs improvement |

## Detailed Findings

### 1) MV3 architecture and execution-context design (Aligned)
- The extension is explicitly MV3 and uses a service worker background script. 
- Content scripts are phased (`document_start` for early config/bootstrap and MAIN-world patching, `document_idle` for UI/navigation behavior), which is appropriate for this extension’s fetch-intercept strategy.

**Why this is good:** it follows modern Chrome extension lifecycle constraints and avoids deprecated persistent background model.

## 2) Principle of least privilege (Aligned)
- Host permissions are restricted to `https://chat.openai.com/*` and `https://chatgpt.com/*`.
- Declared extension permissions are narrow (`storage`, `activeTab`).

**Why this is good:** this reduces attack surface and improves Web Store review posture.

## 3) Trust boundaries and message hardening (Aligned, improved)
- Cross-context status events use a namespaced envelope (`__csb`, `channel`, `type`, `payload`).
- The content script listener rejects messages unless they come from the same `window` and same page origin.
- Runtime message handling includes sender trust checks before responding.

**Why this is good:** prevents accidental acceptance of arbitrary in-page messages and reduces spoofing risk.

## 4) Shared settings normalization (Aligned)
- Settings defaults and clamping are centralized in `src/config.js`.
- Popup/content/page scripts consume the same normalization behavior.

**Why this is good:** avoids drift bugs and keeps limits/enums consistent (`messageLimit`, `maxExtraMessages`, `theme`).

## 5) Privacy-by-design posture (Aligned)
- User-facing docs explicitly state local-only behavior.
- Core behavior trims response payloads in-browser rather than transmitting conversation content elsewhere.

**Why this is good:** aligns with user expectations and low-data-retention best practices.

## 6) Remaining gaps to reach “excellent”

### A. Missing automated quality/security gates (High priority)
No repository-level lint/test/CI configuration is present. This raises regression risk for trust-boundary and permission-sensitive code.

**Recommended next step:**
1. Add ESLint for extension JS.
2. Add a CI workflow that runs lint and a minimal manifest/package validation.
3. Add a static check that forbids permission widening without explicit review note.

### B. Schema strictness can be expanded (Medium)
The most sensitive channels are already validated. Some runtime message shapes are type-checked but could benefit from strict schema validation helpers for all message types.

**Recommended next step:**
- Add tiny shared validators for each message type (runtime + window), returning typed/normalized payloads.

### C. Release hardening opportunities (Low/Medium)
Packaging guidance is documented, but automated release guardrails are still mostly manual.

**Recommended next step:**
- Add release checklist automation (manifest/release-note version coherence, package hash output, optional signed artifact metadata).

## Suggested 30-day roadmap
1. **Week 1:** Introduce ESLint + basic npm scripts and run on changed files.
2. **Week 2:** Add GitHub Actions workflow for lint + manifest validation.
3. **Week 3:** Add shared message schema validators and unit-like script checks.
4. **Week 4:** Add release validation script (version consistency + package integrity output).

## Bottom Line
ChatGPT Speed currently sits in a **“good-to-very-good”** best-practices position for a focused MV3 extension, with most high-risk fundamentals already handled. The biggest lift now is not architecture rewrites, but automating safeguards so today’s strong posture remains stable as the code evolves.
