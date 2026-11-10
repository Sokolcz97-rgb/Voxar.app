#!/usr/bin/env python3
"""Reconstruct the first modular Valoria buildings from the previous session."""
import math
from pathlib import Path

from meshkit import box, cone, cylinder, merge, sphere, write_glb

ASSETS = Path(__file__).resolve().parent.parent / "Assets"
OUT = ASSETS / "Models" / "valoria"

STONE = dict(name="weathered stone", texture=str(ASSETS / "Textures/valoria/stone_basecolor.png"),
             normal=str(ASSETS / "Textures/valoria/stone_normal.png"),
             orm=str(ASSETS / "Textures/valoria/stone_orm.png"), uv_scale=2.0, roughness=1.0)
WOOD = dict(name="wood", texture=str(ASSETS / "Textures/nature/kura.jpg"),
            uv_scale=1.5, roughness=0.9)
BLUE = dict(name="blue slate", color=(0.12, 0.21, 0.31), roughness=0.83)
RED = dict(name="red tile", color=(0.34, 0.13, 0.10), roughness=0.9)
GOLD = dict(name="aged gold", color=(0.53, 0.37, 0.14), roughness=0.4, metallic=0.75)
CLOTH = dict(name="blue cloth", color=(0.09, 0.20, 0.39), roughness=1.0, double=True)
MARBLE = dict(name="weathered marble", color=(0.58, 0.57, 0.53), roughness=0.82)
GLASS = dict(name="dark glass", color=(0.05, 0.09, 0.12), roughness=0.25, metallic=0.05)


def b(x, y, z, sx, sy, sz):
    return box(sx, sy, sz, center=(x, y, z))


def tower(x, z, height, radius):
    return cylinder(radius, radius * 0.88, height, 16).translate(x, 0, z)


def roof(x, y, z, radius, height):
    return cone(radius, height, 16).translate(x, y, z)


def generate():
    OUT.mkdir(parents=True, exist_ok=True)

    def save(name, parts):
        write_glb(str(OUT / (name + ".glb")), parts, name=name)

    rails = [b(x, 0.9, 0, 0.7, 1.8, 200) for x in (-9.5, 9.5)]
    rails += [b(x, 1.4, z, 1.1, 2.8, 1.1) for x in (-9.5, 9.5) for z in range(-95, 96, 20)]
    save("bridge", [(merge(b(0, -0.5, 0, 20, 1, 200), *rails), STONE)])
    save("paving", [(b(0, 0.02, 0, 18, 0.04, 160), STONE)])

    gate = [tower(-10, 0, 25, 4), tower(10, 0, 25, 4), b(0, 17, 0, 20, 2, 6)]
    for i in range(30):
        x = -7.25 + i * 0.5
        bottom = 8.5 + 5.0 * math.sqrt(max(0, 1 - (x / 7.5) ** 2))
        gate.append(b(x, (bottom + 16) / 2, 0, 0.51, 16 - bottom, 5))
    for i in range(19):
        angle = math.pi * i / 18
        x, y = 7.5 * math.cos(angle), 8.5 + 5 * math.sin(angle)
        gate.append(box(1.05, 0.8, 0.5).rotate(0, 0, -math.degrees(angle)).translate(x, y, -2.75))
    for x in (-10, 10):
        gate += [cylinder(4.5, 4.5, 0.7, 24).translate(x, 21.5, 0)]
        for i in range(12):
            angle = i * 2 * math.pi / 12
            gate.append(box(1.1, 1.5, 0.8).rotate(0, -math.degrees(angle), 0).translate(
                x + math.cos(angle) * 4, 24.7, math.sin(angle) * 4))
    gate += [b(x, 20, 0, 1.5, 3, 5) for x in range(-9, 10, 3)]
    save("gate", [(merge(*gate), STONE),
                  (merge(roof(-10, 25, 0, 4.7, 7), roof(10, 25, 0, 4.7, 7)), BLUE),
                  (merge(b(-10, 12, 4.1, 3, 8, 0.12), b(10, 12, 4.1, 3, 8, 0.12)), CLOTH),
                  (merge(b(-10, 12, 4.2, 0.25, 8, 0.14), b(10, 12, 4.2, 0.25, 8, 0.14)), GOLD)])

    for name, material in (("house_blue", BLUE), ("house_red", RED)):
        timber = [b(x, 4, -4.55, 0.25, 6, 0.18) for x in (-5.5, 0, 5.5)]
        timber += [b(0, y, -4.55, 12, 0.25, 0.18) for y in (1, 4, 6.8)]
        timber += [b(0, 1.5, -4.7, 2, 3, 0.2)]
        for x in (-3.5, 3.5):
            for y in (2.8, 5.2):
                timber += [b(x + dx, y, -4.68, 0.16, 1.7, 0.14) for dx in (-0.75, 0, 0.75)]
                timber += [b(x, y + dy, -4.68, 1.65, 0.15, 0.14) for dy in (-0.8, 0, 0.8)]
        roofs = [box(7.3, 0.45, 10).rotate(0, 0, angle).translate(x, 8.5, 0)
                 for x, angle in ((-3.1, 25), (3.1, -25))]
        tiles = [box(7.0, 0.12, 0.10).rotate(0, 0, angle).translate(x, 8.77, z)
                 for x, angle in ((-3.1, 25), (3.1, -25)) for z in range(-4, 5)]
        windows = [b(x, y, -4.59, 1.5, 1.55, 0.08) for x in (-3.5, 3.5) for y in (2.8, 5.2)]
        save(name, [(b(0, 3.5, 0, 12, 7, 9), STONE), (merge(*timber), WOOD),
                    (merge(*roofs, *tiles), material), (merge(*windows), GLASS),
                    (b(0, 3.5, -5.7, 9, 0.18, 2.4), CLOTH)])

    statue = [b(0, 0.8, 0, 3.8, 1.6, 3.8),
              cylinder(0.5, 0.38, 2.8, 16).translate(-0.65, 1.6, 0),
              cylinder(0.5, 0.38, 2.8, 16).translate(0.65, 1.6, 0),
              sphere(1, 16, 12).scale(1.25, 1.55, 0.65).translate(0, 5.25, 0),
              cylinder(0.42, 0.48, 2.5, 16).translate(-1.5, 4.3, 0),
              cylinder(0.42, 0.48, 2.5, 16).translate(1.5, 4.3, 0),
              sphere(0.68, 16, 12).translate(0, 7.2, 0)]
    save("hero", [(merge(*statue), MARBLE)])

    keep = [b(0, 8, 0, 35, 16, 24)]
    spires = []
    for x, z, height in ((-18, -12, 32), (18, -12, 32), (-18, 12, 27),
                         (18, 12, 27), (0, 0, 42)):
        keep.append(tower(x, z, height, 4.5))
        spires.append(roof(x, height, z, 5.2, 12))
    save("keep", [(merge(*keep), STONE), (merge(*spires), BLUE)])


if __name__ == "__main__":
    generate()
