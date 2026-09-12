# Voxar.app repository guardrails

Tento repozitář zůstává zatím jako monorepo, ale jednotlivé produkty mají jasné logické hranice:

- Web / stránka: `src/`, `public/`, `supabase/`
- Voxar.app desktop: `electron/main.cjs`, `electron/preload.cjs`, `electron/bootstrap*.cjs`
- VoxarioBrowser: `electron/browser*`
- VoxarioProtect: `electron/protect*`
- Installer / release: `installer/`, `scripts/`, `.github/workflows/`

## Doporučený GitHub Ruleset pro `main`

Nastav target branch `main` a zapni:

- Require a pull request before merging
- Require status checks to pass before merging
- Require code owner review
- Block force pushes
- Block deletions
- Require branch to be up to date before merging

Jako required checks použij kontroly z workflow `Validate pull request`, zejména web build a Windows desktop distribution.

## Důležitá výjimka pro současný release workflow

`release.yml` dnes při vydání zapisuje version bump a veřejná download metadata zpět do `main` pomocí `github-actions[bot]` bez force-push. Pokud zapneš pravidlo, které úplně zakáže přímé zápisy do `main`, musí mít pouze release automatizace výslovný bypass, jinak desktop release skončí chybou při pushi metadata/version commitu.

Nepřidávej bypass pro běžné uživatele, Codex, externí aplikace ani neurčité role. Pokud GitHub UI nenabídne bezpečný bypass pouze pro konkrétní release automatizaci, ponech Ruleset zatím bez zákazu tohoto botího zápisu a release workflow později převeď na PR-based release metadata.

## Secrets

Skutečné secrety nesmí být v repozitáři ani ve frontendových `VITE_*` proměnných. `.env` soubory jsou ignorované a PR validace odmítá trackovaný skutečný `.env` soubor. Serverové klíče patří pouze do GitHub Secrets / backendového secret storage.
