#!/usr/bin/env bash
# Hratelné rasy Eryndoru (podle „Rasy a tvorba postavy“) – modely z Meshy napasované na kostru postav.
#   tools/eryndor_races.sh <engine/bin>        (MESHY_API_KEY v prostředí)
# Kamenný obr a Kočičí lid jsou z obrázků dokumentace (tools/races/*.png, image-to-3d). Víla má tvar z textu
# (stojící postava v A-póze, obrázek sedí na houbě) a texturu podle obrázku. Člověk, Trpaslík a Elf jsou vlastní
# postavy z textu (obrázky v dokumentaci připomínají skutečné herce – do hry se jejich podoba nekopíruje).
# --rig-model: kostra a všech 76 animací lidských postav (boj, kouzla, chůze, emoce), --pose a-pose pro napasování.
set -euo pipefail
bin="$1"
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/../Assets/Models/races"
humans="$here/../Assets/Models/humans"
mkdir -p "$out"
gen() {   # gen <jméno> <kostra> <obrázek|-> [parametry…]
    local name="$1" rig="$2" img="$3"; shift 3
    "$bin/VoxarioImageTo3D" "$img" "$out/$name.glb" "$@" --backend meshy --pose a-pose \
        --rig-model "$humans/$rig.glb" --fit 1
}
gen obr   syl_knight_m "$here/races/obr.png"
gen kocka syl_knight_m "$here/races/kocka.png"
gen vila  syl_mage_f   "$here/races/vila.png" --prompt "Fantasy fairy woman, full body, standing upright, slender and delicate, large translucent iridescent butterfly wings on her back, pale lilac skin with glowing turquoise swirl markings, pointed ears, blonde hair in an updo with tiny flowers, short green leaf corset with pink and violet petal skirt, barefoot, stylized game character"
gen clovek syl_knight_m - --prompt "Original fantasy human adventurer, full body, standing, young man with short dark brown hair and stubble, padded leather jerkin over chainmail shirt, leather belt with pouches, bracers, sturdy boots, stylized hand-painted game character" --texture-prompt "stylized hand-painted fantasy game character, warm brown leather, steel chainmail, soft painted shading"
gen trpaslik syl_knight_m - --prompt "Original fantasy dwarf blacksmith, full body, standing, short and very stocky, broad shoulders, long black beard with two silver-ringed braids, bald head with tattoo, sleeveless wool tunic, thick leather apron, leather gauntlets, heavy iron-toed boots, stylized game character" --texture-prompt "stylized hand-painted fantasy game character, dark wool, worn leather apron, iron details"
gen elf syl_mage_f - --prompt "Original fantasy elf ranger woman, full body, standing, slender, long silver-white hair in a single braid, long pointed ears, fitted green and gold leaf-pattern leather armor, short hooded cloak, high boots, stylized game character" --texture-prompt "stylized hand-painted fantasy game character, forest green and gold leaf patterns, soft painted shading"
