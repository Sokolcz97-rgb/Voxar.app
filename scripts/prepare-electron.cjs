const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "dist");
const target = path.join(root, "electron", "dist");

if (!fs.existsSync(path.join(source, "index.html"))) {
  throw new Error("Chybí dist/index.html. Nejdříve spusťte npm run build.");
}

fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });

for (const required of ["index.html", "assets"]) {
  if (!fs.existsSync(path.join(target, required))) {
    throw new Error(`Electron renderer není kompletní: chybí electron/dist/${required}`);
  }
}

console.log("Electron renderer připraven v electron/dist");