"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { packager } = require("@electron/packager");
const Seven = require("node-7z");
const sevenBin = require("7zip-bin");

const ROOT = __dirname;
const LAUNCHER_PAYLOAD = path.join(ROOT, "..", "launcher", "app", "dist", "win-unpacked");
const RESOURCES = path.join(ROOT, "resources");
const ARCHIVE = path.join(RESOURCES, "launcher.7z");
const SEVEN_ZIP = path.join(RESOURCES, "7za.exe");
const DIST = path.join(ROOT, "dist");
const EXPECTED_EXE = path.join(LAUNCHER_PAYLOAD, "Ashes of Eryon Launcher.exe");

async function archiveLauncher() {
  if (!fs.existsSync(EXPECTED_EXE)) {
    throw new Error(`Launcher payload missing: ${EXPECTED_EXE}. Run the launcher Windows build first.`);
  }

  fs.mkdirSync(RESOURCES, { recursive: true });
  fs.rmSync(ARCHIVE, { force: true });
  fs.copyFileSync(sevenBin.path7za, SEVEN_ZIP);

  await new Promise((resolve, reject) => {
    const task = Seven.add(ARCHIVE, path.join(LAUNCHER_PAYLOAD, "*"), {
      $bin: sevenBin.path7za,
      method: ["x=5"]
    });

    task.on("end", resolve);
    task.on("error", reject);
    task.on("progress", (progress) => {
      process.stdout.write(`\rCompressing launcher: ${progress.percent || 0}%   `);
    });
  });

  process.stdout.write("\n");
}

async function packageInstaller() {
  fs.rmSync(DIST, { recursive: true, force: true });

  const paths = await packager({
    dir: ROOT,
    name: "AshesOfEryonInstaller",
    platform: "win32",
    arch: "x64",
    out: DIST,
    overwrite: true,
    asar: true,
    ignore: [
      /^\/resources\/launcher\.7z$/,
      /^\/resources\/7za\.exe$/,
      /^\/dist($|\/)/,
      /^\/out($|\/)/
    ],
    extraResource: [
      ARCHIVE,
      SEVEN_ZIP
    ]
  });

  if (!Array.isArray(paths) || !paths.length) {
    throw new Error("Electron Packager did not return an output directory.");
  }

  return paths[0];
}

async function main() {
  await archiveLauncher();
  const runtimeDir = await packageInstaller();

  const runtimeExe = path.join(runtimeDir, "AshesOfEryonInstaller.exe");
  if (!fs.existsSync(runtimeExe)) {
    throw new Error(`Installer runtime not created: ${runtimeExe}`);
  }

  const payload = path.join(runtimeDir, "resources", "launcher.7z");
  if (!fs.existsSync(payload)) {
    throw new Error(`Packaged launcher payload missing: ${payload}`);
  }

  console.log(`Installer runtime ready: ${runtimeExe}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
