# Ashes of Eryon Installer Visual Reference v0.1

Status: **APPROVED**

The approved installer concept is the visual and UX target for the first Ashes of Eryon `GameSetup.exe`.

## Approved flow

1. Vítejte
2. Komponenty
3. Cíl instalace
4. Možnosti
5. Instalace
6. Dokončení

## Approved visual direction

- dark cinematic fantasy
- Ashes of Eryon logo prominently visible
- black / charcoal base
- aged-gold borders and controls
- ember/fire accents
- ruined Kalidran environments
- no visible standard NSIS wizard
- custom frameless window
- StudioVoxario branding remains secondary to the game
- progress and status are always readable
- actions use clear Czech labels
- installer should feel like part of the game rather than a generic setup tool

## UX rules

- no hidden surprise components
- desktop shortcut is optional
- Start menu shortcut is optional
- install path is user-selectable
- required/free disk space is visible before install
- progress shows phase, bytes/progress and meaningful status
- completion screen can offer launch game / open folder
- user data is not silently deleted on uninstall
- no forced Windows startup
- no plaintext credentials
- no game login inside setup

## Technical direction

The installer is a custom bootstrapper, not a traditional visible NSIS wizard.

Target architecture:

```
GameSetup.exe
  -> custom Ashes of Eryon bootstrap UI
  -> installs launcher runtime
  -> registers uninstall entry
  -> creates selected shortcuts
  -> launches Ashes of Eryon Launcher
  -> launcher later downloads/repairs the actual game
```

Initial installer builds may bundle the launcher runtime but must not bundle a fake game payload just to make the installer appear complete.

## Reference-first implementation requirement

Before calling the installer visually complete:

1. render every approved installer step
2. capture screenshots at the frozen reference size
3. compare against the approved reference
4. fix unintended differences
5. document only intentional deviations

Codex or any other implementation agent must not redesign the approved flow.

## Future Voxar.app installer rule

The **same process is mandatory for the future Voxar.app installer redesign**.

For Voxar.app installer work:

1. freeze the installer step flow and states
2. create and approve a dedicated Voxar.app visual reference
3. implement the installer without improvisational redesign
4. create screenshot comparisons for every important step
5. iterate until remaining differences are intentional and documented

Do not simply reuse the current Voxar.app installer UI because it exists. Its functionality may be reused where technically sound, but its future visual implementation must go through the same approved-reference workflow used for Ashes of Eryon.
