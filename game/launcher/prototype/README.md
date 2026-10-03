# Launcher visual prototype v0.1

This prototype exists to make the approved launcher geometry testable before a production launcher runtime is selected.

## Purpose

- render the approved 1920x1080 layout
- exercise the three frozen states
- provide a stable target for reference screenshots
- prevent later implementation from guessing layout

## Run locally

Open `index.html` in a browser.

The small prototype controls at the bottom switch between:

- Signed out
- Ready to install
- Ready to play

## Important

This is not the shipping launcher.

It intentionally contains:
- placeholder name/logo
- CSS-only placeholder hero artwork
- no real authentication
- no real downloader
- no updater
- no installer
- no game executable

Those systems will be attached only after visual approval.

The production implementation must continue to follow:
- `../design/LAUNCHER_DESIGN_SPEC_V0.1.md`
- `../design/layout-v0.1.json`
