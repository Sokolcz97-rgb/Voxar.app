#!/usr/bin/env bash
# Zkopíruje sdílené assety z Unity verze hry (modely postav, zvířat a budov, písma, obrázky UI,
# content.json) do Assets/ projektu Voxario. Kopie nejsou v gitu (.gitignore) – zdroj je jeden.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
unity="$here/../../unity/AshesOfEryon/Assets"
mkdir -p "$here/Assets/Models" "$here/Assets/UI" "$here/Assets/Data"
for d in heroes animals buildings; do
  rm -rf "$here/Assets/Models/$d"
  cp -r "$unity/Models/$d" "$here/Assets/Models/$d"
done
cp "$unity/Voxario/Resources/UI/"*.{ttf,png,jpg} "$here/Assets/UI/"
cp "$unity/Voxario/Resources/content.json" "$here/Assets/Data/content.json"
echo "Assets synced from $unity"
