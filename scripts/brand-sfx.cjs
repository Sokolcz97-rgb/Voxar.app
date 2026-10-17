#!/usr/bin/env node
/*
 * Nastaví 7-Zip SFX modulu (7zSD.sfx) ikonu a údaje o souboru dřív, než se
 * z něj složí StudioVoxarioSetup.exe / VoxarioBrowserSetup.exe.
 * Bez toho stažený Setup ve Windows ukazoval ikonu a popis 7-Zipu.
 *
 * Použití:
 *   node scripts/brand-sfx.cjs <7zSD.sfx> <icon.ico> <výstup.sfx> "<Název produktu>" <verze>
 */
const fs = require("fs");
const path = require("path");
const PELibrary = require("pe-library");
const ResEdit = require("resedit");

function main() {
  const [source, iconPath, output, productName, version = "0.0.0"] = process.argv.slice(2);
  if (!source || !iconPath || !output || !productName) {
    console.error('Použití: node scripts/brand-sfx.cjs <7zSD.sfx> <icon.ico> <výstup.sfx> "<Název>" <verze>');
    process.exit(2);
  }

  const exe = PELibrary.NtExecutable.from(fs.readFileSync(source), { ignoreCert: true });
  const res = PELibrary.NtExecutableResource.from(exe);

  // Ikona: nahradíme existující skupinu ikon (nebo vytvoříme první).
  const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(iconPath));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const groupId = groups.length ? groups[0].id : 1;
  const groupLang = groups.length ? groups[0].lang : 1033;
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
    res.entries,
    groupId,
    groupLang,
    iconFile.icons.map((icon) => icon.data),
  );

  // Údaje o souboru (Vlastnosti → Podrobnosti, UAC a SmartScreen dialogy).
  const parts = String(version).split(".").map((n) => Number.parseInt(n, 10) || 0);
  while (parts.length < 4) parts.push(0);
  const [major, minor, patch, build] = parts;

  const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const vi = viList[0] || ResEdit.Resource.VersionInfo.createEmpty();
  const langs = vi.getAllLanguagesForStringValues();
  const targets = langs.length ? langs : [{ lang: 1033, codepage: 1200 }];

  vi.setFileVersion(major, minor, patch, build, targets[0].lang);
  vi.setProductVersion(major, minor, patch, build, targets[0].lang);
  for (const lang of targets) {
    vi.setStringValues(lang, {
      CompanyName: "StudioVoxario",
      FileDescription: productName,
      ProductName: productName,
      InternalName: productName,
      OriginalFilename: `${productName.replace(/\s+/g, "")}.exe`,
      LegalCopyright: "Copyright © StudioVoxario",
      FileVersion: version,
      ProductVersion: version,
    });
  }
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, Buffer.from(exe.generate()));

  // Kontrola výsledku: ikona i název musí být v novém souboru.
  const check = PELibrary.NtExecutableResource.from(
    PELibrary.NtExecutable.from(fs.readFileSync(output), { ignoreCert: true }),
  );
  const iconGroups = ResEdit.Resource.IconGroupEntry.fromEntries(check.entries);
  const info = ResEdit.Resource.VersionInfo.fromEntries(check.entries)[0];
  const strings = info ? info.getStringValues(targets[0]) : {};
  if (!iconGroups.length || strings.ProductName !== productName) {
    throw new Error("SFX modul se nepodařilo označit ikonou a názvem produktu.");
  }

  console.log(`✓ ${path.basename(output)}: ${productName} ${version}, ikony: ${iconFile.icons.length}`);
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
