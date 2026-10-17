# Voxar.app – brand podklady

Schválené podklady od StudioVoxario (říjen 2026).

| Soubor | Co to je | Kde se používá |
| --- | --- | --- |
| `voxar-app-reference-v1.webp` | Kompletní vizuální předloha „Aplikace a změny“ (1672×941). Nahrazuje dřívější poškozený `installer/ui/assets/voxario-hud-reference.png`. | Reference pro instalátor a další UI. Výřez krajiny s portálem → `installer/ui/assets/voxar-landscape.webp`. |
| `voxar-logo-transparent.png` | Logo V bez pozadí (1254×1254, průhledné). | Zdroj pro `installer/ui/assets/voxar-logo*.{webp,png}` a `installer/assets/icon.ico`. |
| `voxar-logo-background.webp` | Logo V se zářícím tmavě modrým pozadím. | Sociální sítě, náhledy, obal. |

## Vizuální pravidla z předlohy

- Tmavý vesmír, azurová `#3fe0ff` → modrá `#4a7dff` → fialová `#a45aff`.
- Wordmark: prostrkané **VOXAR** (azurová) + **.APP** (bílá), pod ním **STUDIOVOXARIO**.
- HUD prvky: tenké linky s diagonálními zlomy, v rozích, nikdy přes text.
- Logo vždy se září na tmavém podkladu.

Nové logo používají: ikona aplikace (`electron/assets/icon.ico`, `icon.png`,
`tray.png` – exe, okna, zástupci, tray, VoxarioProtect), ikona instalátoru
(`installer/assets/icon.ico`) a ikona staženého Setupu (7-Zip SFX, viz
`scripts/brand-sfx.cjs`).
