# StudioVoxario desktop — auto-update (electron-builder + electron-updater)

## Kanonická verze

`electron/package.json` → `version`. Nic jiného. Root `package.json` verze se
pro desktop **nepoužívá**. `app.getVersion()` v runtime = tato hodnota.

## Build a feed

- Balíček: `electron-builder --win nsis --x64` (config je v `electron/package.json` → `build`).
- Výstup: `electron/release/`
  - `StudioVoxarioSetup-<version>.exe` (NSIS)
  - `latest.yml` (stable feed) / `beta.yml` (prerelease verze `x.y.z-beta.n`)
  - `StudioVoxarioSetup-<version>.exe.blockmap` (pokud jej builder vygeneruje)
- Publish: `provider: github`, `Sokolcz97-rgb/Voxar.app`, tag `v<version>`.
- `electron-updater` čte `app-update.yml` zabalený do balíčku — žádné ruční `setFeedURL`
  v produkci. Override jen přes `STUDIOVOXARIO_UPDATE_FEED` (testovací generic feed).
- `public/desktop-version.json` je pouze informativní metadata pro webovou download stránku.

## Reprodukovatelný test 0.0.14 → 0.0.15

1. `git checkout` commitu s `electron/package.json` = `0.0.14`.
2. `npm run desktop:prepare && npm --prefix electron install && npm --prefix electron run dist:win`
3. Nainstaluj `electron/release/StudioVoxarioSetup-0.0.14.exe` (per-user, `%LOCALAPPDATA%\Programs\voxar-app-desktop`).
4. Spusť appku, v nastavení ověř verzi `0.0.14`.
5. Bumpni: `npm --prefix electron version patch --no-git-tag-version` → `0.0.15`, commit, push do `main`
   (workflow publikuje release `v0.0.15` s `latest.yml`), nebo lokálně:
   `npm --prefix electron run dist:win` a soubory z `electron/release/` naservíruj přes
   `npx serve electron/release` a spusť app s `STUDIOVOXARIO_UPDATE_FEED=http://localhost:3000/`.
6. Ověř `node scripts/verify-release-artifacts.cjs 0.0.15` — musí projít (exe + latest.yml + shoda sha512).
7. Spusť nainstalovanou 0.0.14. Očekávaný sled v `%APPDATA%\voxar-app-desktop\logs` / launcher logu:
   `checking-for-update` → `update-available` → `download-progress` → `update-downloaded`
   → `quitAndInstall(true, true)` → app se sama restartuje.
8. Po restartu ověř verzi (`app:version` v nastavení) = `0.0.15`.
9. Ověř, že zůstala uživatelská data: `%APPDATA%\voxar-app-desktop\settings.json`, `bookmarks.json`,
   cookies/profil v partition `persist:voxario` (NSIS `deleteAppDataOnUninstall: false`).

VoxarioBrowser se distribuuje ve stejném balíčku, takže se aktualizuje současně
(`runBrowserAutoUpdate` v `electron/main.cjs` volá stejný updater).

## Starý custom instalátor

`installer/` (HUD Electron instalátor + 7-Zip SFX) zůstává jen pro **první instalaci
z webu / offline distribuci a výběr modulů**. Do auto-update cesty nezasahuje.
`electron/installer.nsi` s natvrdo zadanou verzí byl odstraněn — NSIS generuje electron-builder.
