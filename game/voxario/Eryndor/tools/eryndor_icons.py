#!/usr/bin/env python3
"""Ikony dovedností, talentů a kované rámy HUD Eryndoru (vlastní tvorba, kreslené kódem).

  python3 tools/eryndor_icons.py   -> Assets/UI/icons/<id>.png (128 px), Assets/UI/hud/*.png

Ikona = malované pozadí v barvě kouzla (radiální přechod, jiskry), symbol podle druhu dovednosti s jemnou září
a kovový rám; HUD rámy = tepané železo s nýty a zlatou linkou (9-slice pro ui.panel).
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS = os.path.join(HERE, "..", "Assets", "UI", "icons")
HUD = os.path.join(HERE, "..", "Assets", "UI", "hud")
S = 128

# id ikony -> (symbol, barva rgb 0..1)
SKILLS = {
    # Duchovní rytíř
    "knight_1": ("slash", (0.35, 0.85, 1.0)), "knight_2": ("shield", (0.9, 0.85, 0.5)), "knight_3": ("whirl", (0.5, 0.9, 0.7)),
    "knight_4": ("heal", (0.4, 1.0, 0.8)), "knight_5": ("horn", (1.0, 0.75, 0.3)),
    # Válečná mágyně
    "mage_1": ("bolt", (0.35, 0.8, 1.0)), "mage_2": ("frost", (0.6, 0.9, 1.0)), "mage_3": ("crystal", (0.7, 0.5, 1.0)),
    "mage_4": ("leaf", (0.5, 0.8, 0.5)), "mage_5": ("mana", (0.3, 0.5, 1.0)),
    # Těžkooděnec
    "warden_1": ("chop", (1.0, 0.6, 0.3)), "warden_2": ("rune", (1.0, 0.8, 0.4)), "warden_3": ("whirl", (0.9, 0.5, 0.3)),
    "warden_4": ("horn", (1.0, 0.4, 0.2)), "warden_5": ("crystal", (1.0, 0.7, 0.3)),
    # Inženýrka
    "engineer_1": ("aim", (1.0, 0.7, 0.3)), "engineer_2": ("bomb", (1.0, 0.5, 0.2)), "engineer_3": ("arrow", (0.6, 0.8, 1.0)),
    "engineer_4": ("feather", (0.8, 0.8, 0.8)), "engineer_5": ("potion", (1.0, 0.3, 0.3)),
    # společné
    "attack": ("slash", (0.95, 0.35, 0.25)), "target": ("aim", (0.85, 0.8, 0.55)), "potion_hp": ("potion", (1.0, 0.25, 0.25)),
    "potion_mp": ("potion", (0.25, 0.45, 1.0)), "empty": ("none", (0.25, 0.25, 0.28)),
    # aktivní talenty
    "t_knight_bulwark": ("shield", (0.6, 0.85, 1.0)), "t_knight_judg": ("sun", (1.0, 0.85, 0.35)), "t_knight_spring": ("heal", (0.3, 1.0, 0.9)),
    "t_mage_nova": ("frost", (0.75, 0.95, 1.0)), "t_mage_meteor": ("flame", (1.0, 0.45, 0.15)), "t_mage_blink": ("feather", (0.7, 0.6, 1.0)),
    "t_warden_cleave": ("chop", (1.0, 0.35, 0.2)), "t_warden_wall": ("shield", (0.9, 0.7, 0.4)), "t_warden_rune": ("rune", (1.0, 0.95, 0.5)),
    "t_engineer_volley": ("arrow", (1.0, 0.75, 0.35)), "t_engineer_mine": ("bomb", (1.0, 0.3, 0.1)), "t_engineer_turret": ("gear", (0.75, 0.8, 0.85)),
    # pasivní talenty (čtverce)
    "p_atk": ("sword", (0.95, 0.45, 0.3)), "p_def": ("shield", (0.7, 0.75, 0.85)), "p_hp": ("heart", (1.0, 0.3, 0.35)),
    "p_mp": ("mana", (0.35, 0.55, 1.0)), "p_crit": ("star", (1.0, 0.85, 0.3)), "p_cdr": ("clock", (0.6, 0.9, 0.95)),
    "p_matk": ("bolt", (0.6, 0.5, 1.0)),
}


def c255(c, k=1.0, a=255):
    return (int(max(0, min(1, c[0] * k)) * 255), int(max(0, min(1, c[1] * k)) * 255), int(max(0, min(1, c[2] * k)) * 255), a)


def background(col, seed):
    rnd = random.Random(seed)
    img = Image.new("RGBA", (S, S))
    px = img.load()
    for y in range(S):
        for x in range(S):
            dx, dy = (x - S * 0.45) / S, (y - S * 0.4) / S
            r = math.sqrt(dx * dx + dy * dy)
            k = max(0.0, 1.0 - r * 1.5)
            n = 0.85 + 0.15 * math.sin(x * 0.21 + y * 0.13 + seed) * math.sin(y * 0.17 - x * 0.07)
            px[x, y] = c255(col, (0.18 + 0.75 * k * k) * n)
    d = ImageDraw.Draw(img)
    for _ in range(14):   # jiskry
        x, y, s = rnd.uniform(10, S - 10), rnd.uniform(10, S - 10), rnd.uniform(1, 3)
        d.ellipse((x - s, y - s, x + s, y + s), fill=c255(col, 1.6, 150))
    return img


def glyph(kind, col):
    g = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    W = (255, 250, 235, 255)
    G = c255((1.0, 0.85, 0.45))
    c = S / 2
    if kind in ("slash", "chop", "sword"):
        if kind == "sword":
            d.polygon([(c - 6, 24), (c + 6, 24), (c + 5, 84), (c - 5, 84)], fill=W)
            d.polygon([(c - 6, 24), (c + 6, 24), (c, 12)], fill=W)
            d.rectangle((c - 22, 84, c + 22, 92), fill=G)
            d.rectangle((c - 5, 92, c + 5, 112), fill=(120, 80, 50, 255))
        else:
            for i in range(3 if kind == "slash" else 1):
                off = i * 14 - 14
                d.arc((14 + off, 14 - off, S - 14 + off, S - 14 - off), 200, 330, fill=W, width=9 - i * 2)
            if kind == "chop":
                d.polygon([(40, 30), (96, 40), (84, 70), (52, 60)], fill=(220, 225, 235, 255))
                d.line((60, 55, 30, 112), fill=(120, 80, 50, 255), width=8)
    elif kind == "shield":
        d.polygon([(c - 34, 24), (c + 34, 24), (c + 30, 70), (c, 108), (c - 30, 70)], fill=(200, 205, 215, 255), outline=G)
        d.polygon([(c - 24, 32), (c + 24, 32), (c + 21, 66), (c, 94), (c - 21, 66)], fill=c255(col, 0.9))
        d.line((c, 34, c, 92), fill=G, width=5)
    elif kind == "whirl":
        for i in range(4):
            a0 = i * 90
            d.arc((20, 20, S - 20, S - 20), a0, a0 + 70, fill=W, width=8)
            d.arc((38, 38, S - 38, S - 38), a0 + 40, a0 + 100, fill=W, width=6)
    elif kind in ("heal", "heart"):
        if kind == "heart":
            d.ellipse((26, 30, 66, 70), fill=W)
            d.ellipse((62, 30, 102, 70), fill=W)
            d.polygon([(28, 58), (100, 58), (64, 104)], fill=W)
        else:
            d.rectangle((c - 10, 26, c + 10, 102), fill=W)
            d.rectangle((26, c - 10, 102, c + 10), fill=W)
    elif kind == "horn":
        d.polygon([(30, 40), (98, 26), (104, 46), (36, 70)], fill=G)
        d.ellipse((90, 20, 110, 52), outline=W, width=5)
        for i in range(3):
            d.arc((70 + i * 8, 40 - i * 8, 120 + i * 8, 90 + i * 8), 300, 30, fill=W, width=3)
    elif kind == "bolt":
        d.polygon([(70, 14), (36, 70), (60, 70), (50, 114), (92, 52), (66, 52)], fill=W)
    elif kind == "frost":
        for i in range(6):
            a = math.radians(i * 60)
            x2, y2 = c + math.cos(a) * 46, c + math.sin(a) * 46
            d.line((c, c, x2, y2), fill=W, width=6)
            for t in (0.55, 0.8):
                bx, by = c + math.cos(a) * 46 * t, c + math.sin(a) * 46 * t
                for s in (-1, 1):
                    a2 = a + s * 0.7
                    d.line((bx, by, bx + math.cos(a2) * 12, by + math.sin(a2) * 12), fill=W, width=4)
    elif kind == "crystal":
        for dx, h, w in ((-22, 54, 18), (0, 80, 24), (24, 46, 16)):
            d.polygon([(c + dx, c - h / 2 - 8), (c + dx + w / 2, c - h / 2 + 8), (c + dx + w / 2, c + h / 2), (c + dx - w / 2, c + h / 2),
                       (c + dx - w / 2, c - h / 2 + 8)], fill=c255(col, 1.7), outline=W)
    elif kind == "leaf":
        d.ellipse((30, 26, 98, 102), fill=W)
        d.line((40, 100, 92, 30), fill=c255(col, 0.6), width=5)
    elif kind == "mana":
        d.ellipse((34, 34, 94, 94), outline=W, width=8)
        d.ellipse((50, 50, 78, 78), fill=W)
        for i in range(8):
            a = math.radians(i * 45)
            d.line((c + math.cos(a) * 36, c + math.sin(a) * 36, c + math.cos(a) * 52, c + math.sin(a) * 52), fill=W, width=4)
    elif kind == "rune":
        d.polygon([(c, 18), (104, c), (c, 110), (24, c)], outline=G, fill=None)
        d.line((c, 30, c, 98), fill=W, width=7)
        d.line((c, 52, c + 22, 36), fill=W, width=6)
        d.line((c, 70, c - 22, 86), fill=W, width=6)
    elif kind in ("aim", "target"):
        d.ellipse((24, 24, 104, 104), outline=W, width=6)
        d.ellipse((46, 46, 82, 82), outline=W, width=5)
        for x1, y1, x2, y2 in ((c, 14, c, 40), (c, 88, c, 114), (14, c, 40, c), (88, c, 114, c)):
            d.line((x1, y1, x2, y2), fill=W, width=5)
    elif kind == "bomb":
        d.ellipse((26, 40, 94, 108), fill=(40, 40, 46, 255), outline=W, width=4)
        d.line((80, 44, 96, 24), fill=(160, 130, 90, 255), width=5)
        d.ellipse((90, 12, 108, 30), fill=c255((1.0, 0.8, 0.3)))
    elif kind == "arrow":
        d.line((24, 104, 100, 28), fill=W, width=6)
        d.polygon([(100, 28), (78, 32), (96, 50)], fill=W)
        d.polygon([(24, 104), (24, 86), (40, 100)], fill=G)
    elif kind == "feather":
        d.ellipse((44, 14, 84, 110), fill=W)
        d.line((70, 20, 50, 116), fill=c255(col, 0.5), width=4)
    elif kind == "potion":
        d.rectangle((54, 18, 74, 40), fill=(200, 180, 140, 255))
        d.ellipse((30, 38, 98, 108), fill=(230, 235, 240, 200), outline=W, width=4)
        d.chord((34, 42, 94, 104), 10, 170, fill=c255(col, 1.3))
    elif kind == "sun":
        d.ellipse((40, 40, 88, 88), fill=G)
        for i in range(12):
            a = math.radians(i * 30)
            d.line((c + math.cos(a) * 30, c + math.sin(a) * 30, c + math.cos(a) * 54, c + math.sin(a) * 54), fill=W, width=5)
    elif kind == "flame":
        d.polygon([(c, 12), (98, 70), (86, 104), (c, 116), (42, 104), (30, 70), (52, 60), (54, 30)], fill=c255((1.0, 0.6, 0.15)))
        d.polygon([(c, 46), (82, 84), (c, 108), (46, 84)], fill=c255((1.0, 0.95, 0.5)))
    elif kind == "gear":
        d.ellipse((30, 30, 98, 98), fill=(190, 195, 205, 255))
        for i in range(8):
            a = math.radians(i * 45)
            d.rectangle((c + math.cos(a) * 38 - 8, c + math.sin(a) * 38 - 8, c + math.cos(a) * 38 + 8, c + math.sin(a) * 38 + 8),
                        fill=(190, 195, 205, 255))
        d.ellipse((50, 50, 78, 78), fill=c255(col, 0.6))
    elif kind == "star":
        pts = []
        for i in range(10):
            a = math.radians(i * 36 - 90)
            r = 50 if i % 2 == 0 else 20
            pts.append((c + math.cos(a) * r, c + math.sin(a) * r))
        d.polygon(pts, fill=W)
    elif kind == "clock":
        d.ellipse((24, 24, 104, 104), outline=W, width=7)
        d.line((c, c, c, 40), fill=W, width=6)
        d.line((c, c, 86, 74), fill=W, width=6)
    return g


def icon(name, kind, col, seed):
    img = background(col, seed)
    if kind != "none":
        g = glyph(kind, col)
        glow = g.filter(ImageFilter.GaussianBlur(6))
        tint = Image.new("RGBA", (S, S), c255(col, 1.5, 0))
        tint.putalpha(glow.getchannel("A").point(lambda a: int(a * 0.9)))
        img = Image.alpha_composite(img, tint)
        shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        shadow.paste((0, 0, 0, 170), (3, 4), g.getchannel("A"))
        img = Image.alpha_composite(img, shadow)
        img = Image.alpha_composite(img, g)
    # kovový rám
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, S - 1, S - 1), outline=(30, 26, 20, 255), width=6)
    d.rectangle((5, 5, S - 6, S - 6), outline=(150, 120, 70, 255), width=2)
    d.rectangle((7, 7, S - 8, S - 8), outline=(40, 34, 26, 200), width=1)
    img.save(os.path.join(ICONS, name + ".png"))


def forged(path, w, h, border=22, gold=True):
    """Tepané železo s nýty a zlatou linkou (9-slice: okraj `border` px)."""
    rnd = random.Random(w * 7 + h)
    img = Image.new("RGBA", (w, h))
    px = img.load()
    for y in range(h):
        for x in range(w):
            edge = min(x, y, w - 1 - x, h - 1 - y)
            n = rnd.random() * 0.12
            if edge < border:   # kovový okraj
                k = 0.32 + 0.25 * (1 - edge / border) * (0.6 + 0.4 * math.sin(edge * 0.6)) + n
                px[x, y] = (int(80 * k + 20), int(76 * k + 18), int(72 * k + 16), 255)
            else:               # vnitřek: tmavá kůže / látka, poloprůhledná
                k = 0.08 + n * 0.3
                px[x, y] = (int(28 * k * 6), int(24 * k * 6), int(20 * k * 6), 225)
    d = ImageDraw.Draw(img)
    if gold:
        d.rectangle((border - 4, border - 4, w - border + 3, h - border + 3), outline=(196, 160, 88, 255), width=2)
    d.rectangle((1, 1, w - 2, h - 2), outline=(18, 16, 14, 255), width=3)
    for (x, y) in ((border // 2, border // 2), (w - border // 2, border // 2), (border // 2, h - border // 2), (w - border // 2, h - border // 2)):
        d.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(160, 150, 130, 255), outline=(40, 36, 30, 255))
        d.ellipse((x - 2, y - 3, x + 1, y), fill=(230, 220, 200, 255))
    img.save(path)


def main():
    os.makedirs(ICONS, exist_ok=True)
    os.makedirs(HUD, exist_ok=True)
    for i, (name, (kind, col)) in enumerate(sorted(SKILLS.items())):
        icon(name, kind, col, i * 13 + 5)
    forged(os.path.join(HUD, "frame.png"), 128, 128, 22)
    forged(os.path.join(HUD, "frame_thin.png"), 96, 96, 14)
    # sloty lišty: tmavá jamka
    slot = Image.new("RGBA", (96, 96), (12, 10, 8, 235))
    d = ImageDraw.Draw(slot)
    d.rectangle((0, 0, 95, 95), outline=(24, 20, 16, 255), width=4)
    d.rectangle((4, 4, 91, 91), outline=(110, 90, 54, 255), width=2)
    slot.save(os.path.join(HUD, "slot.png"))
    print("ikony: %d, rámy HUD hotovy" % len(SKILLS))


if __name__ == "__main__":
    main()
