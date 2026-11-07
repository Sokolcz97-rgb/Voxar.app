#!/usr/bin/env python3
"""Azure Ocean a mořská monstra (podle „Herní dokumentace: Azurový oceán a mořská monstra“).

  python3 tools/eryndor_sea.py   -> Assets/Models/sea/*.glb

Kreslený (cel-shaded) styl: výrazné ploché barvy, zářící runy a korály a černé obrysy (inverted hull –
obrácená slupka kolem modelu, čistá silueta jako v anime / Genshin Impact). Monstra mají kostru a animace
(tuhé díly na kostech jako ostatní postavy Eryndoru, tools/eryndor_chars.py).

  leviathan.glb  Abyssal Leviathan – kříženec velryby a draka (~34 m), pancířové pláty, zářící runy, ploutve
  siren.glb      Coral Siren – nahoře víla s ostrými rysy a velkýma očima, dole krystalické korály, vlasy z chaluh
  eel.glb        Razorfin Eel – dlouhý úhoř (~9 m) ve tvaru S, elektricky modrý a žlutý, ploutve jako čepele
  coral_*.glb    zářící korály a mořské rostliny (útesy u pobřeží)
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from eryndor_chars import Body, align, env, rgb, sm  # noqa: E402
from meshkit import (cone, crystal, lathe, merge, outline, rounded_box, sphere, write_glb)  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "Assets", "Models", "sea")
INK = dict(name="ink", roughness=1.0)          # obrysy


def glow(c, s=4.0, name="glow"):
    return dict(name=name, roughness=0.3, emissive=c, emissive_strength=s)


def toon(name):
    return dict(name=name, roughness=0.55)


def finish(B, thickness):
    """Díly + obrysy kolem neprůsvitných dílů (zářící runy a oči obrys nemají – září přes něj)."""
    parts = B.build()
    inks = []
    for mesh, mat in parts:
        if mat.get("emissive") or mat is INK:
            continue
        inks.append(outline(mesh, thickness))
    if inks:
        parts.append((merge(*inks), INK))
    return parts


def flat(m, color, light=1.12, dark=0.78):
    """Cel-shading barvou vrcholů: dva tóny (světlý nahoře, stín dole) s ostrou hranou."""
    N = m.normals()
    k = np.where(N[:, 1:2] > -0.15, light, dark)
    m.C[:, :3] = np.asarray(color) * k
    return m


# ------------------------------------------------------------------ Abyssal Leviathan
def leviathan():
    L = 34.0
    # páteř po +Z (hlava vpředu), Hips uprostřed těla
    chain = [("Root", None, (0, 0, 0)), ("Hips", "Root", (0, 0, 0))]
    fwd = [("Chest", 4.5), ("Neck", 9.5), ("Head", 13.0), ("Jaw", 14.0)]
    prev = "Hips"
    for n, z in fwd:
        chain.append((n, prev if n != "Jaw" else "Head", (0, -0.6 if n == "Jaw" else 0, z)))
        if n != "Jaw":
            prev = n
    prev = "Hips"
    for i in range(1, 6):
        chain.append(("Tail%d" % i, prev, (0, 0, -3.6 * i)))
        prev = "Tail%d" % i
    chain.append(("Fluke", prev, (0, 0, -20.0)))
    for s, sx in (("L", 1), ("R", -1)):
        chain.append(("Fin." + s, "Chest", (3.0 * sx, -1.2, 5.0)))
    B = Body(chain)
    P = B.pos
    NAVY, TEAL, BELLY, PLATE = rgb("#13306a"), rgb("#1f8fa8"), rgb("#bfe4ea"), rgb("#2b4f8f")
    RUNE = rgb("#3ff4ff")
    SKIN = toon("hide")
    # trup: elipsoidy podél páteře (velryba), hřbet tmavý, břicho světlé
    prof = [("Head", 14.5, 2.6), ("Neck", 10.5, 3.5), ("Chest", 5.5, 4.2), ("Hips", 0.0, 4.0), ("Tail1", -4.5, 3.4),
            ("Tail2", -8.0, 2.7), ("Tail3", -11.5, 2.0), ("Tail4", -15.0, 1.4), ("Tail5", -18.0, 0.9)]
    for bone, z, r in prof:
        e = sphere(r, 18, 12).scale(1.0, 0.82, 1.35).translate(0, 0, z)
        e.paint(lambda Pp, N: np.where(N[:, 1:2] > -0.25, np.asarray(NAVY) * (1.0 + 0.25 * np.clip(N[:, 1:2], 0, 1)),
                                       np.asarray(BELLY)))
        B.add(e, bone, "hide", SKIN)
    # hlava: draci čenich a čelist se zuby
    snout = lathe([(2.3, 0), (1.8, 2.2), (0.9, 4.2), (0.3, 5.0)], 14)
    align(snout, np.array([0, -0.1, 1.0])).scale(1.0, 0.7, 1.0).translate(0, 0.2, 14.5)
    B.add(flat(snout, NAVY), "Head", "hide", SKIN)
    jaw = lathe([(2.0, 0), (1.5, 2.2), (0.6, 4.0)], 12)
    align(jaw, np.array([0, -0.2, 1.0])).scale(1.0, 0.45, 1.0).translate(0, -1.1, 14.6)
    B.add(flat(jaw, BELLY), "Jaw", "hide", SKIN)
    for i in range(9):
        for sx in (1, -1):
            t = cone(0.22, 0.8, 5).rotate(180, 0, 0).translate(sx * (1.5 - i * 0.14), -0.4, 15.0 + i * 0.42)
            B.add(t.color((0.97, 0.95, 0.9)), "Head", "teeth", toon("teeth"))
    for sx in (1, -1):
        eye = sphere(0.42, 10, 8).translate(sx * 1.7, 1.0, 16.2).color(RUNE)
        B.add(eye, "Head", "rune", glow(RUNE, 8, "rune"))
        horn = cone(0.5, 3.2, 6).rotate(-60, 0, -25 * sx).translate(sx * 1.2, 2.0, 13.0)
        B.add(flat(horn, PLATE), "Head", "plate", toon("plate"))
    # pancířové pláty na hřbetě (velké grafické tvary s jasnými okraji)
    for k, (bone, z, r) in enumerate(prof[1:]):
        pl = rounded_box(r * 1.5, 0.5, 3.0, 0.2).rotate(8, 0, 0).translate(0, r * 0.8, z)
        B.add(flat(pl, PLATE if k % 2 == 0 else TEAL), bone, "plate", toon("plate"))
        spike = cone(r * 0.25, r * 0.9, 4).translate(0, r * 0.95, z - 0.6)
        B.add(flat(spike, TEAL), bone, "plate", toon("plate"))
        # masivní magické runy podél boků
        for sx in (1, -1):
            for j in range(3):
                rune = rounded_box(0.25, 0.9 if j != 1 else 0.4, 0.8, 0.08).translate(sx * r * 0.98, -0.1 + (j - 1) * 0.55, z + (j - 1) * 0.9)
                B.add(rune.color(RUNE), bone, "rune", glow(RUNE, 6, "rune"))
    # ploutve a ocasní ploutev
    for s, sx in (("L", 1), ("R", -1)):
        fin = rounded_box(6.5, 0.35, 2.6, 0.15).translate(sx * 3.2, 0, 0).rotate(0, 15 * sx, -20 * sx).translate(*P["Fin." + s])
        B.add(flat(fin, TEAL), "Fin." + s, "fin", toon("fin"))
    fluke = rounded_box(12.0, 0.4, 3.4, 0.2)
    fl2 = cone(1.8, 4, 4).rotate(-90, 0, 0).scale(3.2, 0.12, 1.0).translate(0, 0, -1.5)
    B.add(flat(merge(fluke.translate(0, 0, -1.2), fl2), TEAL).translate(*P["Fluke"]), "Fluke", "fin", toon("fin"))
    return chain, finish(B, 0.22)


def leviathan_clips():
    names = ["Neck", "Head", "Hips", "Tail1", "Tail2", "Tail3", "Tail4", "Tail5", "Fluke"]

    def wave(t, dur, amp, speed=1.0):
        p = 2 * math.pi * t / dur * speed
        R = {}
        for i, n in enumerate(names):
            R[n] = (amp * (0.4 + i * 0.12) * math.sin(p - i * 0.7), 3 * math.sin(p * 0.5 - i * 0.4), 0)
        R["Fin.L"] = (0, 0, 15 * math.sin(p))
        R["Fin.R"] = (0, 0, -15 * math.sin(p))
        R["Jaw"] = (6 + 4 * math.sin(p * 0.5), 0, 0)
        return R

    def dive(t, dur=6.0):
        u = t / dur
        R = wave(t, 3.0, 7)
        R["Root"] = (-25 * env(u, 0.0, 0.25, 0.6, 1.0), 0, 0)   # nos pod hladinu, ocas nahoře
        R["Fluke"] = (40 * env(u, 0.3, 0.55, 0.8, 1.0), 0, 0)
        return R

    def roar(t, dur=2.5):
        u = env(t / dur, 0, 0.2, 0.7, 1)
        return {"Neck": (-25 * u, 0, 0), "Head": (-15 * u, 0, 0), "Jaw": (35 * u, 0, 0), "Fin.L": (0, 0, 30 * u), "Fin.R": (0, 0, -30 * u)}
    return [("Swim", 4.0, True, lambda t: wave(t, 4.0, 6), lambda t: (0, 0.6 * math.sin(2 * math.pi * t / 4.0), 0)),
            ("Idle", 6.0, True, lambda t: wave(t, 6.0, 3), None),
            ("Dive", 6.0, False, dive, lambda t: (0, -9 * env(t / 6.0, 0.1, 0.5, 0.7, 1.0), 0)),
            ("Roar", 2.5, False, roar, None)]


# ------------------------------------------------------------------ Coral Siren
def siren_skeleton():
    J = [("Root", None, (0, 0, 0)), ("Hips", "Root", (0, 0.9, 0)), ("Spine", "Hips", (0, 1.15, 0)), ("Chest", "Spine", (0, 1.45, 0)),
         ("Neck", "Chest", (0, 1.78, 0)), ("Head", "Neck", (0, 1.9, 0)),
         ("Tail1", "Hips", (0, 0.65, -0.05)), ("Tail2", "Tail1", (0, 0.35, -0.2)), ("Tail3", "Tail2", (0, 0.12, -0.5)),
         ("Hair", "Head", (0, 2.1, -0.08))]
    for s, sx in (("L", 1), ("R", -1)):
        J += [("UpperArm." + s, "Chest", (0.24 * sx, 1.68, 0)), ("LowerArm." + s, "UpperArm." + s, (0.28 * sx, 1.4, 0.02)),
              ("Hand." + s, "LowerArm." + s, (0.3 * sx, 1.15, 0.05))]
    return J


def siren():
    sk = siren_skeleton()
    B = Body(sk)
    P = B.pos
    SKIN_C, PINK, PURP, KELP, EYE = rgb("#bfe6e8"), rgb("#ff5fae"), rgb("#9a3df0"), rgb("#2fbf7f"), rgb("#fff07a")
    SK = toon("skin")
    # trup: štíhlý, ostře řezaný
    torso = sphere(0.2, 12, 10).scale(1.0, 1.5, 0.75).translate(0, 1.42, 0)
    B.add(flat(torso, SKIN_C), "Chest", "skin", SK)
    waist = sphere(0.16, 10, 8).scale(1.0, 1.4, 0.75).translate(0, 1.12, 0)
    B.add(flat(waist, SKIN_C), "Spine", "skin", SK)
    B.limb(P["Chest"] + np.array([0, 0.22, 0]), P["Head"], 0.05, 0.045, "Neck", "skin", SK, SKIN_C)
    head = sphere(0.13, 12, 10).scale(0.85, 1.05, 0.95).translate(*(P["Head"] + np.array([0, 0.08, 0])))
    chin = cone(0.08, 0.12, 6).rotate(180, 0, 0).scale(1, 1, 0.8).translate(*(P["Head"] + np.array([0, -0.02, 0.03])))
    B.add(flat(merge(head, chin), SKIN_C), "Head", "skin", SK)
    for sx in (1, -1):   # velké uhrančivé oči
        e = sphere(0.04, 8, 6).scale(1.2, 0.8, 0.5).translate(*(P["Head"] + np.array([0.05 * sx, 0.1, 0.11]))).color(EYE)
        B.add(e, "Head", "eyes", glow(EYE, 9, "eyes"))
        ear = cone(0.03, 0.16, 4).rotate(0, 0, -70 * sx).translate(*(P["Head"] + np.array([0.12 * sx, 0.12, 0])))   # ostré ploutvové uši
        B.add(flat(ear, PINK), "Head", "fin", toon("fin"))
    # vlasy jako vznášející se chaluhy (kosti Hair – vlní se)
    rng = np.random.default_rng(3)
    strands = []
    for i in range(9):
        a = i / 9 * math.pi * 1.3 - math.pi * 0.65
        st = lathe([(0.035, 0), (0.03, 0.3), (0.02, 0.6), (0.004, 0.85)], 5)
        align(st, np.array([math.sin(a) * 0.8, 0.5 + rng.random() * 0.4, -0.9]))
        st.translate(*(P["Hair"] + np.array([math.sin(a) * 0.09, 0, -0.03])))
        strands.append(flat(st, KELP))
    B.add(merge(*strands), "Hair", "kelp", toon("kelp"))
    # paže (ostré prsty-drápy)
    for s, sx in (("L", 1), ("R", -1)):
        B.limb(P["UpperArm." + s], P["LowerArm." + s], 0.045, 0.04, "UpperArm." + s, "skin", SK, SKIN_C)
        B.limb(P["LowerArm." + s], P["Hand." + s], 0.04, 0.032, "LowerArm." + s, "skin", SK, SKIN_C)
        for k in range(3):
            claw = cone(0.012, 0.12, 4).rotate(180, 0, 0).translate(*(P["Hand." + s] + np.array([0.02 * sx + (k - 1) * 0.015, -0.05, 0.02])))
            B.add(flat(claw, PURP), "Hand." + s, "coral", toon("coral"))
        fin = cone(0.05, 0.25, 4).rotate(0, 0, 100 * sx).scale(1, 1, 0.2).translate(*(P["LowerArm." + s] + np.array([0.05 * sx, -0.08, -0.04])))
        B.add(flat(fin, PINK), "LowerArm." + s, "fin", toon("fin"))
    # dolní polovina: krystalické korály a ostré ploutve (ocas se stáčí)
    for bone, y, r, n in (("Hips", 0.92, 0.2, 7), ("Tail1", 0.62, 0.22, 9), ("Tail2", 0.32, 0.2, 9), ("Tail3", 0.1, 0.16, 8)):
        base = sphere(r, 10, 8).scale(1.1, 1.2, 1.0).translate(0, y, -0.05 - (0.4 - y) * 0.5)
        B.add(flat(base, PURP), bone, "coral", toon("coral"))
        for j in range(n):
            a = j / n * 2 * math.pi + y
            c = crystal(0.18 + rng.random() * 0.22, 0.045, 5, 0.4, j + int(y * 10))
            c.rotate(math.degrees(math.cos(a)) * 0.9, 0, -math.degrees(math.sin(a)) * 0.9)
            c.translate(math.sin(a) * r * 0.9, y + rng.normal() * 0.05, -0.05 - (0.4 - y) * 0.5 + math.cos(a) * r * 0.8)
            col, nm = (PINK, "crystal_pink") if j % 2 else (PURP, "crystal_purple")
            B.add(c.color(col), bone, nm, glow(col, 2.2, nm))
    tailfin = merge(*[cone(0.12, 0.6, 4).rotate(-90 + k * 25, 0, 0).scale(1.6, 1, 0.25) for k in (-1, 0, 1)])
    tailfin.translate(*(P["Tail3"] + np.array([0, -0.05, -0.35])))
    B.add(flat(tailfin, PINK), "Tail3", "fin", toon("fin"))
    return sk, finish(B, 0.018)


def siren_clips():
    def sway(t, dur, k=1.0):
        p = 2 * math.pi * t / dur
        return {"Tail1": (8 * k * math.sin(p), 0, 0), "Tail2": (14 * k * math.sin(p - 0.8), 0, 0), "Tail3": (20 * k * math.sin(p - 1.6), 0, 0),
                "Hair": (-15 + 10 * math.sin(p * 0.7), 8 * math.sin(p * 0.5), 0), "Chest": (3 * math.sin(p), 0, 0),
                "UpperArm.L": (10 * math.sin(p), 0, -15), "UpperArm.R": (10 * math.sin(p + 1), 0, 15)}

    def attack(t, dur=0.9):
        u = t / dur
        a = env(u, 0.0, 0.35, 0.5, 0.9)
        s = env(u, 0.35, 0.5, 0.6, 0.9)
        R = sway(t, 2.0, 0.5)
        R.update({"UpperArm.R": (-80 * a - 40 * s, 0, 40 * a), "LowerArm.R": (-40 * a + 30 * s, 0, 0), "Chest": (-10 * a + 15 * s, 20 * s, 0),
                  "Head": (-10 * a, 0, 0), "UpperArm.L": (-40 * s, 0, -30)})
        return R

    def hit(t, dur=0.4):
        u = env(t / dur, 0, 0.2, 0.3, 1)
        return {"Chest": (-15 * u, 10 * u, 0), "Head": (-20 * u, 0, 0), "Tail2": (20 * u, 0, 0)}

    def death(t, dur=1.6):
        u = sm(t / dur)
        return {"Root": (-70 * u, 0, 0), "Chest": (-20 * u, 0, 0), "UpperArm.L": (-60 * u, 0, -40 * u), "UpperArm.R": (-60 * u, 0, 40 * u)}
    return [("Idle", 2.4, True, lambda t: sway(t, 2.4), lambda t: (0, 0.06 * math.sin(2 * math.pi * t / 2.4), 0)),
            ("Swim", 1.2, True, lambda t: sway(t, 1.2, 1.6), lambda t: (0, 0.08 * math.sin(2 * math.pi * t / 1.2), 0)),
            ("Attack", 0.9, False, attack, None), ("Hit", 0.4, False, hit, None),
            ("Death", 1.6, False, death, lambda t: (0, -1.2 * sm(t / 1.6), 0))]


# ------------------------------------------------------------------ Razorfin Eel
EEL_SEG = 10


def eel():
    J = [("Root", None, (0, 0, 0)), ("Hips", "Root", (0, 0.3, 0))]
    prev = "Hips"
    J.append(("Head", "Hips", (0, 0.3, 4.2)))
    J.append(("Jaw", "Head", (0, 0.15, 4.4)))
    for i in range(1, EEL_SEG + 1):
        J.append(("Seg%d" % i, prev, (0, 0.3, 4.0 - i * 0.85)))
        prev = "Seg%d" % i
    B = Body(J)
    BLUE, YEL, DARK = rgb("#1f6bff"), rgb("#ffd21f"), rgb("#0a1a4a")
    SK = toon("eel")
    # hlava: klínovitá, s čelistí plnou zubů
    head = sphere(0.5, 14, 10).scale(0.85, 0.75, 1.5).translate(0, 0.3, 4.5)
    B.add(flat(head, BLUE), "Head", "eel", SK)
    jaw = sphere(0.36, 10, 8).scale(0.8, 0.45, 1.45).translate(0, 0.0, 4.65)
    B.add(flat(jaw, YEL), "Jaw", "eel", SK)
    for sx in (1, -1):
        e = sphere(0.09, 8, 6).translate(sx * 0.3, 0.5, 5.0).color(YEL)
        B.add(e, "Head", "eyes", glow(YEL, 10, "eyes"))
        for k in range(5):
            tooth = cone(0.035, 0.16, 4).rotate(180, 0, 0).translate(sx * (0.24 - k * 0.03), 0.12, 4.75 + k * 0.17)
            B.add(tooth.color((0.98, 0.98, 0.95)), "Head", "teeth", toon("teeth"))
    # tělo: pruhy elektrická modrá / žlutá, zužuje se
    for i in range(1, EEL_SEG + 1):
        r = 0.48 * (1 - (i - 1) / (EEL_SEG + 2)) + 0.06
        z = 4.0 - i * 0.85 + 0.4
        seg = sphere(r, 12, 8).scale(0.85, 0.95, max(1.35, 0.62 / r)).translate(0, 0.3, z)   # segmenty se překrývají
        B.add(flat(seg, YEL if i % 3 == 0 else BLUE), "Seg%d" % i, "eel", SK)
        # ploutve jako ozubené čepele (hřbet a boky)
        blade = cone(r * 0.9, r * 2.4, 3).scale(0.18, 1, 1.4).rotate(-25, 0, 0).translate(0, 0.3 + r * 0.8, z)
        B.add(flat(blade, YEL), "Seg%d" % i, "blade", toon("blade"))
        if i % 2 == 1:
            for sx in (1, -1):
                sb = cone(r * 0.5, r * 1.6, 3).scale(0.15, 1, 1.2).rotate(-30, 0, -100 * sx).translate(sx * r * 0.8, 0.3, z)
                B.add(flat(sb, YEL), "Seg%d" % i, "blade", toon("blade"))
        # svítící elektrické tečky podél boků
        for sx in (1, -1):
            d = sphere(r * 0.12, 6, 4).translate(sx * r * 0.82, 0.32, z).color(rgb("#7fe8ff"))
            B.add(d, "Seg%d" % i, "spark", glow(rgb("#5fdcff"), 7, "spark"))
    tail = cone(0.25, 1.4, 3).scale(0.15, 1, 1).rotate(-90, 0, 0).translate(0, 0.3, 4.0 - EEL_SEG * 0.85 - 0.3)
    B.add(flat(tail, YEL), "Seg%d" % EEL_SEG, "blade", toon("blade"))
    return J, finish(B, 0.045)


def eel_clips():
    def s_wave(t, dur, amp, lift=0.0):
        p = 2 * math.pi * t / dur
        R = {"Seg%d" % i: (lift * math.sin(p - i * 0.5), amp * math.sin(p - i * 0.62), 0) for i in range(1, EEL_SEG + 1)}
        R["Head"] = (0, -amp * 0.6 * math.sin(p + 0.6), 0)
        R["Jaw"] = (8 + 6 * math.sin(p * 2), 0, 0)
        return R

    def attack(t, dur=0.7):
        u = t / dur
        a = env(u, 0.0, 0.3, 0.35, 0.5)
        s = env(u, 0.3, 0.45, 0.55, 0.9)
        R = s_wave(t, 0.7, 10)
        R["Head"] = (-25 * a + 15 * s, 0, 0)
        R["Jaw"] = (50 * a, 0, 0)
        for i in range(1, 4):
            R["Seg%d" % i] = (12 * a, 30 * a * (1 if i % 2 else -1), 0)
        return R

    def hit(t, dur=0.4):
        u = env(t / dur, 0, 0.2, 0.3, 1)
        return {"Head": (-20 * u, 25 * u, 0), "Seg1": (0, -20 * u, 0), "Seg2": (0, 20 * u, 0)}

    def death(t, dur=1.5):
        u = sm(t / dur)
        R = {"Root": (0, 0, 170 * u)}
        R.update({"Seg%d" % i: (0, 6 * u, 0) for i in range(1, EEL_SEG + 1)})
        return R
    return [("Idle", 2.2, True, lambda t: s_wave(t, 2.2, 14), lambda t: (0, 0.1 * math.sin(2 * math.pi * t / 2.2), 0)),
            ("Swim", 0.9, True, lambda t: s_wave(t, 0.9, 24), None),
            ("Attack", 0.7, False, attack, lambda t: (0, 0.3 * env(t / 0.7, 0.2, 0.35, 0.5, 0.9), 0.9 * env(t / 0.7, 0.3, 0.45, 0.55, 0.9))),
            ("Hit", 0.4, False, hit, None), ("Death", 1.5, False, death, lambda t: (0, -0.5 * sm(t / 1.5), 0))]


# ------------------------------------------------------------------ zářící korály a rostliny (útesy)
def coral(seed, out):
    rng = np.random.default_rng(seed)
    parts, ink = {}, []
    cols = [rgb("#ff4fd0"), rgb("#3ff4ff"), rgb("#8a5bff"), rgb("#3fffa8")]
    rock = sphere(1.2, 12, 8).scale(1.4, 0.5, 1.2)
    rock = flat(rock, rgb("#3a4a6a"))
    for i in range(14):
        a, d = rng.random() * 2 * math.pi, rng.random() * 1.2
        h = 0.8 + rng.random() * 2.2
        c = cols[i % len(cols)]
        if i % 3 == 0:   # větvený korál
            br = []
            for k in range(4):
                b = lathe([(0.12, 0), (0.08, h * 0.5), (0.03, h)], 6)
                align(b, np.array([rng.normal() * 0.5, 1.0, rng.normal() * 0.5]))
                br.append(b)
            m = merge(*br)
        elif i % 3 == 1:  # krystalový korál
            m = crystal(h, 0.18, 5, 0.35, seed + i)
        else:             # chaluha / mořská rostlina
            m = lathe([(0.1, 0), (0.07, h * 0.6), (0.01, h * 1.3)], 5).scale(1, 1, 0.3)
        m.translate(math.cos(a) * d, 0.3, math.sin(a) * d)
        parts.setdefault(i % len(cols), []).append(m.color(c))   # emise bere barvu z materiálu -> materiál na barvu
        ink.append(outline(m, 0.03))
    glowing = [(merge(*ms), glow(cols[k], 3.0, "coral%d" % k)) for k, ms in parts.items()]
    write_glb(out, [(rock, toon("reef")), (outline(rock, 0.04), INK)] + glowing + [(merge(*ink), INK)], name="Coral")


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, build, clips in (("leviathan", leviathan, leviathan_clips), ("siren", siren, siren_clips), ("eel", eel, eel_clips)):
        sk, parts = build()
        path = os.path.join(OUT, name + ".glb")
        write_glb(path, parts, skeleton=sk, animations=clips(), name=name.capitalize())
        print("%s: %d KB" % (path, os.path.getsize(path) // 1024))
    for i in range(3):
        coral(10 + i, os.path.join(OUT, "coral_%d.glb" % i))
    print("korály hotové")


if __name__ == "__main__":
    main()
