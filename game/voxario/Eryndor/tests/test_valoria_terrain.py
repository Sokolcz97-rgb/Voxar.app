import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
import valoria_terrain


class ValoriaTerrainTest(unittest.TestCase):
    def test_island_plateau_keep_and_unchanged_ocean(self):
        x = np.array([3000.0, 3000.0, 3500.0, 0.0])
        z = np.array([2620.0, 2165.0, 2400.0, 0.0])
        original = np.full(4, -40.0)
        height, mask = valoria_terrain.apply(original, x, z)
        self.assertAlmostEqual(height[0], 12.0)
        self.assertGreater(height[1], 29.0)
        self.assertEqual(height[3], original[3])
        self.assertEqual(mask[3], 0.0)
        self.assertLess(height[2], 12.0)

    def test_island_footprint_and_city_are_preserved(self):
        x, z = np.meshgrid(np.arange(2200.0, 3801.0, 10.0), np.arange(1550.0, 3251.0, 10.0))
        original = np.full_like(x, -40.0)
        height, mask = valoria_terrain.apply(original, x, z)
        radius = np.hypot((x - 3000) / 600, (z - 2400) / 700)
        self.assertTrue(np.all(mask[radius >= 1.0] == 0))
        self.assertTrue(np.array_equal(height[radius >= 1.0], original[radius >= 1.0]))
        city = (abs(x - 3000) <= 75) & (abs(z - 2400) <= 300)
        keep_radius = np.hypot((x - 3000) / 190, (z - 2165) / 150)
        expected = 12 + 20 * (1 - valoria_terrain._smoothstep(0.15, 1.0, keep_radius))
        np.testing.assert_allclose(height[city], expected[city])
        outer = (radius > 0.45) & (radius < 0.62)
        self.assertGreater(np.ptp(height[outer]), 3.0)

    def test_surface_weights(self):
        h = np.array([2.0, 12.0, 20.0, -1.0])
        slope = np.array([0.1, 0.1, 0.8, 0.1])
        weights = np.array(valoria_terrain.surface_weights(h, slope, np.full(4, 0.5)))
        np.testing.assert_allclose(weights.sum(axis=0), 1.0)
        self.assertTrue(np.all(weights >= 0))
        self.assertGreater(weights[2, 0], 0.5)
        self.assertGreater(weights[0, 1], 0.5)
        self.assertGreater(weights[3, 2], 0.9)
        self.assertEqual(weights[2, 3], 1)


if __name__ == "__main__":
    unittest.main()
