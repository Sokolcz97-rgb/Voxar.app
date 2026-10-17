# Game Launcher Design Spec v0.1

Status: APPROVED BASE LAYOUT

Reference viewport: 1920x1080 at device scale factor 1.

This specification freezes the first visual/layout contract for the game launcher. Implementation must follow this document and `layout-v0.1.json`. Codex must not reinterpret or redesign the layout without an explicit spec revision.

## Visual direction

- dark cinematic fantasy
- premium, restrained, readable
- charcoal / near-black / deep blue foundation
- warm metallic gold accents
- subtle fog, embers, runic details and depth
- realistic fantasy hero artwork
- modern launcher UX rather than medieval parchment UI
- no sci-fi Voxario HUD styling
- no excessive ornamentation

## Canvas

- width: 1920 px
- height: 1080 px
- minimum design reference only; production implementation may scale responsively
- all screenshot regression tests use exactly 1920x1080

## Global safe area

- left: 48 px
- right: 48 px
- top: 24 px
- bottom: 24 px

## Top bar

Position:
- x: 48
- y: 24
- width: 1824
- height: 72

Contents:
- game logo + game name on the left
- Home / News / Settings / Support navigation
- account/avatar/status on the right

Rules:
- navigation is compact and never visually competes with primary CTA
- account state must remain readable at a glance
- server status indicator is visible but subtle

## Hero panel

Position:
- x: 48
- y: 112
- width: 1824
- height: 548

Purpose:
- primary visual identity
- current world/event artwork
- title / subtitle / short context
- primary CTA

Artwork rules:
- image fills the full hero panel
- readable text area is protected with gradient/overlay
- no text baked into artwork
- artwork can change by event/update without moving UI components

Content anchor:
- headline block starts at x: 112, y: 330
- max text width: 680 px

Primary CTA:
- x: 1460
- y: 550
- width: 320
- height: 72
- minimum hit target: 44 px
- one primary CTA only

Allowed CTA labels by state:
- Přihlásit se
- Instalovat
- Pokračovat
- Aktualizovat
- Hrát
- Opravit
- Zkusit znovu

## Lower information row

Position:
- x: 48
- y: 680
- width: 1824
- height: 280
- gap: 24

### News panel

- x: 48
- y: 680
- width: 1160
- height: 280

Contents:
- latest patch/update
- world event
- maintenance/service message
- up to 3 visible items in v0.1

### Game status panel

- x: 1232
- y: 680
- width: 640
- height: 280

Contents:
- channel
- installed version
- available version
- install path
- required/free disk
- server status
- account status

## Bottom progress strip

Position:
- x: 48
- y: 980
- width: 1824
- height: 76

Visible during:
- install
- update
- verification
- repair
- recoverable error

Contents:
- current phase
- current package/file
- byte progress
- speed when meaningful
- progress percentage
- pause/cancel only when safe

When idle, the strip collapses to a compact status line.

## Typography hierarchy

Temporary typography tokens until final font selection:

- display-title: 54 px / 1.0 / semibold
- hero-subtitle: 20 px / 1.4 / regular
- navigation: 15 px / 1 / medium
- panel-title: 18 px / 1.2 / semibold
- body: 15 px / 1.5 / regular
- meta: 13 px / 1.4 / regular
- primary-cta: 20 px / 1 / semibold

Final font family must be licensed for redistribution.

## Shape/effect direction

- panels: 14 px corner radius
- primary CTA: 12 px corner radius
- subtle 1 px borders
- restrained blur only where it preserves readability
- no neon glow
- no giant drop shadows
- selected/active state uses gold accent sparingly

## Initial frozen states

### 1. Signed out

Hero:
- cinematic world artwork
- game title
- short intro
- primary CTA: `Přihlásit se`

Secondary:
- `Vytvořit účet` opens website registration
- launcher does not show email/password fields

Account area:
- generic avatar
- `Nepřihlášen`

Status panel:
- account: not signed in
- install state may still be shown
- server state may be shown

### 2. Ready to install

Hero:
- primary CTA: `Instalovat`
- installed state: false

Status panel:
- channel: alpha
- target version
- target install path
- required disk
- free disk
- server status
- signed-in account

When Install is pressed:
- transition into install state
- bottom progress strip expands
- primary CTA changes according to safe available actions

### 3. Ready to play

Hero:
- primary CTA: `Hrát`

Top-right account:
- avatar
- display name
- online state

Status panel:
- installed version
- latest compatible version
- channel
- server status
- installation path

If update is mandatory:
- primary CTA becomes `Aktualizovat`
- Play is not presented as the main enabled action

## Interaction states required for every interactive component

- default
- hover
- pressed
- keyboard focus
- disabled
- loading where applicable

## Visual regression requirement

Implementation is not considered complete from manual inspection alone.

Required reference comparison:
1. Render launcher at 1920x1080.
2. Capture screenshot for each frozen state.
3. Compare against approved reference image.
4. Review layout/font/asset differences.
5. Iterate until remaining differences are intentionally documented.

Codex must not claim visual completion without producing the comparison screenshots.

## Non-goals for v0.1 design lock

Not frozen yet:
- final game name
- final logo
- final font family
- final hero artwork
- animated background treatment
- exact news content
- final character art

These may change without changing the approved layout geometry.

## Brand identity

Working title: **ASHES OF ERYON**

Working tagline: **Every choice leaves a scar.**

Formal legal/name clearance remains pending before commercial release.
