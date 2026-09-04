/**
 * Správa záložek VoxarioBrowseru + import/export z ostatních prohlížečů.
 *
 * Podporované zdroje importu:
 *  - Google Chrome, Microsoft Edge, Opera GX, Brave, Vivaldi  → soubor `Bookmarks` (JSON)
 *  - Mozilla Firefox → poslední automatická záloha `bookmarkbackups/*.jsonlz4` (mozLz4)
 *  - libovolný Netscape HTML export (Soubor → Exportovat záložky)
 * Export: Netscape HTML (načte ho každý prohlížeč) nebo JSON.
 */
const fs = require("fs");
const path = require("path");
const os = require("os");

const STORE_NAME = "bookmarks.json";

function storePath(app) {
  return path.join(app.getPath("userData"), STORE_NAME);
}

function readBookmarks(app) {
  try {
    const raw = fs.readFileSync(storePath(app), "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeBookmarks(app, list) {
  const clean = dedupe(list);
  fs.mkdirSync(path.dirname(storePath(app)), { recursive: true });
  fs.writeFileSync(storePath(app), JSON.stringify(clean, null, 2), "utf8");
  return clean;
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const b of list || []) {
    const url = String(b?.url || "").trim();
    if (!url || !/^https?:|^file:/i.test(url)) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url,
      title: String(b?.title || url).slice(0, 300),
      folder: b?.folder ? String(b.folder).slice(0, 400) : "",
      source: b?.source || "voxario",
      addedAt: b?.addedAt || new Date().toISOString(),
    });
  }
  return out;
}

// ---------- Chromium rodina ----------
function chromiumRoots() {
  const home = os.homedir();
  const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
  const roaming = process.env.APPDATA || path.join(home, "AppData", "Roaming");
  const win = process.platform === "win32";
  const lin = process.platform === "linux";
  const mac = process.platform === "darwin";
  const macApp = path.join(home, "Library", "Application Support");
  const cfg = path.join(home, ".config");

  const entry = (id, label, dirs) => ({ id, label, dirs: dirs.filter(Boolean) });
  return [
    entry("chrome", "Google Chrome", [
      win && path.join(local, "Google", "Chrome", "User Data"),
      mac && path.join(macApp, "Google", "Chrome"),
      lin && path.join(cfg, "google-chrome"),
    ]),
    entry("edge", "Microsoft Edge", [
      win && path.join(local, "Microsoft", "Edge", "User Data"),
      mac && path.join(macApp, "Microsoft Edge"),
      lin && path.join(cfg, "microsoft-edge"),
    ]),
    entry("operagx", "Opera GX", [
      win && path.join(roaming, "Opera Software", "Opera GX Stable"),
      mac && path.join(macApp, "com.operasoftware.OperaGX"),
      lin && path.join(cfg, "opera-gx"),
    ]),
    entry("opera", "Opera", [
      win && path.join(roaming, "Opera Software", "Opera Stable"),
      mac && path.join(macApp, "com.operasoftware.Opera"),
      lin && path.join(cfg, "opera"),
    ]),
    entry("brave", "Brave", [
      win && path.join(local, "BraveSoftware", "Brave-Browser", "User Data"),
      mac && path.join(macApp, "BraveSoftware", "Brave-Browser"),
      lin && path.join(cfg, "BraveSoftware", "Brave-Browser"),
    ]),
    entry("vivaldi", "Vivaldi", [
      win && path.join(local, "Vivaldi", "User Data"),
      mac && path.join(macApp, "Vivaldi"),
      lin && path.join(cfg, "vivaldi"),
    ]),
  ];
}

function findChromiumBookmarkFiles(root) {
  const out = [];
  const direct = path.join(root, "Bookmarks");
  if (fs.existsSync(direct)) out.push(direct);
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (!/^(Default|Profile \d+|Guest Profile)$/i.test(e.name)) continue;
    const f = path.join(root, e.name, "Bookmarks");
    if (fs.existsSync(f)) out.push(f);
  }
  return out;
}

const ROOT_LABELS = {
  bookmark_bar: "Lišta záložek",
  other: "Ostatní záložky",
  synced: "Mobilní záložky",
};

function parseChromiumBookmarks(file, sourceLabel) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const out = [];
  // Zachová celou stromovou strukturu složek tak, jak byla v původním prohlížeči.
  const walk = (node, trail) => {
    if (!node) return;
    if (node.type === "url" && node.url) {
      out.push({ url: node.url, title: node.name || node.url, folder: trail.join("/"), source: sourceLabel });
      return;
    }
    const next = node.name ? [...trail, String(node.name)] : trail;
    for (const child of node.children || []) walk(child, next);
  };
  for (const key of Object.keys(data.roots || {})) {
    const root = data.roots[key];
    if (!root || typeof root !== "object") continue;
    const label = ROOT_LABELS[key] || root.name || key;
    for (const child of root.children || []) walk(child, [label]);
  }
  return out;
}

// ---------- Firefox (mozLz4 zálohy) ----------
function lz4BlockDecode(input, expected) {
  const out = Buffer.alloc(expected);
  let i = 0;
  let o = 0;
  while (i < input.length) {
    const token = input[i++];
    let literals = token >> 4;
    if (literals === 15) {
      let l;
      do {
        l = input[i++];
        literals += l;
      } while (l === 255);
    }
    input.copy(out, o, i, i + literals);
    i += literals;
    o += literals;
    if (i >= input.length) break;
    const offset = input[i++] | (input[i++] << 8);
    let matchLen = token & 0x0f;
    if (matchLen === 15) {
      let l;
      do {
        l = input[i++];
        matchLen += l;
      } while (l === 255);
    }
    matchLen += 4;
    let src = o - offset;
    for (let k = 0; k < matchLen; k++) out[o++] = out[src++];
  }
  return out.subarray(0, o);
}

function readMozLz4(file) {
  const buf = fs.readFileSync(file);
  if (buf.subarray(0, 8).toString("latin1") !== "mozLz40\0") {
    return buf.toString("utf8"); // nekomprimovaná záloha (.json)
  }
  const size = buf.readUInt32LE(8);
  return lz4BlockDecode(buf.subarray(12), size).toString("utf8");
}

function firefoxProfileRoots() {
  const home = os.homedir();
  if (process.platform === "win32") {
    const roaming = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    return [path.join(roaming, "Mozilla", "Firefox", "Profiles")];
  }
  if (process.platform === "darwin") {
    return [path.join(home, "Library", "Application Support", "Firefox", "Profiles")];
  }
  return [path.join(home, ".mozilla", "firefox")];
}

function findFirefoxBackups() {
  const files = [];
  for (const root of firefoxProfileRoots()) {
    let profiles = [];
    try {
      profiles = fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch {
      continue;
    }
    for (const p of profiles) {
      const dir = path.join(root, p.name, "bookmarkbackups");
      let backups = [];
      try {
        backups = fs.readdirSync(dir).filter((f) => /\.(jsonlz4|json)$/i.test(f));
      } catch {
        continue;
      }
      if (!backups.length) continue;
      backups.sort();
      files.push(path.join(dir, backups[backups.length - 1]));
    }
  }
  return files;
}

function parseFirefoxBackup(file) {
  const data = JSON.parse(readMozLz4(file));
  const out = [];
  const walk = (node, folder) => {
    if (!node) return;
    if (node.uri && /^https?:/i.test(node.uri)) {
      out.push({ url: node.uri, title: node.title || node.uri, folder, source: "Mozilla Firefox" });
    }
    for (const child of node.children || []) walk(child, node.title || folder);
  };
  walk(data, "");
  return out;
}

// ---------- Netscape HTML ----------
function parseNetscapeHtml(html) {
  const out = [];
  const re = /<A\s+[^>]*HREF="([^"]+)"[^>]*>([\s\S]*?)<\/A>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = m[1];
    const title = m[2].replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
    out.push({ url, title: title || url, folder: "", source: "HTML import" });
  }
  return out;
}

function toNetscapeHtml(list) {
  const rows = list
    .map((b) => `    <DT><A HREF="${escapeAttr(b.url)}">${escapeHtml(b.title || b.url)}</A>`)
    .join("\n");
  return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3>VoxarioBrowser</H3>
    <DL><p>
${rows}
    </DL><p>
</DL><p>
`;
}

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (s) => escapeHtml(s).replace(/"/g, "&quot;");

// ---------- Veřejné API ----------
function detectSources() {
  const found = [];
  for (const b of chromiumRoots()) {
    const files = b.dirs.flatMap(findChromiumBookmarkFiles);
    if (files.length) found.push({ id: b.id, label: b.label, files, kind: "chromium" });
  }
  const ff = findFirefoxBackups();
  if (ff.length) found.push({ id: "firefox", label: "Mozilla Firefox", files: ff, kind: "firefox" });
  return found;
}

function importFromSource(app, id) {
  const source = detectSources().find((s) => s.id === id);
  if (!source) return { ok: false, error: "Prohlížeč nebyl nalezen." };
  let imported = [];
  for (const file of source.files) {
    try {
      imported = imported.concat(
        source.kind === "firefox" ? parseFirefoxBackup(file) : parseChromiumBookmarks(file, source.label),
      );
    } catch (e) {
      console.error("bookmark import failed", file, e);
    }
  }
  return mergeInto(app, imported);
}

function importFromFile(app, file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    let items;
    if (/\.json$/i.test(file)) {
      const data = JSON.parse(raw);
      items = Array.isArray(data) ? data : parseFirefoxBackup(file);
    } else {
      items = parseNetscapeHtml(raw);
    }
    return mergeInto(app, items);
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

function mergeInto(app, items) {
  const before = readBookmarks(app);
  const merged = writeBookmarks(app, [...before, ...items]);
  return { ok: true, added: merged.length - before.length, total: merged.length, bookmarks: merged };
}

function exportToFile(app, file) {
  const list = readBookmarks(app);
  const body = /\.json$/i.test(file) ? JSON.stringify(list, null, 2) : toNetscapeHtml(list);
  fs.writeFileSync(file, body, "utf8");
  return { ok: true, count: list.length, file };
}

module.exports = {
  readBookmarks,
  writeBookmarks,
  detectSources,
  importFromSource,
  importFromFile,
  exportToFile,
};
