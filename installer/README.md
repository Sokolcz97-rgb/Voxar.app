# StudioVoxario custom installer

Vlastní HUD Electron instalátor pro Windows — bez klasického Windows okna, bez UAC, bez `cmd.exe` / `.bat`.

## Co dělá

1. HUD wizard: Vítejte → Umístění → **Kanál (Stable / Beta)** → Instalace → Hotovo.
2. Rozbalí přiložený `resources/app.7z` do `%LOCALAPPDATA%\StudioVoxario`.
3. Vytvoří zkratky (Start Menu + volitelně plocha) přes `windows-shortcuts` (LNK přes native, žádný `powershell.exe`).
4. Zapíše `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\StudioVoxario` přes `winreg`.
5. Uloží `channel.json` do install složky — launcher ho čte a nastaví `autoUpdater.channel`.
6. Spuštění: `child_process.spawn(exe, [], { detached: true, windowsHide: true, stdio: 'ignore' }).unref()`.
7. Uninstall (`StudioVoxarioInstaller.exe --uninstall`) používá stejné UI a stejnou cestu bez shellu.

## Build (Windows nebo cross-build z Linuxu)

```bash
# 1) V root repa: vytvoř Windows build aplikace
cd /dev-server
npx vite build
npx @electron/packager electron StudioVoxario \
  --platform=win32 --arch=x64 \
  --out=electron-release --overwrite

# 2) V installer/: sbal instalátor
cd installer
npm install
node build.cjs
```

Výstup: `installer/dist/StudioVoxarioInstaller-win32-x64/StudioVoxarioInstaller.exe`
(~90 MB s vloženým Electron runtime + app.7z).

## Nahrání do Lovable CDN

```bash
cp installer/dist/StudioVoxarioInstaller-win32-x64/StudioVoxarioInstaller.exe \
   /tmp/StudioVoxarioSetup-0.0.9-alpha.exe
lovable-assets create --file /tmp/StudioVoxarioSetup-0.0.9-alpha.exe \
  > src/assets/downloads/windows-installer.asset.json
```

Poté updatnout `public/desktop-version.json`, `public/latest.yml`, `public/beta.yml`
o novou velikost/SHA256.

## Bezpečnostní poznámka

Instalátor **není code-signed** (chybí EV cert). Windows SmartScreen tedy stále
zobrazí "Přesto spustit". Řešení: pořídit EV certifikát a podepsat výstup přes
`signtool.exe` mimo tento repozitář.
