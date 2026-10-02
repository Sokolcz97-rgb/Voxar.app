# Ashes of Eryon GameSetup

Custom Windows bootstrap installer for the Ashes of Eryon launcher.

## Approved flow

1. Vítejte
2. Komponenty
3. Cíl instalace
4. Možnosti
5. Instalace
6. Dokončení

The visual source of truth is:

`game/launcher/design/APPROVED_INSTALLER_REFERENCE_V0.1.md`

## What GameSetup v0.1 installs

GameSetup installs the **Ashes of Eryon Launcher runtime**.

It does not pretend to install unfinished game content. The future launcher will own:
- game download
- update
- repair
- game version/channel
- local Story Director packages

## Installer behavior

- user-scope installation
- no standard visible NSIS wizard
- selectable install directory
- optional desktop shortcut
- optional Start menu shortcut
- launcher payload extracted through staging
- existing launcher runtime is replaced safely
- uninstall entry stored under HKCU
- uninstaller preserves UserData / Saves / Screenshots by default
- no login or password collection

## Local development

Build the launcher first:

```bash
cd ../launcher/app
npm install
npm run pack:win
```

Then build the installer runtime:

```bash
cd ../../installer
npm install
npm run build
```

The packaged custom installer runtime is created under:

`game/installer/dist/AshesOfEryonInstaller-win32-x64/`

The CI pipeline later wraps this runtime into a single `GameSetup.exe` using a silent 7-Zip SFX bootstrap. Only the custom Ashes of Eryon UI is presented to the user.

## Release status

Foundation builds are verification-only.

No GameSetup.exe is uploaded to GitHub Releases until the release flow is explicitly approved.
