# Custom game installer contract

The future game installer is a bootstrap experience, not a traditional multi-page Windows installer wizard.

## First-install responsibilities

- detect supported Windows version
- detect free disk space
- select install location
- create launcher directories
- install the launcher runtime
- download the selected game channel
- verify all downloaded content
- create requested shortcuts
- register uninstall metadata
- launch the installed launcher

## UX requirements

- custom branded window
- no visible NSIS wizard
- no hidden surprise components
- clear disk-space/download information
- progress survives recoverable interruptions where practical
- no forced desktop shortcut
- no forced Windows startup
- accessibility: keyboard navigation, readable contrast and scalable text

## Uninstall

The uninstaller must distinguish:
- launcher/game binaries
- caches
- downloaded update staging
- user settings
- screenshots/saves where applicable

User data must not be silently deleted by default.

## Bootstrap vs launcher

The bootstrap executable should stay small.

```
GameSetup.exe
   -> installs/starts Launcher
   -> Launcher downloads Game
   -> Launcher verifies Game
```

The setup does not embed the entire game unless an offline installer is intentionally produced later.
