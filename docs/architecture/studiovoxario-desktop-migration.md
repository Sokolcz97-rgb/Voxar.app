# StudioVoxario Desktop Platform — audit a migrační plán

> Stav auditu: 8. září 2026. Tento dokument je návrh pro větev `codex/studiovoxario-desktop-foundation`; nemění chování produkční aplikace.

## Shrnutí

Voxar.app už má použitelný desktopový základ. Není správné jej přepisovat od nuly ani slučovat VoxarioBrowser do React aplikace. Cílový stav má být **StudioVoxario Hub**: samostatná hostitelská Windows aplikace s jasně oddělenými produkty:

- **Voxar.app** — hlavní komunitní a produkční aplikace;
- **VoxarioBrowser** — samostatný prohlížeč se svým profilem, nastavením a životním cyklem;
- budoucí StudioVoxario produkty — samostatné moduly/aplikace, registrované v Hubu.

Hub je launcher a správce instalovaných produktů, nikoliv další webová routa. Sdílet může pouze designové tokeny, launcher contract a aktualizační infrastrukturu; produkty nesmí sdílet jeden Electron runtime ani přepínač `--browser`.

## Co lze zachovat

| Oblast | Stav | Rozhodnutí |
|---|---|---|
| React/Vite UI | Rozsáhlá aplikace s routami, Supabase, React Query, i18n, komunitou, chatem, LiveKit voice a RTMP UI | Zachovat; desktopovou integraci přidávat přes bezpečné IPC adaptéry |
| Desktop renderer fallback | Vite má relativní `base: "./"`; Electron umí fallback z online UI na `electron/dist` | Zachovat a testovat; z online UI nesmí být jediná dostupná varianta |
| Windows lifecycle | Single-instance lock, tray, obnovování minimalizovaného okna a kontrola neviditelných bounds přes `screen.getAllDisplays()` již existují | Zachovat, rozšířit o persistenci window state, display/DPI sanitizaci a explicitní fullscreen contract |
| Bezpečnost Electronu | `contextIsolation`, `sandbox`, vypnutý Node integration, CSP/externí odkazy a anti-debug ochrany jsou v základu | Zachovat; snížit `webviewTag` na browser-only proces a zpřesnit IPC validaci |
| VoxarioBrowser | Existuje nativní browser shell, bookmarks, pinning a browser settings | Zachovat jako separátní app shell, ne jako volbu ve stejném executable |
| Aktualizace | `electron-updater`, GitHub publish, health/rollback logika a ověřovací skript feedu existují | Zachovat jako základ; odstranit paralelní instalační autoritu |
| RTMP | Hlavní proces drží bundlovaný FFmpeg a před update ukončuje child procesy | Zachovat; přidat integrační test ukončení před restartem |
| Vlastní installer UI | Existuje stylový Electron HUD s výběrem adresáře, komponent, kanálu a uninstall UI | Zachovat vizuální návrh, ale nahradit jeho roli ručního instalátoru standardizovaným balíčkem |
| GitHub Releases | Release obsahuje `latest.yml`, technický update NSIS EXE a versionovaný i stabilní Setup EXE | Zachovat jeden release jako kanonický zdroj artefaktů |

## Rizika a technický dluh

1. **Dvě autority pro instalaci.** Vlastní Electron installer archiv ručně rozbaluje stejný payload, zapisuje vlastní uninstall registry a kopíruje samostatný uninstaller runtime; NSIS/electron-builder zároveň provádí aktualizace. `installer.nsh` pak musí obcházet uninstaller a migrovat registry i `modules.json`. To je zdroj křehkých upgrade a repair scénářů.

2. **„Samostatný“ browser není skutečně samostatný produkt.** Browser je součástí stejného app bundle a aktivuje se přes `modules.json` nebo `--browser`. Sdílí tak binárku, data i release cadence s Hubem. Pro budoucí produkty je tento model neškálovatelný.

3. **Vzdálené UI v hlavním okně.** `main.cjs` preferuje živou `https://studiovoxario.com/app` a až pak lokální renderer. To urychluje webové změny, ale desktopový produkt se tím může chovat jinak než testovaný release a působit jako web v okně. Pro native funkce je nutný stabilní lokální shell a explicitní kompatibilitní rozhraní.

4. **UI styl je aplikován velkým množstvím pořadově závislých CSS hotfixů.** `src/main.tsx` importuje dlouhou řadu `community-reference-*.css` souborů. Ztěžuje to konzistenci, výkon při vývoji i bezpečný redesign.

5. **Build systém míchá npm a Bun lockfiles.** Přítomnost `package-lock.json`, `bun.lock` a `bun.lockb` umožňuje nechtěné rozdíly závislostí. CI používá `npm ci || npm install`, což skrývá chyby lockfile místo deterministického selhání.

6. **CI mění `main` během release.** Workflow bumpuje verzi a po buildu do `main` zapisuje metadata. Jeho rebase/retry logika je opatrná, ale release není reprodukovatelný z jednoho neměnného commitu a CI má zbytečně široké oprávnění `contents: write`.

7. **Aktualizace nejsou diferenciální.** `differentialPackage: false`; každý update stahuje celý zhruba 94 MB technický paket. Viditelný custom setup má přibližně 266 MB. Uživatel sice nemusí setup stahovat znovu, ale síťová cena update je zbytečně vysoká.

8. **Chybí automatizované desktop E2E pokrytí.** Vitest pokrývá webový renderer, ale ne contract hlavního procesu: lifecycle okna, IPC, first-run, tray, update/rollback a installer upgrade.

9. **Branding a metadata nejsou jednotné.** Vyskytují se názvy `Voxar.app`, `StudioVoxario`, `StudioVoxario Installer`, `StudioVoxarioUpdate` a historické registry klíče. Uživatel Windows by měl potkat stabilní produktové názvy a GUID/identity.

10. **Chybí code-signing.** Vlastní installer výslovně uvádí nepodepsaný stav. Bez EV/OV code-signingu a timestampingu nelze dosáhnout důvěryhodného Windows 11 instalačního toku; technické úpravy SmartScreen nenahradí podpis.

## Cílová architektura

```
StudioVoxario Hub (samostatný Windows produkt)
  ├─ Native shell: lifecycle, title bar, tray, window state, DPI/display restore
  ├─ Local launcher renderer: katalog produktů, instalace, aktualizace, diagnostika
  ├─ Product registry: %LOCALAPPDATA%/StudioVoxario/products.json
  ├─ Update coordinator: GitHub Releases + signed manifest + per-product feeds
  └─ IPC contract (schema-validovaný, versionovaný)
       ├─ Voxar.app (samostatný package)
       │    └─ komunitní React renderer + voice/chat/RTMP/background removal
       └─ VoxarioBrowser (samostatný package)
            └─ vlastní Chromium browser shell, profil a update kanál
```

### Windows contract pro každý desktop produkt

- vlastní stabilní `appId`, `productName`, ikona (`.ico` multi-resolution 16–256 px), AUMID a uninstall identity;
- frame ponechat jako nativní Windows 11 title bar v první etapě; případný custom title bar až po testu Snap Layouts, system menu, keyboard resize a accessibility;
- minimální/maximální rozměry, persistence normal/maximized/fullscreen state a bounds;
- při startu validovat bounds proti `screen.getAllDisplays()`, použít work area a obnovit okno na dostupný monitor;
- nastavit `app.commandLine.appendSwitch("high-dpi-support", "1")` a `force-device-scale-factor` nepoužívat; testovat 100/125/150/200 % a mixed-DPI monitory;
- animovat jen `opacity`/`transform`, respektovat `prefers-reduced-motion`, nepoužívat nekonečné filtry/blur na velkých plochách;
- interní stránka musí být lokální a versionovaná; webové moduly se otevírají pouze explicitně a nepřepisují desktopovou navigaci.

### Balíčkování a update

Doporučený cílový model je **MSIX + App Installer** pro čisté Windows 11 instalace, pokud nevyžadujete per-user instalaci mimo Windows App Installer; jinak zachovat **electron-builder NSIS per-user** jako přechodový kanál. Nemíchat oba modely v jednom release.

- Krátkodobě: jeden NSIS installer jako první instalace i oprava/upgrade. Přenést současný HUD vzhled do NSIS UI nebo jej používat jen jako launcher před standardním setupem, nikoliv jako druhý instalátor. Zapnout blockmap/differential update po ověření čistého upgrade.
- Střednědobě: pro Hub i Browser vytvořit vlastní produkty, vlastní `appId`, data adresáře, release tag/asset a update feed. Hub registruje stav instalace Browseru; Browser ale vlastní binárku nestahuje ani nerozbaluje Hub.
- Dlouhodobě: MSIX/App Installer s HTTPS update feedem a code signingem. GitHub Releases může zůstat zdroj binárek, ale manifest má být pod doménou StudioVoxario a podepsaný/reprodukovatelný.
- Vždy: podpis artefaktů, timestamp, SBOM, SHA-256 v release notes, virus scan a release provenance.

## Migrační etapy

### 0 — Baseline a ochrany (bez změny funkcí)

- deterministický package manager (vybrat npm; odstranit Bun lockfiles až po reprodukci);
- CI split: `quality` (lint/typecheck/test/build) bez zápisu a `release` vyvolaný tagem;
- zaznamenat matrix Windows 11 / DPI / 1–2 monitory / upgrade / uninstall;
- přidat testovatelné moduly pro window state a product registry.

**Kontrola:** `npm ci`, `npm run lint`, `npm test`, `npm run build`, `npm run desktop:prepare`.

### 1 — Hub foundation (neinvazivní)

- lokální launcher renderer a schema-validovaný `desktop:* ` IPC contract;
- `window-state` service: debounce zápisu bounds, maximized/fullscreen flags, clamping na aktivní work area;
- sjednotit title/brand/icon metadata a přidat Windows smoke test;
- bez změny rout komunitní aplikace a bez přesunu Browseru.

**Kontrola:** unit test service + desktop packaging smoke test na Windows.

### 2 — Oddělení VoxarioBrowseru

- nové `apps/voxario-browser` nebo samostatný repozitář, vlastní `appId`, data a updater;
- Hub product registry obsahuje discovery, launch a stav Browseru;
- jednorázový migrační adaptér čte staré `modules.json`, vytvoří registry entry a pak jej již nezapisuje;
- zachovat bookmarks/pinning/settings přes explicitní migration.

**Kontrola:** fresh install, upgrade z 0.0.38, uninstall Browseru při zachování Hubu a opačně.

### 3 — Installer a opravy/upgrady

- zrušit ruční rozbalování `app.7z` jako produkční instalační autoritu až po úspěšném migračním testu;
- čistý NSIS/MSIX upgrade/repair/uninstall, bez mazání uživatelských dat ve výchozím nastavení;
- custom StudioVoxario design, volba cesty jen tam, kde ji daný installer model podporuje; transparentně ukázat komponenty;
- release assets: `StudioVoxarioHubSetup`, `VoxarioBrowserSetup`, per-product feed.

**Kontrola:** clean install, repair, downgrade refusal, upgrade, interrupted update, uninstall, invalid path a locked-file scénáře.

### 4 — UI konsolidace a výkon

- z CSS hotfixů vytvořit design tokeny, vrstvy reset/foundations/components/features;
- postupně přesunout komunity/chat/voice do design-system komponent bez změny business logiky;
- profiler a accessibility audit (keyboard, focus, contrast, screen reader);
- feature flags pro návrat k původním panelům v případě regresí.

### 5 — Release hardening

- signed builds, timestamp, SBOM, changelog generovaný z tagu;
- GitHub Actions používá immutable tag/commit, cache a artifact retention;
- update rollout rings (internal/beta/stable), rollback telemetry opt-in a staged rollout.

## První implementační rozhodnutí

První kódová etapa má být pouze **0 + začátek 1**: testovatelná služba persistence a sanitizace stavu hlavního okna, bezpečně zapojená do existujícího `electron/main.cjs`. Nezmění webové routy, LiveKit, RTMP, Supabase ani současný installer. Browser zůstane beze změny, dokud nebude hotová kompatibilní migrační cesta.
