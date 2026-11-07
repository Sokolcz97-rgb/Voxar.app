#!/usr/bin/env bash
# Textury Eryndoru z listu přírodních textur (tools/textures/prirodni_textury.jpg, 4 x 4 dlaždice)
#   tools/eryndor_textures.sh <složka enginu s VoxarioTextureTool>
# Výstup: Assets/Textures/terrain/*.jpg (povrchy terénu, 1024 px) a Assets/Textures/nature/*.jpg (stromy,
# kameny – vkládají se do modelů z tools/eryndor_nature.py, 512 px). Každá je navazující dlaždice.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
engine="${1:?cesta ke složce enginu (build/release/bin)}"
tool="$(find "$engine" -maxdepth 3 -type f \( -name VoxarioTextureTool -o -name VoxarioTextureTool.exe \) | head -n 1)"
[ -n "$tool" ] || { echo "VoxarioTextureTool nebyl ve složce $engine nalezen" >&2; exit 1; }
sheet="$here/textures/prirodni_textury.jpg"
terrain="$here/../Assets/Textures/terrain"
nature="$here/../Assets/Textures/nature"
mkdir -p "$terrain" "$nature"

# dlaždice v listu: sloupce x = 26, 393, 761, 1129; řádky y = 191, 636, 1083, 1529; 338 x 332 px
#   řádek 1: kůra, listí, tráva, voda     řádek 3: láva, blesk, skála, sníh a led
#   řádek 2: mrak, slunce, úplněk, oheň   řádek 4: písek, vítr, krystaly, země / hlína
tile() {   # sloupec řádek výstup velikost [další volby]
    local xs=(26 393 761 1129) ys=(191 636 1083 1529)
    local c=$1 r=$2 out=$3 size=$4
    shift 4
    "$tool" "$sheet" "$out" --crop "${xs[$c]},${ys[$r]},338,332" --size "$size" --flatten 0.6 --tile 0.5 "$@"
}

# terén (vrstvy world.terrain): louka, tyrkysový mech Sylvarie, hlína / popel Aethelgardu, skála
tile 2 0 "$terrain/trava.jpg" 1024
tile 2 0 "$terrain/mech.jpg" 1024 --hue -72 --saturation 0.9 --brightness 0.85
tile 3 3 "$terrain/zeme.jpg" 1024
tile 2 2 "$terrain/skala.jpg" 1024
tile 0 3 "$terrain/pisek.jpg" 1024
tile 3 2 "$terrain/snih_led.jpg" 1024
tile 0 2 "$terrain/lava.jpg" 1024
# Aethelgard: čedič a popel (Ignis Scar), ametystová půda (Crystalarium)
tile 2 2 "$terrain/cedic.jpg" 1024 --saturation 0.35 --brightness 0.85
tile 3 2 "$terrain/ametyst.jpg" 1024 --hue -75 --saturation 1.5 --brightness 0.5

# modely (stromy, smrky, kameny, obří strom Sylvarie)
tile 0 0 "$nature/kura.jpg" 512
tile 0 0 "$nature/kura_bila.jpg" 512 --saturation 0.25 --brightness 1.35
tile 1 0 "$nature/listi.jpg" 512
tile 1 0 "$nature/listi_sylvarie.jpg" 512 --hue -55 --saturation 0.95
tile 2 2 "$nature/skala.jpg" 512
echo "Hotovo: $terrain, $nature"
