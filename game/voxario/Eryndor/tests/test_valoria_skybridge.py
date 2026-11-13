"""Obloukový most Valoria – hlavní ostrov (tools/valoria_skybridge.py)."""
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))
import valoria_skybridge as sb  # noqa: E402


class SkybridgeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        out, data = sb.OUT, sb.DATA
        try:
            sb.OUT = Path(cls.tmp.name)
            sb.DATA = Path(cls.tmp.name) / "skybridge_data.lua"
            cls.r = sb.build()
            cls.glb = (Path(cls.tmp.name) / "skybridge.glb").read_bytes()
            cls.lua = sb.DATA.read_text(encoding="utf-8")
        finally:
            sb.OUT, sb.DATA = out, data

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_deck_clears_terrain_until_landing(self):
        s, deck, ground = self.r["s"], self.r["deck"], self.r["ground"]
        land = s <= s[-1] - sb.EXTEND
        self.assertGreaterEqual(float((deck - ground)[land].min()), 0.5)
        # za nájezdem se mostovka zanoří pod terén (žádná hrana trčící z útesu)
        self.assertLess(float((deck - ground)[-1]), 0.0)

    def test_walkable_grade_and_smooth_start(self):
        s, deck = self.r["s"], self.r["deck"]
        land = s <= s[-1] - sb.EXTEND
        grade = np.abs(np.diff(deck[land]) / np.diff(s[land]))
        self.assertLessEqual(float(grade.max()), sb.MAX_GRADE + 1e-6)
        self.assertLess(float(grade[:5].max()), 0.02)

    def test_starts_at_hero_bridge_and_crosses_sea(self):
        C = self.r["C"]
        self.assertTrue(np.allclose(C[0], sb.START))
        self.assertLess(float(self.r["ground"].min()), -50.0)
        self.assertLess(float(C[-1, 0]), 2050.0)

    def test_glb_and_data(self):
        magic, version, length = struct.unpack_from("<4sII", self.glb)
        self.assertEqual((magic, version, length), (b"glTF", 2, len(self.glb)))
        n, _ = struct.unpack_from("<I4s", self.glb, 12)
        doc = json.loads(self.glb[20:20 + n])
        self.assertEqual(len(doc["meshes"][0]["primitives"]), 3)
        for acc in doc["accessors"]:   # NaN v min/max = neplatný glTF (engine ho odmítne načíst)
            for v in acc.get("min", []) + acc.get("max", []):
                self.assertTrue(np.isfinite(v))
        self.assertIn("points = {", self.lua)
        repo = (sb.ASSETS / "Scripts" / "eryndor" / "skybridge_data.lua").read_text(encoding="utf-8")
        self.assertEqual(repo, self.lua, "skybridge_data.lua neodpovídá generátoru – spusť tools/valoria_skybridge.py")


if __name__ == "__main__":
    unittest.main()
