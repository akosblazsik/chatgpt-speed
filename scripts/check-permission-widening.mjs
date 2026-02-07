import fs from "node:fs";
import { execSync } from "node:child_process";

function parseManifestAtRef(ref) {
  const json = execSync(`git show ${ref}:manifest.json`, { encoding: "utf8" });
  return JSON.parse(json);
}

function toSet(value) {
  return new Set(Array.isArray(value) ? value : []);
}

function addedEntries(base, head) {
  const out = [];
  for (const item of head) {
    if (!base.has(item)) out.push(item);
  }
  return out;
}

const eventName = process.env.GITHUB_EVENT_NAME || "";
if (eventName !== "pull_request" && eventName !== "pull_request_target") {
  console.log("Permission widening check skipped (not a pull request event).");
  process.exit(0);
}

const eventPath = process.env.GITHUB_EVENT_PATH;
if (!eventPath || !fs.existsSync(eventPath)) {
  console.error("Permission widening check failed: GITHUB_EVENT_PATH not found.");
  process.exit(1);
}

const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
const baseSha = event.pull_request?.base?.sha;
if (!baseSha) {
  console.error("Permission widening check failed: base SHA unavailable in event payload.");
  process.exit(1);
}

const baseManifest = parseManifestAtRef(baseSha);
const headManifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));

const addedPermissions = addedEntries(toSet(baseManifest.permissions), toSet(headManifest.permissions));
const addedHostPermissions = addedEntries(
  toSet(baseManifest.host_permissions),
  toSet(headManifest.host_permissions)
);
const addedOptionalPermissions = addedEntries(
  toSet(baseManifest.optional_permissions),
  toSet(headManifest.optional_permissions)
);

const hasWidening =
  addedPermissions.length > 0 ||
  addedHostPermissions.length > 0 ||
  addedOptionalPermissions.length > 0;

if (!hasWidening) {
  console.log("Permission widening check passed: no new permissions requested.");
  process.exit(0);
}

const prBody = String(event.pull_request?.body || "");
const hasReviewNote = /Permission-Review:\s*approved/i.test(prBody);
if (!hasReviewNote) {
  console.error("Permission widening detected without explicit review note.");
  if (addedPermissions.length) {
    console.error(`Added permissions: ${addedPermissions.join(", ")}`);
  }
  if (addedHostPermissions.length) {
    console.error(`Added host_permissions: ${addedHostPermissions.join(", ")}`);
  }
  if (addedOptionalPermissions.length) {
    console.error(`Added optional_permissions: ${addedOptionalPermissions.join(", ")}`);
  }
  console.error("Add 'Permission-Review: approved' to the PR description to acknowledge the change.");
  process.exit(1);
}

console.log("Permission widening detected and explicit review note found.");
