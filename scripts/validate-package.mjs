import fs from "node:fs";
import { spawnSync } from "node:child_process";

const requiredFiles = [
  "manifest.json",
  "package.sh",
  "src/popup.html",
  "README.md",
  "LICENSE"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Package validation failed: missing required file '${file}'`);
    process.exit(1);
  }
}

const syntax = spawnSync("bash", ["-n", "package.sh"], { stdio: "inherit" });
if (syntax.status !== 0) {
  console.error("Package validation failed: package.sh has shell syntax errors");
  process.exit(syntax.status ?? 1);
}

console.log("Package validation passed.");
