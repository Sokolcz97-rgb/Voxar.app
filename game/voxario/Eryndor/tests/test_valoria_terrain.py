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


if __name__ == "__main__":
    unittest.main()
