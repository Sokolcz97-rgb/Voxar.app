#!/usr/bin/env python3
"""Validate rig, skin weights, and mesh accessors for all playable races and their gear."""
import json
import math
import pathlib
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1] / "Assets" / "Models"
RACES = ("clovek", "trpaslik", "elf", "vila", "obr", "kocka", "kocka_zrzava")
ARMOR = {
    "kyrys_clovek": "clovek",
    "krouzkova_trpaslik": "trpaslik",
    "kozena_vesta_elf": "elf",
    "kozesina_obr": "obr",
}
WEAPONS = ("dyka", "hul", "kladivo", "luk", "mec", "mec_dlouhy")
COMPONENTS = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
WIDTHS = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def load_glb(path):
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
        raise ValueError(f"{path.name}: invalid GLB header")
    total = struct.unpack_from("<I", data, 8)[0]
    if total != len(data):
        raise ValueError(f"{path.name}: GLB length mismatch")
    offset, document, binary = 12, None, b""
    while offset < total:
        length, kind = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset:offset + length]
        offset += length
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        elif kind == 0x004E4942:
            binary = chunk
    if not document or not document.get("asset", {}).get("version") == "2.0":
        raise ValueError(f"{path.name}: missing glTF 2.0 JSON")
    if document.get("buffers") and document["buffers"][0].get("byteLength", 0) > len(binary):
        raise ValueError(f"{path.name}: truncated binary data")
    return document, binary


def values(gltf, binary, accessor_index):
    accessor = gltf["accessors"][accessor_index]
    if "sparse" in accessor:
        raise ValueError("sparse accessors are not supported by this validator")
    component, component_size = COMPONENTS[accessor["componentType"]]
    width = WIDTHS[accessor["type"]]
    view = gltf["bufferViews"][accessor["bufferView"]]
    stride = view.get("byteStride", component_size * width)
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    fmt = "<" + component * width
    for row in range(accessor["count"]):
        offset = start + row * stride
        yield struct.unpack_from(fmt, binary, offset)


def validate(path, require_rig):
    gltf, binary = load_glb(path)
    skins = gltf.get("skins", [])
    nodes = gltf.get("nodes", [])
    for image in gltf.get("images", []):
        if image.get("mimeType") not in ("image/png", "image/jpeg") or image.get("bufferView") is None:
            raise ValueError(f"{path.name}: texture image is not embedded in the model")
        view = gltf["bufferViews"][image["bufferView"]]
        if view.get("byteLength", 0) <= 0 or view.get("byteOffset", 0) + view["byteLength"] > len(binary):
            raise ValueError(f"{path.name}: embedded texture data is truncated")
    textures = gltf.get("textures", [])
    for material in gltf.get("materials", []):
        texture_info = material.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        if texture_info:
            texture_index = texture_info["index"]
            if texture_index < 0 or texture_index >= len(textures):
                raise ValueError(f"{path.name}: material references a missing texture")
            source = textures[texture_index].get("source", -1)
            if source < 0 or source >= len(gltf.get("images", [])):
                raise ValueError(f"{path.name}: material references a missing image")
    for accessor in gltf.get("accessors", []):
        if accessor.get("bufferView") is not None:
            component_size = COMPONENTS[accessor["componentType"]][1]
            stride = gltf["bufferViews"][accessor["bufferView"]].get("byteStride", component_size * WIDTHS[accessor["type"]])
            end = gltf["bufferViews"][accessor["bufferView"]].get("byteOffset", 0) + accessor.get("byteOffset", 0) + max(0, accessor["count"] - 1) * stride + component_size * WIDTHS[accessor["type"]]
            if end > len(binary):
                raise ValueError(f"{path.name}: accessor exceeds GLB binary data")
        if "min" in accessor and not all(math.isfinite(float(x)) for x in accessor["min"] + accessor.get("max", [])):
            raise ValueError(f"{path.name}: non-finite accessor bounds")

    skin_nodes = [node for node in nodes if "mesh" in node and "skin" in node]
    if require_rig and (not skins or not skin_nodes):
        raise ValueError(f"{path.name}: expected skinned model")
    for node in skin_nodes:
        joint_count = len(skins[node["skin"]]["joints"])
        for primitive in gltf["meshes"][node["mesh"]]["primitives"]:
            attributes = primitive.get("attributes", {})
            if "POSITION" not in attributes or "TEXCOORD_0" not in attributes:
                raise ValueError(f"{path.name}: primitive is missing positions or UV coordinates")
            material_index = primitive.get("material", -1)
            if material_index < 0 or "baseColorTexture" not in gltf["materials"][material_index].get("pbrMetallicRoughness", {}):
                raise ValueError(f"{path.name}: skinned primitive has no textured material")
            for suffix in ("0", "1"):
                joints_key, weights_key = "JOINTS_" + suffix, "WEIGHTS_" + suffix
                if joints_key not in attributes and weights_key not in attributes:
                    continue
                if joints_key not in attributes or weights_key not in attributes:
                    raise ValueError(f"{path.name}: incomplete skin attributes")
                joints = list(values(gltf, binary, attributes[joints_key]))
                weights = list(values(gltf, binary, attributes[weights_key]))
                if len(joints) != len(weights):
                    raise ValueError(f"{path.name}: joint/weight vertex counts differ")
                for joint_row, weight_row in zip(joints, weights):
                    if any(joint >= joint_count for joint in joint_row):
                        raise ValueError(f"{path.name}: joint index exceeds skin")
                    weight_total = sum(weight_row)
                    if weight_total < 0.8 or weight_total > 1.2:
                        raise ValueError(f"{path.name}: invalid skin weight sum {weight_total:.3f}")
            if "JOINTS_0" not in attributes or "WEIGHTS_0" not in attributes:
                raise ValueError(f"{path.name}: skinned primitive has no primary weights")
    return gltf


def joint_names(gltf):
    skin = gltf["skins"][0]
    return {gltf["nodes"][index].get("name", "") for index in skin["joints"]}


def main():
    assets = {}
    for race in RACES:
        path = ROOT / "races" / (race + ".glb")
        assets[race] = validate(path, True)
        if not assets[race].get("animations"):
            raise ValueError(f"{path.name}: race model has no animations")
    for model_dir, models in (("gear", ARMOR.keys()), ("gear", WEAPONS)):
        for model in models:
            path = ROOT / model_dir / (model + ".glb")
            gltf, _ = load_glb(path)
            for mesh in gltf.get("meshes", []):
                for primitive in mesh.get("primitives", []):
                    if "POSITION" not in primitive.get("attributes", {}) or "TEXCOORD_0" not in primitive["attributes"]:
                        raise ValueError(f"{path.name}: primitive is missing positions or UV coordinates")
                    material_index = primitive.get("material", -1)
                    if material_index < 0 or "baseColorTexture" not in gltf["materials"][material_index].get("pbrMetallicRoughness", {}):
                        raise ValueError(f"{path.name}: primitive has no textured material")
    baseline = joint_names(assets["clovek"])
    for race, gltf in assets.items():
        overlap = len(baseline & joint_names(gltf)) / len(baseline)
        if overlap < 0.9:
            raise ValueError(f"{race}: only {overlap:.0%} shared rig joints")
    for armor, race in ARMOR.items():
        path = ROOT / "gear" / (armor + ".glb")
        gltf = validate(path, True)
        overlap = len(joint_names(assets[race]) & joint_names(gltf)) / len(joint_names(assets[race]))
        if overlap < 0.9:
            raise ValueError(f"{armor}: only {overlap:.0%} joints match {race}")
    for weapon in WEAPONS:
        validate(ROOT / "gear" / (weapon + ".glb"), False)
    print(f"Validated {len(RACES)} race models, {len(ARMOR)} rigged armor models, and {len(WEAPONS)} weapons.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, KeyError, IndexError, ValueError, struct.error, json.JSONDecodeError) as error:
        print(f"Model validation failed: {error}", file=sys.stderr)
        sys.exit(1)
