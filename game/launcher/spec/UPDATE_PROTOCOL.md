# Game update protocol v0.1

## Goal

The launcher downloads game files from dedicated game releases during early development and verifies every payload before installation.

## Release discovery

Early development source:
- GitHub repository: `Sokolcz97-rgb/Voxar.app`
- tag namespace: `game-v*`

The launcher must not use the repository's generic `releases/latest` endpoint because Voxar.app and the game share one repository.

It must resolve the newest compatible release in the game namespace/channel instead.

## Signed manifest concept

A future game release should attach a manifest such as:

```json
{
  "schema": 1,
  "product": "game",
  "channel": "alpha",
  "version": "0.1.0-alpha",
  "tag": "game-v0.1.0-alpha",
  "protocol": 1,
  "files": [
    {
      "path": "Game.exe",
      "size": 12345678,
      "sha256": "..."
    }
  ]
}
```

Production manifests should be cryptographically signed by the release pipeline.

## Update lifecycle

1. Fetch release metadata.
2. Validate product/channel/version.
3. Fetch manifest.
4. Verify manifest signature.
5. Compare installed manifest.
6. Download missing/changed payload to staging.
7. Verify file sizes and SHA-256 hashes.
8. Stop running game processes only when required.
9. Atomically replace staged files.
10. Write installed manifest.
11. Launch health check.
12. Keep rollback metadata for the previous known-good build.

## Repair

Repair performs the same manifest verification without assuming the current installation is valid.

Unknown/untracked user files must not be deleted unless they are inside a launcher-owned disposable directory.

## Failure behavior

If verification fails:
- do not launch the new build
- preserve the previous known-good build when possible
- expose a diagnostic code
- allow retry or repair

## No installer yet

Foundation v0.1 defines the update contract only. No `GameSetup.exe` is generated or published.
