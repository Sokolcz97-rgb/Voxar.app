const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "dist");
const target = path.join(root, "electron", "dist");
const nativeBrowser = path.join(root, "electron", "browser.html");

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

// Skutečný VoxarioBrowser v desktop aplikaci používá electron/browser.html,
// nikoliv React route src/pages/VoxarioBrowser.tsx. Před zabalením proto do
// nativního HTML deterministicky doplníme drag & drop tabů. Patch je idempotentní,
// takže lokální opakované spuštění desktop:prepare nevytváří duplicitní kód.
function patchNativeBrowserTabs() {
  if (!fs.existsSync(nativeBrowser)) {
    throw new Error("Chybí electron/browser.html — nativní VoxarioBrowser nelze připravit.");
  }

  let html = fs.readFileSync(nativeBrowser, "utf8");
  const marker = "VOXARIO_NATIVE_TAB_DRAG_V1";
  if (html.includes(marker)) {
    console.log("Nativní drag & drop tabů už je v electron/browser.html připraven.");
    return;
  }

  const activeCss = /(^\s*\.tab\.active \{[^\n]+\}\r?\n)/m;
  if (!activeCss.test(html)) {
    throw new Error("Nelze najít CSS kotvu .tab.active v electron/browser.html.");
  }
  html = html.replace(
    activeCss,
    `$1    /* ${marker} */\n` +
      `    .tab { user-select: none; }\n` +
      `    .tab.dragging { opacity: .55; cursor: grabbing; }\n` +
      `    .tab.drag-over-left { box-shadow: inset 3px 0 0 var(--cyan), 0 0 14px -8px var(--cyan); }\n` +
      `    .tab.drag-over-right { box-shadow: inset -3px 0 0 var(--cyan), 0 0 14px -8px var(--cyan); }\n`
  );

  const seqAnchor = "    let seq = 0;\n";
  if (!html.includes(seqAnchor)) {
    throw new Error("Nelze najít JS kotvu let seq = 0 v electron/browser.html.");
  }
  html = html.replace(
    seqAnchor,
    seqAnchor +
      "    let draggedTabId = null;\n" +
      "    function clearTabDragIndicators() {\n" +
      "      document.querySelectorAll('.tab').forEach((node) => {\n" +
      "        node.classList.remove('dragging', 'drag-over-left', 'drag-over-right');\n" +
      "      });\n" +
      "    }\n"
  );

  const tabClassAnchor = "        el.className = 'tab' + (t.id === activeId ? ' active' : '');\n";
  if (!html.includes(tabClassAnchor)) {
    throw new Error("Nelze najít render kotvu tab elementu v electron/browser.html.");
  }
  html = html.replace(
    tabClassAnchor,
    tabClassAnchor +
      "        el.draggable = true;\n" +
      "        el.dataset.tabId = t.id;\n" +
      "        el.addEventListener('dragstart', (e) => {\n" +
      "          if (e.target?.closest?.('.x')) { e.preventDefault(); return; }\n" +
      "          draggedTabId = t.id;\n" +
      "          el.classList.add('dragging');\n" +
      "          try {\n" +
      "            e.dataTransfer.effectAllowed = 'move';\n" +
      "            e.dataTransfer.setData('text/plain', t.id);\n" +
      "          } catch {}\n" +
      "        });\n" +
      "        el.addEventListener('dragend', () => {\n" +
      "          draggedTabId = null;\n" +
      "          clearTabDragIndicators();\n" +
      "        });\n" +
      "        el.addEventListener('dragover', (e) => {\n" +
      "          if (!draggedTabId || draggedTabId === t.id) return;\n" +
      "          e.preventDefault();\n" +
      "          const rect = el.getBoundingClientRect();\n" +
      "          const before = e.clientX < rect.left + rect.width / 2;\n" +
      "          el.classList.toggle('drag-over-left', before);\n" +
      "          el.classList.toggle('drag-over-right', !before);\n" +
      "          try { e.dataTransfer.dropEffect = 'move'; } catch {}\n" +
      "        });\n" +
      "        el.addEventListener('dragleave', () => {\n" +
      "          el.classList.remove('drag-over-left', 'drag-over-right');\n" +
      "        });\n" +
      "        el.addEventListener('drop', (e) => {\n" +
      "          e.preventDefault();\n" +
      "          const fromId = draggedTabId || e.dataTransfer?.getData?.('text/plain');\n" +
      "          if (!fromId || fromId === t.id) { clearTabDragIndicators(); return; }\n" +
      "          const fromIndex = tabs.findIndex((item) => item.id === fromId);\n" +
      "          if (fromIndex < 0) { clearTabDragIndicators(); return; }\n" +
      "          const rect = el.getBoundingClientRect();\n" +
      "          const before = e.clientX < rect.left + rect.width / 2;\n" +
      "          const [moved] = tabs.splice(fromIndex, 1);\n" +
      "          let insertIndex = tabs.findIndex((item) => item.id === t.id);\n" +
      "          if (insertIndex < 0) insertIndex = tabs.length;\n" +
      "          if (!before) insertIndex += 1;\n" +
      "          tabs.splice(Math.max(0, Math.min(insertIndex, tabs.length)), 0, moved);\n" +
      "          draggedTabId = null;\n" +
      "          clearTabDragIndicators();\n" +
      "          saveSession();\n" +
      "          render();\n" +
      "        });\n"
  );

  const closeAnchor = "        x.className = 'x';\n";
  if (!html.includes(closeAnchor)) {
    throw new Error("Nelze najít kotvu tlačítka zavření tabu v electron/browser.html.");
  }
  html = html.replace(closeAnchor, closeAnchor + "        x.draggable = false;\n");

  fs.writeFileSync(nativeBrowser, html, "utf8");
  if (!fs.readFileSync(nativeBrowser, "utf8").includes(marker)) {
    throw new Error("Patch nativního drag & dropu tabů se nepodařilo zapsat.");
  }
  console.log("Nativní VoxarioBrowser: drag & drop tabů připraven pro build.");
}

patchNativeBrowserTabs();
console.log("Electron renderer připraven v electron/dist");