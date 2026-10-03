"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const sharp = require("sharp");

const ROOT = __dirname;
const OUTPUT = path.join(ROOT, "visual-output");
const REFERENCE = path.join(ROOT, "assets", "installer-approved-v0.1.webp");
const WIDTH = 1120;
const HEIGHT = 720;

async function waitForReady(win) {
  const timeoutAt = Date.now() + 15000;

  while (Date.now() < timeoutAt) {
    try {
      const ready = await win.webContents.executeJavaScript(
        "Boolean(window.__ASHES_VISUAL_READY__)",
        true
      );
      if (ready) return;
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("Installer visual preview did not become ready.");
}

async function captureStep(step) {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    backgroundColor: "#020406",
    webPreferences: {
      preload: path.join(ROOT, "visual-preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      offscreen: true
    }
  });

  try {
    await win.loadFile(path.join(ROOT, "ui", "index.html"), {
      query: {
        mode: "install",
        visualTest: "1",
        previewStep: String(step)
      }
    });

    await waitForReady(win);
    await new Promise((resolve) => setTimeout(resolve, 350));

    const image = await win.capturePage();
    const output = path.join(OUTPUT, `actual-step-${step + 1}.png`);
    fs.writeFileSync(output, image.toPNG());
    return output;
  } finally {
    win.destroy();
  }
}

async function buildActualGrid(images) {
  const cellWidth = 512;
  const cellHeight = 512;
  const composite = [];

  for (let index = 0; index < images.length; index += 1) {
    const buffer = await sharp(images[index])
      .resize(cellWidth, cellHeight, { fit: "fill" })
      .png()
      .toBuffer();

    composite.push({
      input: buffer,
      left: (index % 3) * cellWidth,
      top: Math.floor(index / 3) * cellHeight
    });
  }

  const output = path.join(OUTPUT, "actual-grid.png");
  await sharp({
    create: {
      width: cellWidth * 3,
      height: cellHeight * 2,
      channels: 4,
      background: { r: 2, g: 4, b: 6, alpha: 1 }
    }
  })
    .composite(composite)
    .png()
    .toFile(output);

  return output;
}

async function buildComparison(actualGrid) {
  const reference = await sharp(REFERENCE)
    .resize(1536, 1024, { fit: "fill" })
    .png()
    .toBuffer();

  const actual = await sharp(actualGrid)
    .resize(1536, 1024, { fit: "fill" })
    .png()
    .toBuffer();

  const output = path.join(OUTPUT, "reference-vs-actual.png");

  await sharp({
    create: {
      width: 3072,
      height: 1024,
      channels: 4,
      background: { r: 2, g: 4, b: 6, alpha: 1 }
    }
  })
    .composite([
      { input: reference, left: 0, top: 0 },
      { input: actual, left: 1536, top: 0 }
    ])
    .png()
    .toFile(output);

  return output;
}

app.disableHardwareAcceleration();

async function main() {
  fs.rmSync(OUTPUT, { recursive: true, force: true });
  fs.mkdirSync(OUTPUT, { recursive: true });

  const screenshots = [];
  for (let step = 0; step < 6; step += 1) {
    screenshots.push(await captureStep(step));
  }

  const actualGrid = await buildActualGrid(screenshots);
  const comparison = await buildComparison(actualGrid);

  console.log("Installer visual snapshots created:");
  for (const file of screenshots) console.log(` - ${file}`);
  console.log(` - ${actualGrid}`);
  console.log(` - ${comparison}`);
}

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
