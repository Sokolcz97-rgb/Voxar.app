"""Frakční varianty postav KayKit Adventurers (CC0, Kay Lousberg) pro Eryndor.

  python3 tools/kaykit_variants.py   -> Assets/Models/heroes/*.glb

Postavy mají paletovou texturu (barevná pole). Varianta přebarví pole podle odstínu (HSV) na barvy
frakce z lore a volitelně přidá emisní mapu (žhnoucí praskliny, hvězdná záře). Kostra, 76 animací
a díly (helma, plášť, zbraně v handslot.l / .r) zůstávají – oblékání a výměna výbavy v enginu
(entity.show_part, entity.equip) funguje u všech variant stejně.
"""
import colorsys
import io
import json
import os
import struct

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "Assets", "Models", "kaykit", "chars")
OUT = os.path.join(HERE, "..", "Assets", "Models", "heroes")


def load_glb(path):
    d = open(path, "rb").read()
    jl = struct.unpack("<I", d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    bl = struct.unpack("<I", d[20 + jl:24 + jl])[0]
    return j, bytearray(d[28 + jl:28 + jl + bl])


def save_glb(path, j, bn):
    while len(bn) % 4:
        bn += b"\0"
    j["buffers"][0]["byteLength"] = len(bn)
    js = json.dumps(j, separators=(",", ":")).encode()
    while len(js) % 4:
        js += b" "
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bn)))
        f.write(struct.pack("<I4s", len(js), b"JSON"))
        f.write(js)
        f.write(struct.pack("<I4s", len(bn), b"BIN\0"))
        f.write(bn)


def add_image(j, bn, img, name):
    buf = io.BytesIO()
    img.save(buf, "PNG")
    data = buf.getvalue()
    while len(bn) % 4:
        bn += b"\0"
    j["bufferViews"].append({"buffer": 0, "byteOffset": len(bn), "byteLength": len(data)})
    bn += data
    j.setdefault("images", []).append({"bufferView": len(j["bufferViews"]) - 1, "mimeType": "image/png", "name": name})
    j.setdefault("textures", []).append({"source": len(j["images"]) - 1, "sampler": j["textures"][0].get("sampler", 0) if j.get("textures") else 0})
    return len(j["textures"]) - 1


def recolor(img, rules, value=1.0, sat=1.0):
    """rules: [(hue0, hue1, min_sat, (h, s_mul, v_mul) nebo rgb)] – hue ve stupních."""
    a = np.asarray(img.convert("RGB"), np.float32) / 255
    hsv = np.zeros_like(a)
    flat = a.reshape(-1, 3)
    H = np.array([colorsys.rgb_to_hsv(*p) for p in flat[::1]], np.float32)   # paleta je malá (1024²) – stačí
    h, s, v = H[:, 0] * 360, H[:, 1], H[:, 2]
    out = H.copy()
    for h0, h1, smin, tgt in rules:
        if h0 <= h1:
            m = (h >= h0) & (h <= h1) & (s >= smin)
        else:
            m = ((h >= h0) | (h <= h1)) & (s >= smin)
        if smin < 0:   # šedé / kovové (nízká sytost): -smin = horní mez sytosti
            m = (s <= -smin)
        th, sm, vm = tgt
        if th is not None:
            out[m, 0] = (th % 360) / 360
        out[m, 1] = np.clip(s[m] * sm, 0, 1)
        out[m, 2] = np.clip(v[m] * vm, 0, 1)
    out[:, 1] = np.clip(out[:, 1] * sat, 0, 1)
    out[:, 2] = np.clip(out[:, 2] * value, 0, 1)
    rgb = np.array([colorsys.hsv_to_rgb(*p) for p in out], np.float32)
    return Image.fromarray((rgb.reshape(a.shape) * 255).astype(np.uint8))


def skin_mask(img):
    """Pleť (broskvová) zůstává – maska pro výjimky."""
    a = np.asarray(img.convert("RGB"), np.float32) / 255
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 0.75) & (g > 0.55) & (g < 0.85) & (b > 0.45) & (b < 0.75)


VARIANTS = {
    # Sylvaria: bílá a tyrkysová, zlato; kov světlejší (stříbro)
    "sylvaria": dict(rules=[(330, 20, 0.35, (176, 0.9, 0.95)), (200, 300, 0.25, (178, 0.8, 1.05)), (90, 170, 0.3, (172, 1.0, 1.0)),
                            (0, 360, -0.12, (None, 1.0, 1.18))]),
    # Aethelgard: rudá a tmavá ocel, mosaz
    "aethel": dict(rules=[(200, 300, 0.2, (356, 1.1, 0.7)), (90, 170, 0.3, (8, 1.0, 0.65)), (330, 20, 0.35, (358, 1.1, 0.75)),
                          (0, 360, -0.12, (None, 1.0, 0.72))]),
    # Kultista Prázdnoty: černofialová, purpurové akcenty
    "void": dict(rules=[(90, 180, 0.2, (280, 1.0, 0.55)), (15, 45, 0.25, (275, 0.6, 0.35)), (330, 20, 0.3, (290, 1.0, 0.8)),
                        (200, 300, 0.2, (285, 1.1, 0.7)), (0, 360, -0.12, (None, 1.0, 0.45))], keep_skin=False, skin_to=(0.55, 0.5, 0.6)),
    # Drtič popela: zčernalá zbroj, rudá a oranžová žhnou
    "ash": dict(rules=[(15, 45, 0.2, (20, 0.4, 0.35)), (0, 360, -0.12, (None, 1.0, 0.4)), (200, 300, 0.2, (15, 0.5, 0.3))],
                glow=((345, 22, 0.75), (1.0, 0.42, 0.08), 2.5), keep_skin=False, skin_to=(0.35, 0.3, 0.3)),
    # Archivářka Lyrise: hvězdná modrá, září
    "star": dict(rules=[(0, 360, 0.0, (228, 1.4, 0.75))], keep_skin=False, skin_to=(0.55, 0.65, 1.0), glow_all=((0.12, 0.2, 0.6), 0.7)),
}


def make(src_name, variant, out_name):
    j, bn = load_glb(os.path.join(SRC, src_name + ".glb"))
    img_i = j["images"][0]
    bv = j["bufferViews"][img_i["bufferView"]]
    img = Image.open(io.BytesIO(bytes(bn[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]))).convert("RGB")
    v = VARIANTS[variant]
    skin = skin_mask(img)
    new = recolor(img, v["rules"])
    na = np.asarray(new).copy()
    oa = np.asarray(img)
    if v.get("keep_skin", True):
        na[skin] = oa[skin]
    elif v.get("skin_to"):
        na[skin] = (oa[skin].astype(np.float32) * np.array(v["skin_to"])).clip(0, 255).astype(np.uint8)
    new = Image.fromarray(na)
    tex = add_image(j, bn, new, out_name)
    mats = j["materials"]
    for m in mats:
        pbr = m.setdefault("pbrMetallicRoughness", {})
        if "baseColorTexture" in pbr:
            pbr["baseColorTexture"]["index"] = tex
    if v.get("glow"):
        (h0, h1, smin), col, strength = v["glow"]
        a = np.asarray(img.convert("RGB"), np.float32) / 255
        H = np.array([colorsys.rgb_to_hsv(*p) for p in a.reshape(-1, 3)], np.float32)
        hh = H[:, 0] * 360
        m = (((hh >= h0) | (hh <= h1)) & (H[:, 1] >= smin) & (H[:, 2] >= 0.6)).reshape(a.shape[:2])
        em = np.zeros(a.shape, np.uint8)
        em[m] = (np.array(col) * 255).astype(np.uint8)
        etex = add_image(j, bn, Image.fromarray(em), out_name + "_emissive")
        for mm in mats:
            mm["emissiveTexture"] = {"index": etex}
            mm["emissiveFactor"] = [1.0, 1.0, 1.0]
            mm.setdefault("extensions", {})["KHR_materials_emissive_strength"] = {"emissiveStrength": strength}
        j.setdefault("extensionsUsed", [])
        if "KHR_materials_emissive_strength" not in j["extensionsUsed"]:
            j["extensionsUsed"].append("KHR_materials_emissive_strength")
    if v.get("glow_all"):
        col, strength = v["glow_all"]
        for mm in mats:
            mm["emissiveFactor"] = list(col)
            mm.setdefault("extensions", {})["KHR_materials_emissive_strength"] = {"emissiveStrength": strength}
        j.setdefault("extensionsUsed", [])
        if "KHR_materials_emissive_strength" not in j["extensionsUsed"]:
            j["extensionsUsed"].append("KHR_materials_emissive_strength")
    save_glb(os.path.join(OUT, out_name + ".glb"), j, bn)
    print(f"{out_name}.glb ({src_name}, {variant}): {os.path.getsize(os.path.join(OUT, out_name + '.glb')) // 1024} KB")


def main():
    os.makedirs(OUT, exist_ok=True)
    # Ozvěna – povolání podle armád z lore
    make("Knight", "sylvaria", "knight_sylvaria")      # Duchovní rytíř Sylvarie
    make("Mage", "sylvaria", "mage_sylvaria")          # Válečný mág
    make("Rogue", "sylvaria", "ranger_sylvaria")       # Lučištník / iluzionista
    make("Knight", "aethel", "knight_aethel")          # Těžkooděnec Aethelgardu
    make("Barbarian", "aethel", "warden_aethel")       # Strážce s dvouruční sekerou
    make("Rogue", "aethel", "engineer_aethel")         # Inženýr s kuší
    # nepřátelé a NPC
    make("Rogue_Hooded", "void", "cultist")            # Kultista Prázdnoty
    make("Barbarian", "ash", "crusher")                # Drtič popela
    make("Mage", "star", "lyrise")                     # Archivářka Lyrise


if __name__ == "__main__":
    main()
