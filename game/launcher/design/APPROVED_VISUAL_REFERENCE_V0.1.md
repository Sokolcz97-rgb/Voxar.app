# Launcher Visual Reference v0.1

Status: **APPROVED**

The user approved the cinematic launcher mockup created for **Ashes of Eryon** as the visual target for the first production-quality launcher shell.

## Reference identity

- product: Ashes of Eryon
- state represented: Ready to Play
- target viewport: 1920x1080 reference geometry
- visual style: dark cinematic fantasy
- logo: approved Ashes of Eryon logo v0.1
- hero environment: ruined coastal Kalidran landscape with distant fortress/citadel
- primary accent: aged gold
- secondary accent: ember/fire
- background base: charcoal / deep blue-black

## Approved composition

### Header
- large Ashes of Eryon logo at top-left
- navigation: Domů / Novinky / Nastavení / Podpora
- server status near the right side
- player avatar + display name at far right
- compact native window controls

### Hero
- full cinematic environment artwork
- text block aligned left
- chapter label above title
- large tagline: **Every choice leaves a scar.**
- short narrative copy below
- large gold primary CTA aligned to lower-right
- secondary file verification action below CTA

### Information row
- left: three visual news cards
- right: game status panel
- thin old-gold borders and restrained ornamentation

### Footer
- green ready/healthy icon
- current launcher/game health text
- horizontal gold progress/health strip
- percentage at far right

## Visual rules

- do not redesign the information hierarchy
- do not replace the fantasy visual language with Voxario neon/sci-fi styling
- no generic launcher dashboard look
- hero art must remain the dominant visual element
- primary CTA must read as the most important interaction
- gold borders/effects remain restrained and premium
- green is reserved for healthy/online/ready status
- ember orange is decorative/environmental, not the default UI accent

## Implementation rule

The browser prototype is the implementation target for this reference.

Any future Codex task must:
1. read this file
2. read `LAUNCHER_DESIGN_SPEC_V0.1.md`
3. preserve the approved composition
4. avoid redesign
5. produce screenshot evidence at the reference viewport
6. document intentional deviations before merging

## Future reuse rule

This **reference-first workflow** is also the required process for future redesign work on:
- VoxarioBrowser
- Voxar.app / StudioVoxario communication client

For those products:
1. freeze layout and UI states
2. approve a visual reference
3. implement without improvisational redesign
4. compare screenshots against the approved reference
5. iterate until differences are intentional and documented


## Installer workflow reuse

The approved installer reference process is also mandatory for the future **Voxar.app installer** redesign. Functional code may be reused where safe, but its UI must first receive its own approved visual reference and then be implemented with screenshot comparison rather than freeform redesign.
