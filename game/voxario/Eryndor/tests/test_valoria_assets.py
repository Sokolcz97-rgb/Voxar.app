import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))
import valoria_assets


class ValoriaAssetsTest(unittest.TestCase):
    def test_generated_models_are_valid_glb_with_meshes(self):
        with tempfile.TemporaryDirectory() as tmp:
            original = valoria_assets.OUT
            try:
                valoria_assets.OUT = Path(tmp)
                valoria_assets.generate()
            finally:
                valoria_assets.OUT = original

            paths = sorted(Path(tmp).glob("*.glb"))
            self.assertEqual(
                [path.stem for path in paths],
                ["gate", "hero", "house_blue", "house_red", "keep"],
            )
            for path in paths:
                with self.subTest(model=path.name):
                    data = path.read_bytes()
                    magic, version, length = struct.unpack_from("<4sII", data)
                    self.assertEqual((magic, version, length), (b"glTF", 2, len(data)))
                    json_length, chunk_type = struct.unpack_from("<I4s", data, 12)
                    self.assertEqual(chunk_type, b"JSON")
                    document = json.loads(data[20:20 + json_length])
                    self.assertTrue(document["meshes"])
                    self.assertTrue(document["materials"])


if __name__ == "__main__":
    unittest.main()
