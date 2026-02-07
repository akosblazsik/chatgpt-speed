import fs from "node:fs";

const manifestPath = new URL("../manifest.json", import.meta.url);
const raw = fs.readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(raw);

function assert(condition, message) {
  if (!condition) {
    console.error(`Manifest validation failed: ${message}`);
    process.exit(1);
  }
}

assert(manifest.manifest_version === 3, "manifest_version must be 3");
assert(typeof manifest.name === "string" && manifest.name.length > 0, "name is required");
assert(typeof manifest.version === "string" && /^\d+\.\d+\.\d+/.test(manifest.version), "version must look like semver");
assert(manifest.background?.service_worker, "background.service_worker is required for MV3");
assert(Array.isArray(manifest.permissions), "permissions must be an array");
assert(Array.isArray(manifest.host_permissions), "host_permissions must be an array");

const hasBroadHost = manifest.host_permissions.some((entry) =>
  typeof entry === "string" && (entry.includes("<all_urls>") || entry === "*://*/*")
);
assert(!hasBroadHost, "broad host access is not allowed");

console.log("Manifest validation passed.");
