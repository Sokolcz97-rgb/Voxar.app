#!/usr/bin/env python3
"""Textury rozhraní „Eryon“ jako EryonSkin.Frame (tmavý svislý přechod, zlatá linka,
vnitřní tenká linka, kosočtverečné rohy). Výstup: Assets/Textures/ui/*.png"""
import os
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "Assets", "Textures", "ui")
os.makedirs(OUT, exist_ok=True)


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(4))


def frame(name, size, top, bottom, border, inner, corners):
    im = Image.new("RGBA", (size, size))
    px = im.load()
    for y in range(size):
        for x in range(size):
            c = lerp(bottom, top, 1 - y / (size - 1))   # obrázek shora dolů
            d = min(x, y, size - 1 - x, size - 1 - y)
            if d == 0:
                c = lerp(c, border, border[3])
            elif d == 1:
                c = lerp(c, (0, 0, 0, c[3]), 0.5)
            elif d == 4 and inner[3] > 0:
                c = lerp(c, inner, inner[3])
            if corners:
                for (cx, cy) in ((4, 4), (size - 5, 4), (4, size - 5), (size - 5, size - 5)):
                    if abs(x - cx) + abs(y - cy) <= 3:
                        c = border
            px[x, y] = tuple(int(max(0, min(1, v)) * 255) for v in c)
    im.save(os.path.join(OUT, name + ".png"))
    print("wrote", name)


def hexc(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


line_strong = (214 / 255, 178 / 255, 104 / 255, 0.8)
line = (201 / 255, 164 / 255, 92 / 255, 0.35)
frame("panel", 48, (17 / 255, 14 / 255, 12 / 255, 0.9), (0.04, 0.03, 0.025, 0.94), line_strong, line, True)
frame("button", 32, (0.16, 0.12, 0.09, 0.95), (0.09, 0.07, 0.055, 0.95), (0.75, 0.6, 0.35, 0.75), (0, 0, 0, 0), False)
frame("primary", 32, hexc("#e8c77e"), hexc("#a87a3a"), hexc("#fbe6b0"), (0, 0, 0, 0), False)
frame("chip_on", 24, (0.36, 0.27, 0.14, 0.95), (0.22, 0.16, 0.09, 0.95), hexc("#f0d08a"), (0, 0, 0, 0), False)
frame("chip", 24, (0.11, 0.09, 0.07, 0.9), (0.07, 0.055, 0.045, 0.9), (0.55, 0.44, 0.27, 0.55), (0, 0, 0, 0), False)
# vinětace (EryonSkin.MakeVignette): radiální ztmavení okrajů
v = Image.new("RGBA", (256, 256))
p = v.load()
for y in range(256):
    for x in range(256):
        dx, dy = (x - 127.5) / 127.5, (y - 127.5) / 127.5
        d = min(1.0, (dx * dx + dy * dy) ** 0.5 / 1.25)
        a = max(0.0, (d - 0.35) / 0.65) ** 1.6
        p[x, y] = (5, 4, 3, int(a * 235))
v.save(os.path.join(OUT, "vignette.png"))
print("wrote vignette")
