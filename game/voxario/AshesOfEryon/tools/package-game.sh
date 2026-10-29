#!/usr/bin/env bash
# Složí hotovou hru z VoxarioPlayeru a Assets projektu – totéž, co dělá
# `VoxarioEditor --build-game` (GameExport.cpp), ale bez editoru a jeho licence (CI).
#
#   tools/package-game.sh <složka enginu s VoxarioPlayer(.exe)> <výstup> [verze]
#
# Výstup: AshesOfEryon(.exe), runtime knihovny vedle něj (DLSS, DLL z enginu),
# GameData/ (Assets projektu bez Library) a game.vgame. Assety z Unity verze se
# nejdřív zkopírují přes tools/sync-assets.sh.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
engine="${1:?složka enginu}"
out="${2:?výstupní složka}"
version="${3:-dev}"

player="$(find "$engine" -maxdepth 3 -type f \( -name VoxarioPlayer.exe -o -name VoxarioPlayer \) | head -n 1)"
if [ -z "$player" ]; then
  echo "VoxarioPlayer nebyl ve složce $engine nalezen" >&2
  exit 1
fi
bin="$(dirname "$player")"
case "$player" in *.exe) exe="AshesOfEryon.exe" ;; *) exe="AshesOfEryon" ;; esac

[ -f "$here/Assets/Data/content.json" ] || "$here/tools/sync-assets.sh"

rm -rf "$out"
mkdir -p "$out"
cp "$player" "$out/$exe"
chmod +x "$out/$exe"
# runtime knihovny ležící vedle přehrávače (DLSS, případně DLL překladače)
find "$bin" -maxdepth 1 -type f \( -name "*.dll" -o -name "libnvidia-ngx-dlss.so*" \) -exec cp {} "$out/" \;
# licence třetích stran
[ -d "$bin/licenses" ] && cp -r "$bin/licenses" "$out/licenses"
[ -d "$bin/../share/voxario-studio/licenses" ] && cp -r "$bin/../share/voxario-studio/licenses" "$out/licenses"

cp -r "$here/Assets" "$out/GameData"
cat > "$out/game.vgame" <<EOF
{
  "Name": "Ashes of Eryon",
  "StartupScene": "Scenes/Main.vscene",
  "Gravity": [0.0, -9.81, 0.0],
  "EnableDLSS": true,
  "Version": "$version"
}
EOF
echo "Hra složena do $out ($exe, verze $version, $(du -sh "$out" | cut -f1))"
