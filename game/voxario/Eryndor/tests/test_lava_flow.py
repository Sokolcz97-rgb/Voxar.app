"""Kontrola mapy toku lávy (tools/lava_flow.py) a jejího zapojení do world.terrain."""
import sys
import unittest
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import lava_flow  # noqa: E402

TERRAIN = ROOT / "Assets" / "Terrain"


class LavaFlowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.flow = np.asarray(Image.open(TERRAIN / "aethelgard_lava_flow.png").convert("RGB"), np.float32) / 255.0
        cls.lava = np.asarray(Image.open(TERRAIN / "aethelgard_splat1.png").convert("RGBA"), np.float32)[..., 1] / 255.0

    def test_matches_splat_resolution(self):
        self.assertEqual(self.flow.shape[:2], self.lava.shape)

    def test_flow_only_on_lava(self):
        speed = np.hypot(self.flow[..., 0] * 2 - 1, self.flow[..., 1] * 2 - 1)
        moving = speed > 0.06
        self.assertGreater(moving.sum(), 5000)
        near_lava = lava_flow.gaussian(self.lava, 3.0) > 0.01
        self.assertLess(float((moving & ~near_lava).mean()), 1e-4)

    def test_rivers_flow_away_from_craters(self):
        cell = lava_flow.SIZE / self.lava.shape[0]
        dist = lava_flow.channel_distance(self.lava > 0.25, cell)
        river = np.isfinite(dist) & (dist > 120.0) & (self.lava > 0.5)
        dz, dx = np.gradient(np.where(np.isfinite(dist), dist, 0.0), cell)
        v = self.flow[..., :2] * 2 - 1
        away = (v[..., 0] * dx + v[..., 1] * dz)[river]
        self.assertGreater(float((away > 0).mean()), 0.9)

    def test_core_is_hot_inside_rivers(self):
        core = self.flow[..., 2]
        self.assertGreater(float(core[self.lava > 0.9].mean()), 0.5)
        self.assertLess(float(core[self.lava < 0.01].max()), 0.2)

    def test_world_uses_flowmap(self):
        lua = (ROOT / "Assets" / "Scripts" / "eryndor" / "world.lua").read_text(encoding="utf-8")
        self.assertIn('flowmap = "Terrain/aethelgard_lava_flow.png"', lua)


if __name__ == "__main__":
    unittest.main()
