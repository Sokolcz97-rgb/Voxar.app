#!/usr/bin/env python3
"""Reconstruct the first modular Valoria buildings from the previous session."""
import math
from pathlib import Path

from meshkit import Mesh, box, cone, cylinder, merge, sphere, write_glb

ASSETS = Path(__file__).resolve().parent.parent / "Assets"
OUT = ASSETS / "Models" / "valoria"

# fotorealistické PBR materiály z fotoskenů Poly Haven (CC0) – tools/valoria_pbr.py; uv_scale = skutečná velikost
# dlaždice fotoskenu v metrech, ať kvádry, dlažba i tašky mají reálnou velikost
PBR = ASSETS / "Textures/valoria/pbr"


def pbr(name, label, tile, **extra):
    return dict(name=label, texture=str(PBR / f"{name}_basecolor.jpg"), normal=str(PBR / f"{name}_normal.jpg"),
                orm=str(PBR / f"{name}_orm.jpg"), uv_scale=tile, roughness=1.0, **extra)


STONE = pbr("stone", "weathered stone", 2.5)            # brána, most, sokly domů
CASTLE_STONE = pbr("castle", "castle masonry", 2.0)     # kvádrové zdivo hradu
COBBLE = pbr("cobble", "cobblestone paving", 2.0)       # dlažba a podlaha hradu
PLASTER = pbr("plaster", "weathered plaster", 1.0)      # vápenná omítka
WOOD = pbr("timber", "wood", 2.0)                       # trámy hrázděných domů, dveře
BLUE = pbr("slate", "blue slate", 3.0)                  # břidlicové střechy
RED = pbr("clay", "red tile", 4.0)                      # pálené tašky
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


def gable(z):
    points = [[-6, 7, z], [6, 7, z], [0, 9.95, z]]
    indices = [[0, 2, 1]] if z < 0 else [[0, 1, 2]]
    return Mesh(points, indices)


def generate():
    OUT.mkdir(parents=True, exist_ok=True)

    def save(name, parts):
        write_glb(str(OUT / (name + ".glb")), parts, name=name)

    rails = [b(x, 0.9, 0, 0.7, 1.8, 200) for x in (-9.5, 9.5)]
    rails += [b(x, 1.4, z, 1.1, 2.8, 1.1) for x in (-9.5, 9.5) for z in range(-95, 96, 20)]
    save("bridge", [(merge(b(0, -0.5, 0, 20, 1, 200), *rails), STONE)])
    save("paving", [(b(0, -0.08, 0, 2, 0.2, 2), COBBLE)])

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

    # střechy domů: hřeben podél osy Z – textura otočená, aby řady břidlic a tašek vedly podél hřebene
    for name, material in (("house_blue", dict(BLUE, uv_swap=True)), ("house_red", dict(RED, uv_swap=True))):
        timber = [b(x, 4, -4.55, 0.25, 6, 0.18) for x in (-5.5, 0, 5.5)]
        timber += [b(0, y, -4.55, 12, 0.25, 0.18) for y in (1, 4, 6.8)]
        timber += [b(0, 1.5, -4.7, 2, 3, 0.2)]
        for side in (-1, 1):
            x = side * 6.06
            timber += [b(x, 4, z, 0.18, 5.8, 0.24) for z in (-4.2, 0, 4.2)]
            timber += [b(x, y, 0, 0.18, 0.24, 9) for y in (1.3, 4, 6.8)]
            for z in (-2.2, 2.2):
                for y in (2.8, 5.2):
                    timber += [b(x, y, z + dz, 0.18, 1.6, 0.16) for dz in (-0.7, 0, 0.7)]
                    timber += [b(x, y + dy, z, 0.18, 0.16, 1.55) for dy in (-0.75, 0, 0.75)]
        for x in (-3.5, 3.5):
            for y in (2.8, 5.2):
                timber += [b(x + dx, y, -4.68, 0.16, 1.7, 0.14) for dx in (-0.75, 0, 0.75)]
                timber += [b(x, y + dy, -4.68, 1.65, 0.15, 0.14) for dy in (-0.8, 0, 0.8)]
        roofs = [box(7.3, 0.45, 10).rotate(0, 0, angle).translate(x, 8.5, 0)
                 for x, angle in ((-3.1, 25), (3.1, -25))]
        tiles = [box(7.0, 0.12, 0.10).rotate(0, 0, angle).translate(x, 8.77, z)
                 for x, angle in ((-3.1, 25), (3.1, -25)) for z in range(-4, 5)]
        windows = [b(x, y, -4.59, 1.5, 1.55, 0.08) for x in (-3.5, 3.5) for y in (2.8, 5.2)]
        windows += [b(side * 6.035, y, z, 0.08, 1.5, 1.4) for side in (-1, 1)
                    for z in (-2.2, 2.2) for y in (2.8, 5.2)]
        timber += [b(x, 1.65, -6.75, 0.18, 3.3, 0.18) for x in (-4.2, 4.2)]
        save(name, [(b(0, 0.65, 0, 12, 1.3, 9), STONE),
                    (merge(b(0, 4.15, 0, 12, 5.7, 9), gable(-4.5), gable(4.5)), PLASTER),
                    (merge(*timber), WOOD),
                    (merge(*roofs, *tiles), material), (merge(*windows), GLASS),
                    (box(9, 0.12, 2.6).rotate(-8, 0, 0).translate(0, 3.45, -5.65), CLOTH)])

    statue = [b(0, 0.8, 0, 3.8, 1.6, 3.8),
              cylinder(0.5, 0.38, 2.8, 16).translate(-0.65, 1.6, 0),
              cylinder(0.5, 0.38, 2.8, 16).translate(0.65, 1.6, 0),
              sphere(1, 16, 12).scale(1.25, 1.55, 0.65).translate(0, 5.25, 0),
              cylinder(0.42, 0.48, 2.5, 16).translate(-1.5, 4.3, 0),
              cylinder(0.42, 0.48, 2.5, 16).translate(1.5, 4.3, 0),
              sphere(0.68, 16, 12).translate(0, 7.2, 0)]
    save("hero", [(merge(*statue), MARBLE)])

    keep = [b(0, 8, -11, 35, 16, 2),
            b(-16.5, 8, 0, 2, 16, 20), b(16.5, 8, 0, 2, 16, 20),
            b(-9.85, 8, 11, 15.3, 16, 2), b(9.85, 8, 11, 15.3, 16, 2),
            b(0, 11.2, 11, 4.4, 9.6, 2),
            b(0, 15.5, 0, 36, 1, 25)]
    spires, slits, door, trim, pennants = [], [], [], [], []
    for z in (-12.3, 12.3):
        for x in range(-15, 16, 3):
            keep.append(b(x, 17.0, z, 1.5, 2.0, 1.2))
        for x in (-12, -6, 6, 12):
            for y in (5, 10.5):
                slits.append(b(x, y, z, 1.0, 2.7, 0.2))
                trim.extend([b(x + dx, y, z, 0.3, 3.2, 0.35) for dx in (-0.68, 0.68)])
                trim.append(b(x, y + 1.55, z, 1.65, 0.3, 0.35))
    for x in (-17.8, 17.8):
        for z in range(-9, 10, 3):
            keep.append(b(x, 17.0, z, 1.2, 2.0, 1.5))
        for z in (-8, 0, 8):
            for y in (5, 10.5):
                slits.append(b(x, y, z, 0.2, 2.7, 1.0))
                trim.extend([b(x, y, z + dz, 0.35, 3.2, 0.3) for dz in (-0.68, 0.68)])
                trim.append(b(x, y + 1.55, z, 0.35, 0.3, 1.65))
    for side in (-1, 1):
        x = side * 2.58
        door.append(b(x, 3, 10.9, 0.25, 6.0, 2.2))
        door.extend([b(x - side * 0.14, 3, z, 0.08, 5.8, 0.12) for z in (10.15, 10.9, 11.65)])
        door.extend([b(x - side * 0.14, y, 10.9, 0.08, 0.18, 2.2) for y in (1, 3, 5)])
    for x in (-2.25, 2.25):
        trim.append(b(x, 3.2, 12.5, 0.5, 6.4, 0.55))
    for i in range(13):
        angle = math.pi * i / 12
        x, y = 2.25 * math.cos(angle), 6.4 + 2.25 * math.sin(angle)
        trim.append(box(0.7, 0.55, 0.55).rotate(0, 0, -math.degrees(angle)).translate(x, y, 12.5))
    for x, z, height in ((-18, -12, 32), (18, -12, 32), (-18, 12, 27),
                         (18, 12, 27), (0, 0, 42)):
        keep.append(tower(x, z, height, 4.5))
        keep.append(cylinder(4.9, 4.9, 0.8, 24).translate(x, height - 2, z))
        keep.append(cylinder(4.75, 4.75, 0.6, 24).translate(x, 3, z))
        for y in (9, 17):
            slits.append(b(x, y, z + 4.5 - 0.54 * y / height + 0.03, 0.65, 2.4, 0.18))
        spires.append(roof(x, height, z, 5.2, 12))
        pennants.append(sphere(0.35, 12, 8).translate(x, height + 12, z))
    floor = merge(b(0, -0.08, 0, 31, 0.2, 20), b(0, -0.08, 11, 4.4, 0.2, 2))
    save("keep_floor", [(floor, COBBLE)])
    save("keep_step", [(b(0, -0.08, 0, 4.0, 0.2, 2), COBBLE)])
    save("keep", [(merge(*keep, *trim), CASTLE_STONE), (merge(*spires), BLUE),
                  (merge(*slits), GLASS), (merge(*door), WOOD), (merge(*pennants), GOLD)])


if __name__ == "__main__":
    generate()
