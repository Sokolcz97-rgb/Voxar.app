"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const webpPath = path.join(ROOT, "assets", "ashes-of-eryon-logo-v0.1.webp");

function main() {
  if (!fs.existsSync(webpPath)) {
    throw new Error("Approved WebP logo asset is missing.");
  }

  const stat = fs.statSync(webpPath);
  if (stat.size < 5000) {
    throw new Error("Approved WebP logo asset is unexpectedly small.");
  }

  const header = fs.readFileSync(webpPath).subarray(0, 12).toString("ascii");
  if (!header.startsWith("RIFF") || !header.includes("WEBP")) {
    throw new Error("Approved logo asset is not a valid WebP file.");
  }

  console.log(`Verified installer logo: ${path.relative(ROOT, webpPath)} (${stat.size} bytes)`);
}

main();
