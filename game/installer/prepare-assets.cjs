"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const svgPath = path.join(ROOT, "assets", "ashes-of-eryon-logo-v0.1.svg");
const webpPath = path.join(ROOT, "assets", "ashes-of-eryon-logo-v0.1.webp");

function main() {
  const svg = fs.readFileSync(svgPath, "utf8");
  const match = svg.match(/data:image\/webp;base64,([^"'<>\s]+)/i);
  if (!match) throw new Error("Embedded WebP payload was not found in approved logo SVG.");

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length < 10000) throw new Error("Decoded logo WebP is unexpectedly small.");

  fs.writeFileSync(webpPath, bytes);
  console.log(`Prepared installer logo: ${path.relative(ROOT, webpPath)} (${bytes.length} bytes)`);
}

main();
