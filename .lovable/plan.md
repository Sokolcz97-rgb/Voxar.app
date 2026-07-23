
## Cíl

Nahradit klasické NSIS okno Windowsu vlastním Electron instalátorem se stejným HUD stylem jako aplikace, přidat do launcheru volbu **Stable / Beta** (jako herní launchery) a aktualizovat stránku ke stažení. Auto-update pipeline zůstane na `electron-updater` bez `cmd.exe`.

## Rozsah

### 1. Vlastní Electron installer (`installer/`)
Nová malá Electron aplikace zabalená jako single `.exe` přes `@electron/packager` + `electron-installer-windows` **NEBO** self-extracting 7z stub. Zvolím self-extract 7z, který spustí `StudioVoxarioInstaller.exe` (Electron UI). Ten:

- Zobrazí HUD okno (glassmorphism, cyan/violet, stejné tokeny jako aplikace, bez rámu OS).
- Kroky: **Vítejte → Volba složky → Volba kanálu (Stable/Beta) → Instalace (progress + log) → Dokončeno / Spustit**.
- Rozbalí payload (`app.7z` uvnitř exe) do `%LOCALAPPDATA%\StudioVoxario`.
- Vytvoří Start Menu + Desktop shortcut přes `windows-shortcuts` npm.
- Zapíše registry `Uninstall\StudioVoxario` (DisplayName, DisplayIcon, UninstallString) — user-scope, žádné UAC.
- Uloží zvolený kanál do `%LOCALAPPDATA%\StudioVoxario\channel.json`.
- Uninstaller = stejný Electron binary s `--uninstall` flagem, opět HUD UI.
- Žádné volání `cmd.exe`, `taskkill`, `.bat`, `.cmd` — jen Node `fs`, `child_process.spawn(..., {detached, windowsHide, stdio: 'ignore'})` pro finální launch aplikace.

Zdrojové soubory:
```
installer/
  package.json
  main.cjs           # Electron main, IPC, fs, registry
  preload.cjs
  ui/
    index.html       # HUD UI
    styles.css       # design tokens sdílené s appkou
    installer.js     # kroky + progress
  assets/
    icon.ico
    bg.png
  build.cjs          # bundle app.7z do installer resources
```

### 2. Launcher — přepínač Stable / Beta
V `electron/main.cjs` a `electron/updater.cjs`:

- Přečíst `channel.json` z userData (fallback `stable`).
- Přidat IPC `channel:get` / `channel:set`.
- `autoUpdater.channel = 'stable' | 'beta'` + `setFeedURL` podle kanálu (`latest.yml` vs `beta.yml`, oba už existují).
- Přechod na beta vyžaduje beta přístupový kód (stejný jako pro `/desktop`) — ověří RPC `redeem_download_code` přes API.

V `electron/launcher.html`:
- Nová sekce **Kanál** vedle "Zkontrolovat aktualizace": dropdown Stable / Beta, tlačítko **Přepnout**.
- Ukázat aktuální kanál, poslední verze na daném kanálu (z `desktop-version.json`).

### 3. Stránka ke stažení (`src/pages/DownloadDesktop.tsx`)
- Přepínač **Stable / Beta** (Tabs), který mění zobrazené soubory.
- Karta pro nový `StudioVoxarioSetup-0.0.9-alpha.exe` (custom installer). ZIP a Linux tar.gz zůstávají.
- Popisky updatnout: "Vlastní HUD instalátor — bez klasického Windows okna".
- Data brát z `public/desktop-version.json` (rozšířené o `installerType: 'custom-electron'`).

### 4. Manifesty
- `public/desktop-version.json`, `public/latest.yml`, `public/beta.yml` — updatnout URL/velikost/hash **po** nahrání nového buildu jako CDN asset (`lovable-assets create`).

## Omezení, o kterých musíš vědět

Nemám v tomto sandboxu Windows prostředí ani code-signing certifikát, takže **finální podpis .exe** nemůžu udělat — vlastní installer bude fungovat, ale Windows SmartScreen se stejně zeptá "Přesto spustit", stejně jako u dnešního NSIS. To vyřeší jen zakoupený EV cert.

Cross-build vlastního instaláteru pro Windows z Linuxu **je možný** přes `@electron/packager --platform=win32`, ale výsledné self-extracting `.exe` vyrobíme pomocí `7z` archivu + Node stub loaderu, ne přes SFX modul 7-Zipu (ten potřebuje Windows). To znamená: první spuštění stáhne Electron runtime (~80 MB) do temp a rozbalí payload — instalátor bude cca **90–100 MB** místo dnešních 85 MB.

## Technická sekce

- `installer/main.cjs`: `BrowserWindow({ frame: false, transparent: true, width: 720, height: 480 })`, custom drag region.
- Rozbalení payloadu: `node-7z` + přiložený `7za` (Linux/Windows) v `resources/`.
- Registry zápis: `winreg` npm balíček (čistý Node, žádný `reg.exe`).
- Shortcuts: `windows-shortcuts` npm (LNK přes ffi, žádný `powershell.exe`).
- Detached final launch: `spawn(exePath, [], { detached: true, windowsHide: true, stdio: 'ignore' }).unref()`.
- Beta channel guard: fetch `https://studiovoxario.com/rest/v1/rpc/redeem_download_code` s anon key + zadaný kód, uložit token do `channel.json`.
- Vite `DownloadDesktop.tsx` použije shadcn `Tabs` a stávající `winInstaller/winAsset/linuxAsset` pointery + přidá `betaInstaller` asset až po nahrání.

## Co udělám v této iteraci

1. Vytvořím kompletní zdroj `installer/` (Electron app + UI + build skript).
2. Rozšířím `electron/main.cjs`, `updater.cjs`, `launcher.html`, `preload.cjs` o volbu kanálu.
3. Přepíšu `DownloadDesktop.tsx` s Tabs Stable/Beta.
4. Připravím build skript `installer/build.cjs`, který zabalí payload z `electron-release/StudioVoxario-win32-x64` do `installer/resources/app.7z`.

## Co **neudělám** (potřebuje tvůj krok)

- Nemůžu v sandboxu spustit finální Windows build a nahrát nový `.exe` jako CDN asset (chybí Windows prostředí pro test SFX + registry). Pošlu ti přesný příkaz, který spustíš lokálně / v CI:
  ```
  cd installer && npm i && node build.cjs
  ```
  a výstup `StudioVoxarioSetup-0.0.9-alpha.exe` mi pak předáš / nahraješ. Potom updatnu `desktop-version.json`, `latest.yml`, `beta.yml` a stránku ke stažení.

Potvrdíš plán, nebo chceš něco upravit (jiné kroky instalátoru, jiné omezení SmartScreen, jiný design instalátoru)?
