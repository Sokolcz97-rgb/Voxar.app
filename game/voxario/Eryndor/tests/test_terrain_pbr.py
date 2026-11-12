"""Kontrola PBR povrchů terénu (tools/terrain_pbr.py) a jejich zapojení do world.terrain."""
import re
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import terrain_pbr  # noqa: E402

PBR = ROOT / "Assets" / "Textures" / "terrain" / "pbr"
WORLD = ROOT / "Assets" / "Scripts" / "eryndor" / "world.lua"


class TerrainPbrTest(unittest.TestCase):
    def test_every_layer_has_albedo_and_surface(self):
        for name in terrain_pbr.LAYERS:
            with self.subTest(layer=name):
                albedo = Image.open(PBR / f"{name}_albedo.jpg")
                surface = Image.open(PBR / f"{name}_surface.png")
                self.assertEqual(albedo.mode, "RGB")
                self.assertEqual(surface.mode, "RGBA")
                self.assertEqual(albedo.width, albedo.height)
                self.assertGreaterEqual(albedo.width, 1024)
                self.assertGreaterEqual(surface.width, 512)

    def test_surface_channels_are_plausible(self):
        for name in terrain_pbr.LAYERS:
            with self.subTest(layer=name):
                s = np.asarray(Image.open(PBR / f"{name}_surface.png"), np.float32) / 255.0
                n = s[..., :2] * 2.0 - 1.0
                # tečná normála: průměr míří nahoru (xy kolem 0), délka xy < 1
                self.assertLess(abs(float(n[..., 0].mean())), 0.03)
                self.assertLess(abs(float(n[..., 1].mean())), 0.03)
                self.assertLess(float(np.percentile(np.hypot(n[..., 0], n[..., 1]), 99)), 1.0)
                rough = s[..., 2]
                self.assertTrue(0.05 < float(rough.mean()) <= 1.0)
                height = s[..., 3]
                self.assertGreater(float(height.max() - height.min()), 0.5)   # roztažená výška

    def test_lava_has_glowing_cracks_and_dark_crust(self):
        a = np.asarray(Image.open(PBR / "lava_albedo.jpg"), np.float32) / 255.0
        luma = a @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        self.assertLess(float(np.median(luma)), 0.25)            # tmavá kůra (sRGB)
        self.assertGreater(float((luma > 0.45).mean()), 0.02)    # žhnoucí praskliny

    def test_world_terrain_uses_pbr_layers(self):
        lua = WORLD.read_text(encoding="utf-8")
        layers = re.findall(r'pbr\("(\w+)"', lua)
        self.assertEqual(layers, list(terrain_pbr.LAYERS))
        self.assertIn('surface = "Textures/terrain/pbr/"', lua)

    def test_credits_list_sources(self):
        credits = (PBR / "CREDITS.txt").read_text(encoding="utf-8")
        self.assertIn("CC0", credits)
        for asset, _ in terrain_pbr.LAYERS.values():
            self.assertIn(asset, credits)


if __name__ == "__main__":
    unittest.main()
