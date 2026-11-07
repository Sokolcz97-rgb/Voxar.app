"""Postavy Eryndoru (vlastní tvorba, generováno kódem) – s kostrou a animacemi od začátku.

  python3 tools/eryndor_chars.py   -> Assets/Models/chars/*.glb, Assets/Models/weapons/*.glb

Každý díl těla patří jedné kosti (tuhé díly, klouby kryté přesahem) – při pohybu se nic nenatahuje.
Stylizované proporce ručně malovaných MMO: široká ramena, velké ruce a chodidla, výrazná hlava,
mohutné nárameníky. Zbraně jsou zvlášť (entity.attach ke kosti ruky).
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from meshkit import (Mesh, box, capsule, cone, crystal, cylinder, displace, double_sided, fbm, lathe, merge,  # noqa: E402
                     plane, rounded_box, sphere, write_glb)

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Assets", "Models")
CH = os.path.join(ROOT, "chars")
WP = os.path.join(ROOT, "weapons")


def rgb(h):
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5))


def sm(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def env(t, a, b, c, d):
    return sm((t - a) / max(b - a, 1e-6)) * (1 - sm((t - c) / max(d - c, 1e-6)))


# ------------------------------------------------------------------ kostra člověka
def humanoid_skeleton(h=1.85, shoulder=0.27):
    k = h / 1.85
    def p(x, y, z=0.0):
        return (x * k, y * k, z * k)
    J = [("Root", None, p(0, 0)), ("Hips", "Root", p(0, 0.98)), ("Spine", "Hips", p(0, 1.12)), ("Chest", "Spine", p(0, 1.3)),
         ("Neck", "Chest", p(0, 1.56)), ("Head", "Neck", p(0, 1.64))]
    for s, sx in (("L", 1), ("R", -1)):
        J += [("UpperArm." + s, "Chest", p(shoulder * sx, 1.48)), ("LowerArm." + s, "UpperArm." + s, p((shoulder + 0.04) * sx, 1.18)),
              ("Hand." + s, "LowerArm." + s, p((shoulder + 0.06) * sx, 0.93, 0.02)),
              ("UpperLeg." + s, "Hips", p(0.12 * sx, 0.95)), ("LowerLeg." + s, "UpperLeg." + s, p(0.12 * sx, 0.53)),
              ("Foot." + s, "LowerLeg." + s, p(0.12 * sx, 0.1))]
    return J


class Body:
    """Sběr dílů: materiál -> [Mesh s kostí]."""

    def __init__(self, skeleton):
        self.sk = skeleton
        self.names = [j[0] for j in skeleton]
        self.pos = {j[0]: np.array(j[2], np.float32) for j in skeleton}
        self.parts = {}
        self.mats = {}

    def add(self, mesh, bone, mat_name, mat):
        mesh.bone(self.names.index(bone))
        self.parts.setdefault(mat_name, []).append(mesh)
        self.mats[mat_name] = mat
        return mesh

    def limb(self, a, b, r0, r1, bone, mat_name, mat, color, seg=10):
        """Kónický válec mezi body a -> b (s kulatými konci)."""
        a, b = np.array(a, np.float32), np.array(b, np.float32)
        v = b - a
        L = float(np.linalg.norm(v))
        m = lathe([(r0 * 0.6, -r0 * 0.5), (r0, 0.0), (r1, L), (r1 * 0.6, L + r1 * 0.5)], seg)
        align(m, v)
        m.translate(*a)
        m.gradient(np.asarray(color) * 0.82, np.asarray(color) * 1.05, axis=1)
        return self.add(m, bone, mat_name, mat)

    def build(self):
        return [(merge(*ms), self.mats[k]) for k, ms in self.parts.items()]


def align(m, v):
    """Natočí síť stavěnou podél +Y do směru v."""
    v = np.asarray(v, np.float64)
    L = np.linalg.norm(v)
    if L < 1e-9:
        return m
    y = v / L
    ref = np.array([0, 0, 1.0]) if abs(y[2]) < 0.9 else np.array([1.0, 0, 0])
    x = np.cross(y, ref)
    x /= np.linalg.norm(x)
    z = np.cross(x, y)
    R = np.stack([x, y, z], 1)   # sloupce: kam jde X, Y, Z
    m.P = (m.P @ R.T).astype(np.float32)
    m.invalidate()
    return m


SKIN = dict(name="skin", roughness=0.7)
CLOTH = dict(name="cloth", roughness=0.92, double=True)
LEATHER = dict(name="leather", roughness=0.75)
STEEL = dict(name="steel", roughness=0.4, metallic=0.85)
GOLD = dict(name="gold", roughness=0.3, metallic=0.9)
HAIR = dict(name="hair", roughness=0.6)
EYE = dict(name="eye", roughness=0.2)


def glow(c, s=4.0, name="glow"):
    return dict(name=name, roughness=0.3, emissive=c, emissive_strength=s)


# ------------------------------------------------------------------ Ozvěna (hráč)
STYLES = {
    # Sylvaria: lehká bílá zbroj s tyrkysovou látkou a zlatem, živé motivy
    "sylvaria": dict(cloth=rgb("#2a8f88"), cloth2=rgb("#e8e2d2"), armor=rgb("#e6e2d8"), trim=rgb("#d9a840"),
                     leather=rgb("#6a4c34"), boot=rgb("#5a4230"), glow=rgb("#4fe0ff"), heavy=False),
    # Aethelgard: tmavá ocelová plátová zbroj, rudá látka, mosazné nýty, krystalové jádro na hrudi
    "aethel": dict(cloth=rgb("#8a1e1a"), cloth2=rgb("#3a2a24"), armor=rgb("#59606b"), trim=rgb("#b88a3a"),
                   leather=rgb("#3b2a20"), boot=rgb("#2b2b2e"), glow=rgb("#ff9a3a"), heavy=True),
}


def echo(gender, style_name, hair_color, skin_color, elf=False):
    st = STYLES[style_name]
    h = 1.85 if gender == "m" else 1.74
    k = h / 1.85
    sh = 0.27 if gender == "m" else 0.235
    sk = humanoid_skeleton(h, sh)
    B = Body(sk)
    P = B.pos
    fem = gender == "f"
    W = 1.0 if not fem else 0.86     # šířka postavy

    # --- hlava (výrazná, stylizovaná)
    head_c = P["Head"] + np.array([0, 0.15 * k, 0.01], np.float32)
    k = k * 1.14   # stylizovaná větší hlava (jen pro díly hlavy níže)
    head = sphere(0.135 * k, 18, 14).scale(0.95, 1.08, 1.0).translate(*head_c)
    # brada a čelist
    jaw = sphere(0.1 * k, 12, 8).scale(0.95 if not fem else 0.8, 0.7, 0.85).translate(*(head_c + np.array([0, -0.075 * k, 0.03 * k])))
    face = merge(head, jaw)
    face.paint(lambda Pp, N: np.asarray(skin_color) * (0.85 + 0.2 * np.clip(N[:, 2:3] * 0.5 + 0.5, 0, 1)) +
               np.array([0.08, 0.0, 0.0]) * np.clip(N[:, 2:3], 0, 1) * 0.5)
    B.add(face, "Head", "skin", SKIN)
    nose = cone(0.022 * k, 0.05 * k, 6).rotate(90, 0, 0).translate(*(head_c + np.array([0, -0.01 * k, 0.125 * k]))).color(np.asarray(skin_color) * 0.95)
    B.add(nose, "Head", "skin", SKIN)
    iris_c = rgb("#3fb8c8") if elf else rgb("#6a4a2a")
    for sx in (1, -1):
        ec = head_c + np.array([0.05 * sx * k, 0.02 * k, 0.112 * k])
        white = sphere(0.026 * k, 10, 8).scale(1.25, 0.85, 0.55).translate(*ec).color((0.95, 0.94, 0.9))
        B.add(white, "Head", "eye", EYE)
        iris = sphere(0.016 * k, 8, 6).scale(1.0, 1.1, 0.5).translate(*(ec + np.array([-0.002 * sx, -0.002, 0.012 * k]))).color(iris_c)
        B.add(iris, "Head", "eye", EYE)
        pupil = sphere(0.008 * k, 6, 4).scale(1, 1, 0.5).translate(*(ec + np.array([-0.002 * sx, -0.002, 0.019 * k]))).color((0.03, 0.03, 0.05))
        B.add(pupil, "Head", "eye", EYE)
        hl = sphere(0.005 * k, 6, 4).translate(*(ec + np.array([0.006 * sx * k, 0.008 * k, 0.022 * k]))).color((1, 1, 1))
        B.add(hl, "Head", "eye", EYE)
        lid = sphere(0.028 * k, 10, 6).scale(1.3, 0.5, 0.6)
        lid.apply(lambda Pp: np.where(Pp[:, 1:2] < 0, Pp * np.array([1, 0.2, 1]), Pp))
        lid.translate(*(ec + np.array([0, 0.012 * k, 0.002]))).color(np.asarray(skin_color) * 0.85)
        B.add(lid, "Head", "skin", SKIN)
        brow = box(0.05 * k, 0.012 * k, 0.02 * k).rotate(0, 0, -8 * sx).translate(*(head_c + np.array([0.05 * sx * k, 0.058 * k, 0.118 * k]))).color(np.asarray(hair_color) * 0.8)
        B.add(brow, "Head", "hair", HAIR)
        # uši (elfí špičaté pro Sylvarii)
        if elf:
            ear = cone(0.03 * k, 0.12 * k, 5).scale(0.5, 1, 1).rotate(0, 0, -62 * sx).rotate(-15, 0, 0).translate(*(head_c + np.array([0.125 * sx * k, 0.0, 0.0])))
        else:
            ear = sphere(0.03 * k, 6, 5).scale(0.4, 1.0, 0.7).translate(*(head_c + np.array([0.13 * sx * k, 0.0, 0.0])))
        B.add(ear.color(np.asarray(skin_color) * 0.92), "Head", "skin", SKIN)
    mouth = box(0.045 * k, 0.008 * k, 0.01 * k).translate(*(head_c + np.array([0, -0.058 * k, 0.118 * k]))).color(np.asarray(skin_color) * 0.6)
    B.add(mouth, "Head", "skin", SKIN)
    # vlasy
    hair = sphere(0.152 * k, 18, 12).scale(1.04, 0.98, 1.08)
    hair.apply(lambda Pp: np.where((Pp[:, 2:3] > 0.05 * k) & (Pp[:, 1:2] < 0.06 * k), Pp * np.array([1, 1, 0.6]), Pp))
    hair.translate(*(head_c + np.array([0, 0.035 * k, -0.012 * k])))
    hs = [hair]
    for j in range(5):   # ofina / prameny do čela
        hs.append(sphere(0.05 * k, 8, 6).scale(1.0, 0.6, 0.7).rotate(0, 0, (j - 2) * 12)
                  .translate(*(head_c + np.array([(j - 2) * 0.045 * k, 0.1 * k, 0.1 * k]))))
    if fem:   # dlouhé vlasy do copu
        for j in range(5):
            hs.append(sphere((0.06 - j * 0.006) * k, 10, 7).translate(*(head_c + np.array([0, -0.06 * k - j * 0.07 * k, -0.12 * k - j * 0.01]))))
    else:
        hs.append(sphere(0.07 * k, 10, 7).scale(1.4, 0.8, 1.0).translate(*(head_c + np.array([0, -0.05 * k, -0.1 * k]))))
    hm = merge(*hs)
    hm.paint(lambda Pp, N: np.asarray(hair_color) * (0.7 + 0.5 * fbm(Pp * np.array([6, 18, 6]), 3.0, 2, 3)[:, None]) * (0.75 + 0.35 * np.clip(N[:, 1:2], 0, 1)))
    B.add(hm, "Head", "hair", HAIR)
    if st["heavy"] and not fem:   # Aethelgard: helma s hřebenem a nosníkem
        helm = sphere(0.158 * k, 16, 10).scale(1.0, 0.9, 1.05)
        helm.apply(lambda Pp: np.where(Pp[:, 1:2] < -0.02 * k, Pp * np.array([1, 0.4, 1]), Pp))
        helm.translate(*(head_c + np.array([0, 0.045 * k, -0.005])))
        helm.paint(lambda Pp, N: np.asarray(st["armor"]) * (0.8 + 0.35 * np.clip(N[:, 1:2], 0, 1)))
        B.add(helm, "Head", "steel", STEEL)
        crest = box(0.03 * k, 0.07 * k, 0.26 * k).translate(*(head_c + np.array([0, 0.19 * k, -0.01]))).color(st["trim"])
        B.add(crest, "Head", "gold", GOLD)
        guard = box(0.02 * k, 0.09 * k, 0.03 * k).translate(*(head_c + np.array([0, 0.02 * k, 0.15 * k]))).color(st["armor"])
        B.add(guard, "Head", "steel", STEEL)
    if style_name == "sylvaria":   # čelenka s krystalem
        circ = lathe([(0.142 * k, -0.008), (0.146 * k, 0), (0.142 * k, 0.008)], 18, False, False).translate(*(head_c + np.array([0, 0.06 * k, 0]))).color(st["trim"])
        B.add(circ, "Head", "gold", GOLD)
        gem = crystal(0.04 * k, 0.012 * k, 4, 0.5, 1).translate(*(head_c + np.array([0, 0.055 * k, 0.142 * k]))).color(rgb("#bff4ff"))
        B.add(gem, "Head", "glowc", glow(st["glow"], 5))

    k = h / 1.85
    # --- krk
    B.limb(P["Neck"] - np.array([0, 0.03, 0]), P["Head"] + np.array([0, 0.04, 0]), 0.055 * k * W, 0.05 * k * W, "Neck", "skin", SKIN, skin_color)

    # --- trup: hrudník (široký) a břicho
    ch = P["Chest"]
    chest = lathe([(0.15 * W * k, -0.06 * k), (0.2 * W * k, 0.04 * k), (0.23 * W * k, 0.16 * k), (0.2 * W * k, 0.24 * k), (0.08 * k, 0.29 * k)], 14)
    chest.scale(1.0, 1.0, 0.68 if not fem else 0.62).translate(*ch)
    if fem:
        for sx in (1, -1):
            chest = merge(chest, sphere(0.075 * k, 10, 8).scale(1, 0.85, 0.8).translate(ch[0] + 0.075 * sx * k, ch[1] + 0.1 * k, ch[2] + 0.1 * k))
    if st["heavy"]:
        chest.paint(lambda Pp, N: np.asarray(st["armor"]) * (0.75 + 0.4 * np.clip(N[:, 1:2] * 0.5 + N[:, 2:3] * 0.5 + 0.5, 0, 1)))
        B.add(chest, "Chest", "steel", STEEL)
        core = crystal(0.09 * k, 0.04 * k, 6, 0.5, 4).rotate(90, 0, 0).translate(ch[0], ch[1] + 0.11 * k, ch[2] + 0.13 * k).color(rgb("#ffd08a"))
        B.add(core, "Chest", "glowc", glow(st["glow"], 6))
        ring = lathe([(0.07 * k, -0.012), (0.08 * k, 0), (0.07 * k, 0.012)], 14, False, False).rotate(90, 0, 0).translate(ch[0], ch[1] + 0.11 * k, ch[2] + 0.135 * k).color(st["trim"])
        B.add(ring, "Chest", "gold", GOLD)
    else:
        chest.paint(lambda Pp, N: np.where(np.abs(Pp[:, 0:1] - ch[0]) < 0.05 * k, np.asarray(st["cloth"]), np.asarray(st["armor"])) *
                    (0.8 + 0.3 * np.clip(N[:, 1:2] * 0.5 + 0.5, 0, 1)))
        B.add(chest, "Chest", "armor", dict(name="armor", roughness=0.5, metallic=0.2))
    belly = lathe([(0.16 * W * k, -0.12 * k), (0.17 * W * k, 0.0), (0.18 * W * k, 0.12 * k)], 12).scale(1, 1, 0.7).translate(*P["Spine"])
    belly.gradient(np.asarray(st["cloth2"]) * 0.8, np.asarray(st["cloth2"]))
    B.add(belly, "Spine", "cloth", CLOTH)
    # opasek s přezkou
    belt = lathe([(0.185 * W * k, -0.035 * k), (0.19 * W * k, 0.0), (0.185 * W * k, 0.035 * k)], 14).scale(1, 1, 0.72).translate(*(P["Hips"] + np.array([0, 0.05 * k, 0])))
    belt.color(st["leather"])
    B.add(belt, "Hips", "leather", LEATHER)
    buckle = box(0.06 * k, 0.05 * k, 0.02 * k).translate(*(P["Hips"] + np.array([0, 0.05 * k, 0.135 * k]))).color(st["trim"])
    B.add(buckle, "Hips", "gold", GOLD)
    pelvis = lathe([(0.17 * W * k, -0.12 * k), (0.185 * W * k, 0.03 * k)], 12).scale(1, 1, 0.72).translate(*P["Hips"])
    pelvis.color(np.asarray(st["cloth2"]) * 0.85)
    B.add(pelvis, "Hips", "cloth", CLOTH)
    # tabard (přední a zadní pruh látky) – patří pánvi
    for zs in (1, -1):
        tab = plane(0.2 * W * k, 0.42 * k, 2, 4).rotate(90, 0, 0)
        tab.apply(lambda Pp: Pp + np.stack([np.zeros(len(Pp)), np.zeros(len(Pp)), 0.03 * np.abs(Pp[:, 1]) * zs], 1))
        tab.translate(P["Hips"][0], P["Hips"][1] - 0.2 * k, P["Hips"][2] + 0.135 * zs * k)
        tab.gradient(np.asarray(st["cloth"]) * 0.75, np.asarray(st["cloth"]) * 1.05)
        B.add(double_sided(tab), "Hips", "cloth", CLOTH)
        trim = box(0.2 * W * k, 0.025 * k, 0.012 * k).translate(P["Hips"][0], P["Hips"][1] - 0.41 * k, P["Hips"][2] + 0.136 * zs * k).color(st["trim"])
        B.add(trim, "Hips", "gold", GOLD)

    # --- paže
    for s, sx in (("L", 1), ("R", -1)):
        ua, la, hd = P["UpperArm." + s], P["LowerArm." + s], P["Hand." + s]
        arm_c = st["armor"] if st["heavy"] else skin_color
        arm_m = ("steel", STEEL) if st["heavy"] else ("skin", SKIN)
        B.limb(ua, la, 0.062 * k * W, 0.052 * k * W, "UpperArm." + s, arm_m[0], arm_m[1], arm_c)
        B.limb(la, hd + np.array([0, 0.03, 0]), 0.05 * k * W, 0.045 * k * W, "LowerArm." + s, "skin", SKIN, skin_color)
        # nátepník
        br = lathe([(0.058 * k * W, 0), (0.062 * k * W, 0.06 * k), (0.056 * k * W, 0.14 * k)], 10)
        align(br, hd - la).translate(*(la + (hd - la) * 0.35))
        br.color(st["armor"] if st["heavy"] else st["leather"])
        B.add(br, "LowerArm." + s, "steel" if st["heavy"] else "leather", STEEL if st["heavy"] else LEATHER)
        # loket (koule kryje spoj)
        B.add(sphere(0.055 * k * W, 8, 6).translate(*la).color(arm_c), "LowerArm." + s, arm_m[0], arm_m[1])
        # ruka (velká, stylizovaná) + palec
        hand = rounded_box(0.075 * k, 0.1 * k, 0.05 * k, 0.02 * k).translate(*(hd + np.array([0.005 * sx, -0.045 * k, 0.01])))
        thumb = capsule(0.016 * k, 0.06 * k, 6, 2).rotate(0, 0, 30 * sx).translate(*(hd + np.array([-0.03 * sx * k, -0.03 * k, 0.03 * k])))
        gl = merge(hand, thumb).color(st["leather"] if not st["heavy"] else st["armor"])
        B.add(gl, "Hand." + s, "leather", LEATHER)
        # nárameník (mohutný, jde s ramenem)
        pr = sphere(0.12 * k * (1.25 if st["heavy"] else 1.0), 14, 8)
        pr.apply(lambda Pp: np.where(Pp[:, 1:2] < 0, Pp * np.array([1, 0.25, 1]), Pp))
        pr.scale(1.15, 0.8, 1.0).rotate(0, 0, -22 * sx).translate(*(ua + np.array([0.03 * sx * k, 0.05 * k, 0])))
        pr.paint(lambda Pp, N, c=st["armor"]: np.asarray(c) * (0.7 + 0.45 * np.clip(N[:, 1:2], 0, 1)))
        B.add(pr, "UpperArm." + s, "steel" if st["heavy"] else "armor", STEEL if st["heavy"] else dict(name="armor", roughness=0.5, metallic=0.2))
        edge = lathe([(0.13 * k * (1.25 if st["heavy"] else 1.0), -0.012), (0.135 * k * (1.25 if st["heavy"] else 1.0), 0), (0.13 * k * (1.25 if st["heavy"] else 1.0), 0.012)], 14, False, False)
        edge.scale(1.15, 1, 1.0).rotate(0, 0, -22 * sx).translate(*(ua + np.array([0.03 * sx * k, 0.05 * k, 0]))).color(st["trim"])
        B.add(edge, "UpperArm." + s, "gold", GOLD)
        if st["heavy"]:
            for j in range(3):
                rv = sphere(0.014 * k, 5, 4).translate(*(ua + np.array([0.06 * sx * k + 0.04 * (j - 1) * sx * k, 0.12 * k, 0.04 * (j - 1) * k]))).color(st["trim"])
                B.add(rv, "UpperArm." + s, "gold", GOLD)
        else:   # Sylvaria: listový lem
            for j in range(3):
                lf = cone(0.03 * k, 0.09 * k, 4).scale(1, 1, 0.3).rotate(0, 0, 160 * sx - (j - 1) * 25).translate(*(ua + np.array([0.11 * sx * k, -0.02 * k, (j - 1) * 0.05 * k]))).color(st["cloth"])
                B.add(lf, "UpperArm." + s, "cloth", CLOTH)

    # --- nohy
    for s, sx in (("L", 1), ("R", -1)):
        ul, ll, ft = P["UpperLeg." + s], P["LowerLeg." + s], P["Foot." + s]
        pants = st["cloth2"] if not st["heavy"] else rgb("#3a3a40")
        B.limb(ul + np.array([0, 0.04, 0]), ll, 0.085 * k * W, 0.06 * k * W, "UpperLeg." + s, "cloth", CLOTH, pants)
        B.add(sphere(0.062 * k * W, 8, 6).translate(*ll).color(st["armor"] if st["heavy"] else pants), "LowerLeg." + s,
              "steel" if st["heavy"] else "cloth", STEEL if st["heavy"] else CLOTH)
        # vysoká bota
        boot = lathe([(0.06 * k * W, 0.0), (0.064 * k * W, 0.18 * k), (0.075 * k * W, 0.36 * k), (0.07 * k * W, 0.42 * k)], 10)
        boot.translate(ll[0], ft[1] - 0.02, ll[2])
        boot.gradient(np.asarray(st["boot"]) * 0.8, np.asarray(st["boot"]) * 1.1)
        B.add(boot, "LowerLeg." + s, "leather", LEATHER)
        if st["heavy"]:
            knee = sphere(0.07 * k, 10, 6).scale(1, 0.9, 0.7).translate(*(ll + np.array([0, 0.02, 0.05 * k]))).color(st["armor"])
            B.add(knee, "LowerLeg." + s, "steel", STEEL)
        foot = rounded_box(0.11 * k * W, 0.08 * k, 0.24 * k, 0.03 * k).translate(*(ft + np.array([0, -0.06 * k, 0.05 * k])))
        foot.color(np.asarray(st["boot"]) * 0.9)
        B.add(foot, "Foot." + s, "leather", LEATHER)
    return sk, B.build()


# ------------------------------------------------------------------ animace člověka
# Znaménka (postava hledí k +Z): ruka/noha vpřed = −X, trup vpřed = +X, levá ruka od těla = +Z, pravá −Z.
def humanoid_clips(kind="sword"):
    """kind: sword (meč + štít), staff (hůl), bow (luk), rifle (puška), unarmed."""
    def arm(R, s, x=0.0, y=0.0, z=0.0, e=0.0):
        side = 1 if s == "L" else -1
        R["UpperArm." + s] = (x, y, z + 7 * side)
        R["LowerArm." + s] = (e, 0, 0)
        return R

    def legs_walk(R, p, k):
        s = math.sin(p)
        R["UpperLeg.L"] = (-28 * k * s, 0, 0)
        R["UpperLeg.R"] = (28 * k * s, 0, 0)
        R["LowerLeg.L"] = (38 * k * max(0.0, math.sin(p + 1.2)), 0, 0)
        R["LowerLeg.R"] = (38 * k * max(0.0, math.sin(p + 1.2 + math.pi)), 0, 0)
        R["Foot.L"] = (-10 * k * s, 0, 0)
        R["Foot.R"] = (10 * k * s, 0, 0)

    def weapon_rest(R, b=0.0):
        if kind == "sword":
            arm(R, "R", -18 + b, 0, -6, -38)       # meč šikmo vpřed
            arm(R, "L", -32 + b, 10, 6, -60)       # štít před tělem
        elif kind == "staff":
            arm(R, "R", -20 + b, 0, -4, -50)
            arm(R, "L", 4 + b, 0, 4, -15)
        elif kind == "bow":
            arm(R, "L", -12 + b, 0, 6, -20)
            arm(R, "R", 6 + b, 0, -4, -18)
        elif kind == "rifle":
            arm(R, "R", -30 + b, 0, -8, -70)
            arm(R, "L", -50 + b, -20, 10, -50)
        else:
            arm(R, "L", 3 * b, 0, 2, -8)
            arm(R, "R", 3 * b, 0, -2, -8)
        return R

    clips = []

    def idle(t):
        p = 2 * math.pi * t / 3.0
        b = math.sin(p)
        R = {"Chest": (1.6 * b, 0, 0), "Spine": (0.6 * b, 0, 0), "Head": (2 * math.sin(p + 1), 9 * math.sin(p * 0.5), 0)}
        return weapon_rest(R, 2 * b)
    clips.append(("Idle", 3.0, True, idle, lambda t: (0, 0.006 * math.sin(2 * math.pi * t / 3.0), 0)))

    def combat_idle(t):
        p = 2 * math.pi * t / 1.6
        b = math.sin(p)
        R = {"Spine": (10, 18, 0), "Chest": (4 + 2 * b, 8, 0), "Head": (-4, -24, 0), "Hips": (0, -12, 0),
             "UpperLeg.L": (-22, 0, 4), "UpperLeg.R": (12, 0, -4), "LowerLeg.L": (30, 0, 0), "LowerLeg.R": (24, 0, 0)}
        return weapon_rest(R, 3 * b)
    clips.append(("CombatIdle", 1.6, True, combat_idle, lambda t: (0, -0.06 + 0.01 * math.sin(2 * math.pi * t / 1.6), 0)))

    for name, dur, k in (("Walk", 1.05, 1.0), ("Run", 0.7, 1.6)):
        def walk(t, dur=dur, k=k, name=name):
            p = 2 * math.pi * t / dur
            s = math.sin(p)
            R = {"Hips": (0, 7 * s, 0), "Spine": ((5 if name == "Walk" else 14), -6 * s, 0), "Head": ((-3 if name == "Walk" else -10), 4 * s, 0)}
            legs_walk(R, p, k)
            if kind in ("sword", "staff", "rifle", "bow"):
                weapon_rest(R)
                # zbraňová ruka se jen pohupuje
                ux, uy, uz = R["UpperArm.R"]
                R["UpperArm.R"] = (ux - 10 * k * s, uy, uz)
                if kind == "bow":
                    lx, ly, lz = R["UpperArm.L"]
                    R["UpperArm.L"] = (lx + 10 * k * s, ly, lz)
            else:
                arm(R, "L", 24 * k * s, 0, 3, -14 * k)
                arm(R, "R", -24 * k * s, 0, -3, -14 * k)
            return R
        clips.append((name, dur, True, walk, lambda t, dur=dur, k=k: (0, 0.03 * k * abs(math.cos(2 * math.pi * t / dur)) - 0.015 * k, 0)))

    # tři údery komba (4Story: řetěz úderů automatického útoku) – nápřah, úder, návrat
    def strike(t, dur, variant):
        u = t / dur
        wind = env(u, 0.0, 0.3, 0.32, 0.45)
        hit = env(u, 0.32, 0.45, 0.6, 1.0)
        R = {"Hips": (0, -12, 0), "UpperLeg.L": (-22, 0, 4), "UpperLeg.R": (12, 0, -4), "LowerLeg.L": (30, 0, 0), "LowerLeg.R": (24, 0, 0)}
        weapon_rest(R)
        if kind == "staff":
            # kouzelný úder holí: zvednout a máchnout vpřed
            arm(R, "R", -20 - 80 * wind + 40 * hit, 0, -10 - 20 * wind, -50 + 20 * wind)
            R["Spine"] = (8 * hit, (20 * wind - 30 * hit), 0)
        elif kind in ("bow", "rifle"):
            return shoot_pose(t, dur)
        elif variant == 0:   # šikmý sek shora
            arm(R, "R", -40 - 90 * wind + 40 * hit, 0, -10 - 40 * wind + 50 * hit, -60 * wind - 10 * hit)
            R["Spine"] = (6 + 12 * hit, (25 * wind - 35 * hit), 0)
        elif variant == 1:   # vodorovný sek zprava doleva
            arm(R, "R", -70, -30 * wind + 70 * hit, -50 * wind + 40 * hit, -30 * wind)
            R["Spine"] = (8, (35 * wind - 45 * hit), 0)
        else:                # bodnutí vpřed s výpadem
            arm(R, "R", -60 * wind - 85 * hit, 0, -8, -90 * wind + 60 * hit)
            R["Spine"] = (6 + 14 * hit, 15 * wind - 15 * hit, 0)
            R["UpperLeg.L"] = (-22 - 25 * hit, 0, 4)
            R["LowerLeg.L"] = (30 + 15 * hit, 0, 0)
        R["Chest"] = (0, 10 * (wind - hit), 0)
        return R

    def shoot_pose(t, dur):
        u = t / dur
        draw = env(u, 0.0, 0.35, 0.75, 1.0)
        R = {"Hips": (0, -40 * draw, 0), "Spine": (0, 35 * draw, 0), "Head": (0, 5 * draw, 0),
             "UpperLeg.L": (-15, 0, 6), "UpperLeg.R": (10, 0, -6)}
        if kind == "bow":
            arm(R, "L", -88 * draw, 0, 4, 0)                  # luk vpřed
            arm(R, "R", -85 * draw, -25 * draw, -6, -95 * env(u, 0.1, 0.4, 0.62, 0.7))   # tětiva k bradě a vypustit
        else:
            arm(R, "R", -60 - 25 * draw, 0, -8, -70)
            arm(R, "L", -80 * draw - 10, -25, 10, -40)
        return R

    for i, (dur) in enumerate((0.75, 0.75, 0.9)):
        clips.append((f"Attack{i + 1}", dur, False, lambda t, dur=dur, i=i: strike(t, dur, i),
                      lambda t, dur=dur, i=i: (0, -0.06, 0.08 * env(t / dur, 0.3, 0.45, 0.6, 1.0) * (2 if i == 2 else 1))))
    clips.append(("Shoot", 1.0, False, lambda t: shoot_pose(t, 1.0), None))

    def cast(t, dur=1.4):
        # sesílání: ruce se zvednou a „nabíjejí“ (smyčka), pak se vrací
        u = (t % 0.7) / 0.7
        b = math.sin(u * 2 * math.pi)
        R = {"Spine": (-6, 0, 0), "Head": (-8, 0, 0)}
        arm(R, "L", -55 + 6 * b, 0, 25, -45)
        arm(R, "R", -55 - 6 * b, 0, -25, -45)
        return R
    clips.append(("Cast", 1.4, True, cast, lambda t: (0, 0.01 * math.sin(t * 9), 0)))

    def release(t, dur=0.6):
        u = t / dur
        push = env(u, 0.0, 0.25, 0.5, 1.0)
        R = {"Spine": (14 * push, 0, 0), "Head": (6 * push, 0, 0)}
        arm(R, "L", -55 - 30 * push, 0, 25 - 15 * push, -45 + 40 * push)
        arm(R, "R", -55 - 30 * push, 0, -25 + 15 * push, -45 + 40 * push)
        return R
    clips.append(("CastRelease", 0.6, False, release, None))

    def hit(t, dur=0.45):
        u = env(t / dur, 0.0, 0.2, 0.35, 1.0)
        R = {"Spine": (-16 * u, 10 * u, 0), "Head": (-14 * u, -12 * u, 0)}
        weapon_rest(R)
        return R
    clips.append(("Hit", 0.45, False, hit, lambda t: (0, 0, -0.05 * env(t / 0.45, 0, 0.2, 0.35, 1))))

    def death(t, dur=1.4):
        u = sm(t / dur)
        knees = env(t / dur, 0.0, 0.3, 1.1, 1.2)
        R = {"Root": (-86 * u, 0, 0), "Spine": (-10 * u, 0, 0), "Head": (-20 * u, 30 * u, 0),
             "UpperLeg.L": (-30 * knees, 0, 0), "UpperLeg.R": (-20 * knees, 0, 0), "LowerLeg.L": (50 * knees, 0, 0), "LowerLeg.R": (40 * knees, 0, 0)}
        arm(R, "L", -40 * u, 0, 60 * u, -20 * u)
        arm(R, "R", -30 * u, 0, -55 * u, -20 * u)
        return R
    clips.append(("Death", 1.4, False, death, lambda t: (0, 0.1 * sm(t / 1.4), 0)))

    def jump(t, dur=0.9):
        u = t / dur
        tuck = env(u, 0.1, 0.35, 0.6, 0.95)
        R = {"UpperLeg.L": (-40 * tuck, 0, 0), "UpperLeg.R": (-25 * tuck, 0, 0), "LowerLeg.L": (60 * tuck, 0, 0), "LowerLeg.R": (55 * tuck, 0, 0),
             "Spine": (10 * tuck, 0, 0)}
        weapon_rest(R, -20 * tuck)
        return R
    clips.append(("Jump", 0.9, False, jump, None))

    def cheer(t, dur=1.6):
        u = t / dur
        h = env(u, 0.0, 0.2, 0.8, 1.0)
        pump = math.sin(2 * math.pi * 3 * u) * env(u, 0.15, 0.3, 0.7, 0.85)
        R = {"Spine": (-12 * h, 0, 0), "Head": (-18 * h, 0, 0)}
        arm(R, "R", (-150 - 8 * pump) * h, 0, -10 * h, (-20 - 25 * pump) * h)   # tuhé díly – ruka může až nad hlavu
        arm(R, "L", -20 * h, 0, 30 * h, -30 * h)
        return R
    clips.append(("Cheer", 1.6, False, cheer, None))
    return clips


# ------------------------------------------------------------------ nepřátelé
def cultist():
    """Kultista Prázdnoty: kápě, tmavofialový hábit s rozedraným lemem, svítící oči, krystaly Umbria."""
    sk = humanoid_skeleton(1.8, 0.25)
    B = Body(sk)
    P = B.pos
    robe_c = rgb("#2b1838")
    # hábit (spodní díl – pánev; nohy se pod ním hýbou)
    robe = lathe([(0.2, 0.0), (0.33, 0.04), (0.3, 0.45), (0.22, 0.85), (0.19, 1.0)], 14)
    robe.apply(lambda Pp: Pp + np.stack([np.zeros(len(Pp)), (fbm(Pp, 6, 2, 3) - 0.5) * 0.12 * (Pp[:, 1] < 0.1), np.zeros(len(Pp))], 1))
    robe.translate(0, 0.03, 0).gradient(np.asarray(robe_c) * 0.55, np.asarray(robe_c) * 1.1)
    B.add(robe, "Hips", "cloth", CLOTH)
    torso = lathe([(0.19, 0.95), (0.23, 1.2), (0.24, 1.42), (0.12, 1.56)], 14).scale(1, 1, 0.75)
    torso.gradient(np.asarray(robe_c) * 0.8, np.asarray(robe_c) * 1.2)
    B.add(torso, "Chest", "cloth", CLOTH)
    sash = lathe([(0.2, 0.98), (0.205, 1.02), (0.2, 1.06)], 14).scale(1, 1, 0.76).color(rgb("#6a2a8a"))
    B.add(sash, "Spine", "cloth", CLOTH)
    head_c = P["Head"] + np.array([0, 0.12, 0.01])
    hood = sphere(0.17, 14, 10).scale(1.0, 1.15, 1.1)
    hood.apply(lambda Pp: np.where(Pp[:, 2:3] > 0.07, Pp * np.array([1, 1, 0.35]), Pp))   # otevřený obličej
    hood.translate(*head_c).gradient(np.asarray(robe_c) * 0.7, np.asarray(robe_c) * 1.3)
    B.add(hood, "Head", "cloth", CLOTH)
    tip = cone(0.08, 0.2, 8).rotate(-60, 0, 0).translate(*(head_c + np.array([0, 0.12, -0.12]))).color(robe_c)
    B.add(tip, "Head", "cloth", CLOTH)
    face = sphere(0.11, 10, 8).translate(*(head_c + np.array([0, -0.01, 0.02]))).color(rgb("#120a18"))
    B.add(face, "Head", "skin", dict(name="shadow", roughness=1))
    for sx in (1, -1):
        e = sphere(0.022, 6, 4).scale(1.3, 0.6, 0.5).translate(*(head_c + np.array([0.045 * sx, 0.0, 0.11]))).color(rgb("#e7a0ff"))
        B.add(e, "Head", "eyes", glow(rgb("#c050ff"), 9, "eyes"))
    for s, sx in (("L", 1), ("R", -1)):
        ua, la, hd = P["UpperArm." + s], P["LowerArm." + s], P["Hand." + s]
        B.limb(ua, la, 0.075, 0.07, "UpperArm." + s, "cloth", CLOTH, robe_c)
        sleeve = lathe([(0.07, 0), (0.11, 0.24)], 10)
        align(sleeve, hd - la).translate(*la)
        sleeve.gradient(np.asarray(robe_c), np.asarray(robe_c) * 0.6)
        B.add(sleeve, "LowerArm." + s, "cloth", CLOTH)
        hand = rounded_box(0.07, 0.1, 0.05, 0.02).translate(*(hd + np.array([0, -0.05, 0.01]))).color(rgb("#8a8494"))
        B.add(hand, "Hand." + s, "skin", SKIN)
        sp = sphere(0.1, 10, 6).scale(1.1, 0.6, 1).translate(*(ua + np.array([0.02 * sx, 0.04, 0]))).color(np.asarray(robe_c) * 1.2)
        B.add(sp, "UpperArm." + s, "cloth", CLOTH)
        # krystaly Umbria prorůstající rameny
        for j in range(3):
            c = crystal(0.14 + 0.05 * j, 0.03, 5, 0.4, j + (5 if s == "L" else 9)).rotate(-20 + j * 20, 0, -35 * sx).translate(*(ua + np.array([0.05 * sx, 0.08, -0.04 + j * 0.04])))
            B.add(c.color(rgb("#a060ff")), "UpperArm." + s, "voidc", glow(rgb("#8a2ae0"), 3.5, "voidc"))
        ul, ll, ft = P["UpperLeg." + s], P["LowerLeg." + s], P["Foot." + s]
        B.limb(ul, ll, 0.07, 0.055, "UpperLeg." + s, "cloth", CLOTH, rgb("#1e1424"))
        B.limb(ll, ft, 0.055, 0.05, "LowerLeg." + s, "cloth", CLOTH, rgb("#1e1424"))
        B.add(rounded_box(0.1, 0.07, 0.22, 0.03).translate(*(ft + np.array([0, -0.055, 0.05]))).color(rgb("#1a1418")), "Foot." + s, "leather", LEATHER)
    return sk, B.build()


def crusher():
    """Drtič popela: mohutný válečník, roztavená zbroj srostlá s tělem, žhnoucí praskliny."""
    sk = humanoid_skeleton(2.45, 0.4)
    B = Body(sk)
    P = B.pos
    k = 2.45 / 1.85
    plate = rgb("#2a2624")
    MOLTEN = dict(name="molten", roughness=0.6, metallic=0.5)
    CRACK = glow(rgb("#ff5a10"), 5, "cracks")

    def lava(m):
        """Roztavená zbroj: tmavý plát + žhnoucí praskliny (zvláštní svítící síť těsně nad povrchem)."""
        bone = int(m.B[0]) if len(m.B) else 0
        crack = fbm(m.P, 7, 3, 1) > 0.6
        m.paint(lambda Pp, N: np.asarray(plate) * (0.7 + 0.5 * np.clip(N[:, 1:2], 0, 1)) * np.where(crack[:, None], 0.55, 1.0))
        keep = crack[m.I].all(axis=1)
        if keep.any():
            used = np.unique(m.I[keep])
            remap = -np.ones(len(m.P), np.int64)
            remap[used] = np.arange(len(used))
            N = m.normals()
            g = Mesh(m.P[used] + N[used] * 0.004, remap[m.I[keep]], None, np.full(len(used), bone))
            g.color(rgb("#ff8a30"))
            B.parts.setdefault("cracks", []).append(g)
            B.mats["cracks"] = CRACK
        return m
    chest = lathe([(0.25 * k, -0.08 * k), (0.34 * k, 0.05 * k), (0.38 * k, 0.2 * k), (0.3 * k, 0.3 * k), (0.12 * k, 0.34 * k)], 12).scale(1, 1, 0.75).translate(*P["Chest"])
    B.add(lava(displace(chest, 0.03, 4, 2)), "Chest", "molten", MOLTEN)
    belly = lathe([(0.24 * k, -0.14 * k), (0.27 * k, 0.12 * k)], 12).scale(1, 1, 0.8).translate(*P["Spine"])
    B.add(lava(belly), "Spine", "molten", MOLTEN)
    hips = lathe([(0.25 * k, -0.14 * k), (0.27 * k, 0.06 * k)], 12).scale(1, 1, 0.8).translate(*P["Hips"])
    B.add(lava(hips), "Hips", "molten", MOLTEN)
    head_c = P["Head"] + np.array([0, 0.1 * k, 0.04])
    helm = rounded_box(0.22 * k, 0.24 * k, 0.24 * k, 0.05 * k).translate(*head_c)
    B.add(lava(displace(helm, 0.015, 6, 3)), "Head", "molten", MOLTEN)
    visor = box(0.16 * k, 0.025 * k, 0.02).translate(*(head_c + np.array([0, 0.01, 0.125 * k]))).color(rgb("#ffb040"))
    B.add(visor, "Head", "eyes", glow(rgb("#ff6a10"), 8, "eyes"))
    for sx in (1, -1):
        horn = cone(0.05 * k, 0.25 * k, 6).rotate(0, 0, -55 * sx).translate(*(head_c + np.array([0.1 * sx * k, 0.08 * k, 0]))).color(rgb("#1a1614"))
        B.add(horn, "Head", "steel", STEEL)
    for s, sx in (("L", 1), ("R", -1)):
        ua, la, hd = P["UpperArm." + s], P["LowerArm." + s], P["Hand." + s]
        m = B.limb(ua, la, 0.1 * k, 0.09 * k, "UpperArm." + s, "molten", MOLTEN, plate)
        lava(m)
        m2 = B.limb(la, hd, 0.09 * k, 0.1 * k, "LowerArm." + s, "molten", MOLTEN, plate)
        lava(m2)
        fist = rounded_box(0.15 * k, 0.16 * k, 0.13 * k, 0.04 * k).translate(*(hd + np.array([0, -0.06 * k, 0.02])))
        B.add(lava(fist), "Hand." + s, "molten", MOLTEN)
        pd = sphere(0.2 * k, 12, 8)
        pd.apply(lambda Pp: np.where(Pp[:, 1:2] < 0, Pp * np.array([1, 0.3, 1]), Pp))
        pd.translate(*(ua + np.array([0.06 * sx * k, 0.06 * k, 0])))
        B.add(lava(displace(pd, 0.03, 5, 7)), "UpperArm." + s, "molten", MOLTEN)
        for j in range(3):
            sp = cone(0.04 * k, 0.18 * k, 5).rotate(0, 0, -30 * sx - j * 12 * sx).translate(*(ua + np.array([0.12 * sx * k, 0.14 * k, (j - 1) * 0.08 * k]))).color(rgb("#1a1614"))
            B.add(sp, "UpperArm." + s, "steel", STEEL)
        ul, ll, ft = P["UpperLeg." + s], P["LowerLeg." + s], P["Foot." + s]
        lava(B.limb(ul, ll, 0.13 * k, 0.1 * k, "UpperLeg." + s, "molten", MOLTEN, plate))
        lava(B.limb(ll, ft, 0.1 * k, 0.11 * k, "LowerLeg." + s, "molten", MOLTEN, plate))
        B.add(lava(rounded_box(0.17 * k, 0.1 * k, 0.3 * k, 0.04 * k).translate(*(ft + np.array([0, -0.07 * k, 0.06 * k])))), "Foot." + s, "molten", MOLTEN)
    return sk, B.build()


def lyrise():
    """Archivářka Lyrise: bytost z hvězdné energie – průsvitně modrá, se zlatými ozdobami, vznáší se."""
    sk = humanoid_skeleton(1.9, 0.23)
    B = Body(sk)
    P = B.pos
    STAR = dict(name="star", roughness=0.25, emissive=rgb("#1a2a8a"), emissive_strength=1.0)

    def stars(m):
        m.paint(lambda Pp, N: np.where(fbm(Pp, 22, 1, 5)[:, None] > 0.78, np.array([1.0, 1.0, 1.0]),
                                       np.array(rgb("#2a3aa8")) * (0.5 + 0.5 * np.clip(N[:, 1:2] * 0.5 + 0.5, 0, 1))))
        return m
    gown = lathe([(0.06, 0.25), (0.34, 0.3), (0.3, 0.6), (0.2, 0.95), (0.16, 1.05)], 16)
    gown.apply(lambda Pp: Pp + np.stack([np.zeros(len(Pp)), (fbm(Pp, 5, 2, 2) - 0.5) * 0.15 * (Pp[:, 1] < 0.35), np.zeros(len(Pp))], 1))
    B.add(stars(gown), "Hips", "star", STAR)
    torso = lathe([(0.16, 0.98), (0.19, 1.25), (0.2, 1.44), (0.08, 1.58)], 14).scale(1, 1, 0.7)
    B.add(stars(torso), "Chest", "star", STAR)
    head_c = P["Head"] + np.array([0, 0.13, 0.0])
    head = sphere(0.12, 14, 10).scale(0.9, 1.1, 0.95).translate(*head_c)
    B.add(stars(head), "Head", "star", STAR)
    halo = lathe([(0.2, -0.01), (0.22, 0), (0.2, 0.01)], 24, False, False).rotate(70, 0, 0).translate(*(head_c + np.array([0, 0.08, -0.12]))).color(rgb("#ffd66a"))
    B.add(halo, "Head", "gold", glow(rgb("#ffc040"), 5, "gold"))
    for sx in (1, -1):
        e = sphere(0.018, 6, 4).translate(*(head_c + np.array([0.04 * sx, 0.01, 0.105]))).color((1, 1, 1))
        B.add(e, "Head", "eyes", glow(rgb("#ffffff"), 8, "eyes"))
    hair = merge(*[sphere(0.06 - j * 0.006, 8, 6).translate(*(head_c + np.array([0, 0.02 - j * 0.09, -0.11 - j * 0.02]))) for j in range(7)])
    B.add(stars(hair), "Head", "star", STAR)
    for s, sx in (("L", 1), ("R", -1)):
        ua, la, hd = P["UpperArm." + s], P["LowerArm." + s], P["Hand." + s]
        stars(B.limb(ua, la, 0.045, 0.04, "UpperArm." + s, "star", STAR, (1, 1, 1)))
        sleeve = lathe([(0.04, 0), (0.12, 0.26)], 10)
        align(sleeve, hd - la).translate(*la)
        B.add(stars(sleeve), "LowerArm." + s, "star", STAR)
        B.add(stars(rounded_box(0.05, 0.08, 0.035, 0.015).translate(*(hd + np.array([0, -0.04, 0])))), "Hand." + s, "star", STAR)
        cuff = lathe([(0.05, -0.01), (0.055, 0), (0.05, 0.01)], 10, False, False)
        align(cuff, hd - la).translate(*(la + (hd - la) * 0.2)).color(rgb("#ffd66a"))
        B.add(cuff, "LowerArm." + s, "gold", glow(rgb("#ffc040"), 5, "gold"))
    return sk, B.build()


def npc_clips():
    def idle(t):
        p = 2 * math.pi * t / 4.0
        b = math.sin(p)
        R = {"Chest": (2 * b, 0, 0), "Head": (3 * math.sin(p + 1), 10 * math.sin(p * 0.5), 0)}
        R["UpperArm.L"] = (-25 + 4 * b, 0, 18)
        R["LowerArm.L"] = (-50, 0, 0)
        R["UpperArm.R"] = (-25 - 4 * b, 0, -18)
        R["LowerArm.R"] = (-50, 0, 0)
        return R
    def talk(t):
        R = idle(t)
        g = math.sin(t * 5)
        R["UpperArm.R"] = (-45 + 10 * g, 0, -25)
        R["LowerArm.R"] = (-60 - 15 * g, 0, 0)
        return R
    return [("Idle", 4.0, True, idle, lambda t: (0, 0.25 + 0.05 * math.sin(2 * math.pi * t / 4.0), 0)),
            ("Talk", 2.0, True, talk, lambda t: (0, 0.25 + 0.05 * math.sin(2 * math.pi * t / 2.0), 0))]


# ------------------------------------------------------------------ Zkažený vlk (čtyřnožec)
def wolf_skeleton():
    J = [("Root", None, (0, 0, 0)), ("Hips", "Root", (0, 0.78, -0.42)), ("Spine", "Hips", (0, 0.82, -0.05)), ("Chest", "Spine", (0, 0.85, 0.32)),
         ("Neck", "Chest", (0, 0.95, 0.52)), ("Head", "Neck", (0, 1.05, 0.72)), ("Jaw", "Head", (0, 0.98, 0.8)), ("Tail", "Hips", (0, 0.85, -0.62))]
    for s, sx in (("L", 1), ("R", -1)):
        J += [("FrontUpper." + s, "Chest", (0.17 * sx, 0.78, 0.36)), ("FrontLower." + s, "FrontUpper." + s, (0.17 * sx, 0.42, 0.4)),
              ("FrontPaw." + s, "FrontLower." + s, (0.17 * sx, 0.06, 0.42)),
              ("BackUpper." + s, "Hips", (0.17 * sx, 0.74, -0.42)), ("BackLower." + s, "BackUpper." + s, (0.17 * sx, 0.4, -0.5)),
              ("BackPaw." + s, "BackLower." + s, (0.17 * sx, 0.06, -0.44))]
    return J


def wolf():
    sk = wolf_skeleton()
    B = Body(sk)
    P = B.pos
    FUR = dict(name="fur", roughness=0.9)
    fur = rgb("#3a3440")

    def furpaint(m, base=fur):
        m.paint(lambda Pp, N: np.asarray(base) * (0.65 + 0.45 * np.clip(N[:, 1:2] * 0.5 + 0.5, 0, 1)) * (0.85 + 0.3 * fbm(Pp * np.array([4, 12, 4]), 3, 2, 2)[:, None]))
        return m
    body_r = sphere(0.3, 14, 10).scale(0.9, 0.95, 1.0).translate(*P["Chest"])
    B.add(furpaint(displace(body_r, 0.03, 6, 1)), "Chest", "fur", FUR)
    belly = sphere(0.26, 12, 8).scale(0.85, 0.85, 1.3).translate(*P["Spine"])
    B.add(furpaint(belly), "Spine", "fur", FUR)
    rear = sphere(0.24, 12, 8).scale(0.95, 0.95, 1.1).translate(*P["Hips"])
    B.add(furpaint(rear), "Hips", "fur", FUR)
    neck = B.limb(P["Chest"] + np.array([0, 0.05, 0.1]), P["Head"], 0.16, 0.12, "Neck", "fur", FUR, fur)
    furpaint(neck)
    skull = sphere(0.15, 12, 9).scale(0.9, 0.85, 1.1).translate(*P["Head"])
    snout = lathe([(0.09, 0), (0.07, 0.12), (0.045, 0.22)], 10)
    align(snout, np.array([0, -0.15, 1.0])).translate(*(P["Head"] + np.array([0, -0.02, 0.1])))
    B.add(furpaint(merge(skull, snout)), "Head", "fur", FUR)
    nose = sphere(0.03, 6, 4).translate(*(P["Head"] + np.array([0, -0.05, 0.33]))).color(rgb("#111111"))
    B.add(nose, "Head", "fur", FUR)
    jaw = lathe([(0.06, 0), (0.035, 0.18)], 8)
    align(jaw, np.array([0, -0.25, 1.0])).translate(*(P["Jaw"] + np.array([0, -0.02, 0])))
    B.add(furpaint(jaw, rgb("#2a2430")), "Jaw", "fur", FUR)
    for sx in (1, -1):
        ear = cone(0.05, 0.13, 5).scale(1, 1, 0.5).rotate(-10, 0, -12 * sx).translate(*(P["Head"] + np.array([0.07 * sx, 0.1, -0.02])))
        B.add(furpaint(ear), "Head", "fur", FUR)
        e = sphere(0.022, 6, 4).translate(*(P["Head"] + np.array([0.065 * sx, 0.04, 0.12]))).color(rgb("#e8a0ff"))
        B.add(e, "Head", "eyes", glow(rgb("#c050ff"), 10, "eyes"))
        for j in range(2):
            fang = cone(0.012, 0.05, 4).rotate(180, 0, 0).translate(*(P["Head"] + np.array([0.03 * sx, -0.06, 0.26 - j * 0.04]))).color((0.95, 0.92, 0.85))
            B.add(fang, "Head", "fur", FUR)
    tail = B.limb(P["Tail"], P["Tail"] + np.array([0, -0.15, -0.55]), 0.09, 0.04, "Tail", "fur", FUR, fur)
    furpaint(tail)
    for s, sx in (("L", 1), ("R", -1)):
        for part in ("Front", "Back"):
            u, l, pw = P[part + "Upper." + s], P[part + "Lower." + s], P[part + "Paw." + s]
            furpaint(B.limb(u + np.array([0, 0.08, 0]), l, 0.085, 0.06, part + "Upper." + s, "fur", FUR, fur))
            furpaint(B.limb(l, pw, 0.055, 0.045, part + "Lower." + s, "fur", FUR, fur))
            paw = rounded_box(0.09, 0.06, 0.13, 0.025).translate(*(pw + np.array([0, -0.03, 0.03])))
            B.add(furpaint(paw, rgb("#2a2430")), part + "Paw." + s, "fur", FUR)
    # krystaly Umbria prorůstající hřbetem
    rng = np.random.default_rng(4)
    for j, bone in enumerate(["Hips", "Spine", "Spine", "Chest", "Chest", "Neck"]):
        base = P[bone] + np.array([rng.normal() * 0.06, 0.22 if bone != "Neck" else 0.1, rng.normal() * 0.08])
        c = crystal(0.18 + rng.random() * 0.22, 0.045, 5, 0.4, j).rotate(rng.normal() * 25, rng.random() * 360, rng.normal() * 25).translate(*base)
        B.add(c.color(rgb("#b070ff")), bone, "voidc", glow(rgb("#8a2ae0"), 4, "voidc"))
    return sk, B.build()


def wolf_clips():
    def legs(R, p, k, gallop=False):
        for part, off in (("Front", 0.0), ("Back", math.pi * (0.25 if gallop else 1.0))):
            for s, so in (("L", 0.0), ("R", math.pi if not gallop else 0.35)):
                ph = p + off + so
                R[part + "Upper." + s] = (-28 * k * math.sin(ph), 0, 0)
                R[part + "Lower." + s] = ((28 if part == "Front" else -30) * k * max(0, math.sin(ph + 1.3)), 0, 0)

    def idle(t):
        p = 2 * math.pi * t / 2.6
        b = math.sin(p)
        return {"Chest": (1.5 * b, 0, 0), "Head": (4 * math.sin(p + 1), 10 * math.sin(p * 0.5), 0), "Tail": (10 + 6 * b, 12 * math.sin(p * 0.7), 0),
                "Jaw": (4 + 4 * max(0, b), 0, 0)}
    def walk(t, dur=1.0):
        p = 2 * math.pi * t / dur
        R = {"Head": (3 * math.sin(p * 2), 0, 0), "Tail": (12, 10 * math.sin(p), 0)}
        legs(R, p, 1.0)
        return R
    def run(t, dur=0.55):
        p = 2 * math.pi * t / dur
        R = {"Head": (8 * math.sin(p), 0, 0), "Tail": (25, 0, 0), "Spine": (6 * math.sin(p), 0, 0), "Chest": (-6 * math.sin(p), 0, 0)}
        legs(R, p, 1.5, True)
        return R
    def bite(t, dur=0.8):
        u = t / dur
        lunge = env(u, 0.2, 0.4, 0.55, 0.9)
        crouch = env(u, 0.0, 0.2, 0.25, 0.4)
        R = {"Head": (-15 * crouch + 20 * lunge, 0, 0), "Jaw": (40 * env(u, 0.25, 0.4, 0.45, 0.55), 0, 0), "Chest": (10 * crouch - 12 * lunge, 0, 0),
             "FrontUpper.L": (-30 * lunge, 0, 0), "FrontUpper.R": (-30 * lunge, 0, 0), "BackUpper.L": (20 * crouch, 0, 0), "BackUpper.R": (20 * crouch, 0, 0)}
        return R
    def hit(t, dur=0.4):
        u = env(t / dur, 0, 0.2, 0.3, 1)
        return {"Head": (-20 * u, 15 * u, 0), "Chest": (-8 * u, 0, 0), "Tail": (-10 * u, 0, 0)}
    def death(t, dur=1.2):
        u = sm(t / dur)
        return {"Root": (0, 0, 88 * u), "Head": (10 * u, 0, -20 * u), "FrontUpper.L": (-30 * u, 0, 0), "BackUpper.L": (30 * u, 0, 0), "Tail": (-20 * u, 0, 0)}
    def howl(t, dur=2.0):
        u = env(t / dur, 0, 0.25, 0.75, 1)
        return {"Neck": (-45 * u, 0, 0), "Head": (-20 * u, 0, 0), "Jaw": (25 * u, 0, 0), "Chest": (-10 * u, 0, 0)}
    return [("Idle", 2.6, True, idle, None), ("Walk", 1.0, True, walk, lambda t: (0, 0.02 * abs(math.sin(2 * math.pi * t)), 0)),
            ("Run", 0.55, True, run, lambda t: (0, 0.05 * abs(math.sin(2 * math.pi * t / 0.55)), 0)),
            ("Attack1", 0.8, False, bite, lambda t: (0, 0, 0.25 * env(t / 0.8, 0.2, 0.4, 0.55, 0.9))),
            ("Hit", 0.4, False, hit, None), ("Death", 1.2, False, death, lambda t: (0, -0.45 * sm(t / 1.2), 0)),
            ("Howl", 2.0, False, howl, None)]


# ------------------------------------------------------------------ zbraně (kořen = úchop v dlani, čepel po −Y ruky / +Z)
def weapons():
    os.makedirs(WP, exist_ok=True)
    # sylvarský meč: dlouhá zahnutá čepel, zlatá záštita s krystalem
    blade = lathe([(0.03, 0), (0.035, 0.5), (0.025, 0.85), (0.001, 0.95)], 4).scale(1, 1, 0.18)
    blade.flat = True
    blade.translate(0, 0.08, 0).gradient(rgb("#c8d4e0"), rgb("#f4fbff"))
    guard = merge(box(0.22, 0.03, 0.04, (0, 0.07, 0)), sphere(0.025, 6, 4).translate(0.11, 0.07, 0), sphere(0.025, 6, 4).translate(-0.11, 0.07, 0)).color(rgb("#d9a840"))
    grip = cylinder(0.018, 0.018, 0.16, 8).translate(0, -0.09, 0).color(rgb("#4a3020"))
    gem = crystal(0.05, 0.015, 4, 0.5, 2).translate(0, 0.055, 0.02).color(rgb("#bff4ff"))
    write_glb(os.path.join(WP, "sword_sylvaria.glb"), [(blade, STEEL), (merge(guard), GOLD), (grip, LEATHER), (gem, glow(rgb("#4fe0ff"), 6))], name="Sword")
    # aethelgardský široký meč: těžká čepel s runami
    blade = box(0.1, 0.85, 0.02, (0, 0.5, 0))
    tip = lathe([(0.05, 0), (0.001, 0.12)], 4).scale(1, 1, 0.2).translate(0, 0.925, 0)
    tip.flat = True
    bm = merge(blade, tip).gradient(rgb("#6a7078"), rgb("#aab0b8"))
    runes = merge(*[box(0.03, 0.04, 0.025, (0, 0.25 + j * 0.13, 0)) for j in range(4)]).color(rgb("#ffb060"))
    guard = box(0.26, 0.05, 0.06, (0, 0.07, 0)).color(rgb("#b88a3a"))
    write_glb(os.path.join(WP, "sword_aethel.glb"), [(bm, STEEL), (guard, GOLD), (grip, LEATHER), (runes, glow(rgb("#ff8a2a"), 5))], name="Sword")
    # štíty (úchop na předloktí: střed štítu před rukou)
    for name, face, rim, emb in (("shield_sylvaria", rgb("#e6e2d8"), rgb("#d9a840"), rgb("#2a8f88")), ("shield_aethel", rgb("#59606b"), rgb("#b88a3a"), rgb("#8a1e1a"))):
        disc = lathe([(0.001, 0.06), (0.3, 0.03), (0.34, 0.0)], 20, False, True).rotate(90, 0, 0)
        disc.paint(lambda Pp, N, f=face, e=emb: np.where(np.hypot(Pp[:, 0:1], Pp[:, 1:2]) < 0.16, np.asarray(e), np.asarray(f)) *
                   (0.8 + 0.3 * np.clip(N[:, 2:3], 0, 1)))
        r = lathe([(0.33, -0.02), (0.36, 0.0), (0.33, 0.04)], 20, False, False).rotate(90, 0, 0).color(rim)
        boss = sphere(0.06, 10, 6).scale(1, 1, 0.6).translate(0, 0, 0.06).color(rim)
        write_glb(os.path.join(WP, name + ".glb"), [(disc, STEEL), (merge(r, boss), GOLD)], name="Shield")
    # hůl válečného mága: živé dřevo stočené kolem krystalu
    shaft = cylinder(0.025, 0.02, 1.6, 8).translate(0, -0.6, 0)
    displace(shaft, 0.006, 20, 3)
    shaft.gradient(rgb("#4a3a28"), rgb("#8a7050"))
    claw = merge(*[lathe([(0.02, 0), (0.008, 0.18)], 5).rotate(30, k * 120, 0).translate(0, 1.0, 0) for k in range(3)]).color(rgb("#8a7050"))
    orb = crystal(0.22, 0.05, 6, 0.4, 3).translate(0, 1.0, 0).color(rgb("#9ff0ff"))
    write_glb(os.path.join(WP, "staff.glb"), [(merge(shaft, claw), dict(name="wood", roughness=0.85)), (orb, glow(rgb("#4fd0ff"), 7))], name="Staff")
    # luk (svislý, úchop uprostřed)
    pts = [(0.0, -0.7), (0.08, -0.45), (0.11, 0.0), (0.08, 0.45), (0.0, 0.7)]
    limbs = []
    for (z0, y0), (z1, y1) in zip(pts[:-1], pts[1:]):
        L = math.hypot(z1 - z0, y1 - y0)
        seg = cylinder(0.02, 0.016, L, 6, False)
        align(seg, np.array([0, y1 - y0, z1 - z0])).translate(0, y0, z0)
        limbs.append(seg)
    bow = merge(*limbs).gradient(rgb("#5a4028"), rgb("#9a7a50"))
    string = box(0.004, 1.4, 0.004, (0, 0, -0.01)).color((0.9, 0.9, 0.85))
    write_glb(os.path.join(WP, "bow.glb"), [(bow, dict(name="wood", roughness=0.7)), (string, CLOTH)], name="Bow")
    # runová puška Aethelgardu
    barrel = cylinder(0.025, 0.025, 0.9, 8).rotate(90, 0, 0).translate(0, 0.04, 0.0)
    stock = box(0.06, 0.12, 0.4, (0, -0.02, -0.25))
    core = crystal(0.12, 0.03, 6, 0.4, 5).rotate(90, 0, 0).translate(0, 0.08, 0.15)
    write_glb(os.path.join(WP, "rifle.glb"), [(barrel.color(rgb("#4a4c52")), STEEL), (stock.color(rgb("#5a3a22")), dict(name="wood", roughness=0.8)),
              (merge(*[lathe([(0.035, -0.01), (0.04, 0), (0.035, 0.01)], 10, False, False).rotate(90, 0, 0).translate(0, 0.04, 0.2 + j * 0.2) for j in range(3)]).color(rgb("#b88a3a")), GOLD),
              (core.color(rgb("#ffd08a")), glow(rgb("#ff9a3a"), 6))], name="Rifle")


def main():
    """Postavy lidí jsou z KayKit Adventurers (tools/kaykit_variants.py); odsud jen Zkažený vlk."""
    os.makedirs(CH, exist_ok=True)
    sk, parts = wolf()
    write_glb(os.path.join(CH, "wolf.glb"), parts, sk, wolf_clips(), "Wolf")
    print(f"chars/wolf.glb: {os.path.getsize(os.path.join(CH, 'wolf.glb')) // 1024} KB")


if __name__ == "__main__":
    main()
