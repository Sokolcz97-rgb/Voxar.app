#!/usr/bin/env python3
"""Vygeneruje modely krajiny jako v Unity verzi (Scenery.cs / MeshKit): cypřiš, olivovník,
kámen a trs trávy. Výstup: Assets/Models/scenery/*.gltf (malé, s vloženými daty, commitují se).

Spuštění:  python3 tools/make_scenery_models.py
"""
import base64, json, math, os, struct

OUT = os.path.join(os.path.dirname(__file__), "..", "Assets", "Models", "scenery")


def hash3(x, y, z, seed):
    s = math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453
    return s - math.floor(s)


def organic(verts, amount, seed):
    """Nepravidelný tvar (MeshKit.Organic): posun vrcholů od středu podle šumu."""
    out = []
    for (x, y, z) in verts:
        k = 1.0 + (hash3(round(x, 3), round(y, 3), round(z, 3), seed) - 0.5) * amount
        out.append((x * k, y if abs(y) < 1e-6 else y, z * k))
    return out


def cylinder(r0, r1, h, seg, y0=0.0):
    return orient(_cylinder(r0, r1, h, seg, y0), lambda g: (0.0, min(max(g[1], y0 + 0.01), y0 + h - 0.01), 0.0))


def _cylinder(r0, r1, h, seg, y0=0.0):
    tris = []
    for i in range(seg):
        a0, a1 = i / seg * 2 * math.pi, (i + 1) / seg * 2 * math.pi
        p00 = (math.cos(a0) * r0, y0, math.sin(a0) * r0)
        p10 = (math.cos(a1) * r0, y0, math.sin(a1) * r0)
        p01 = (math.cos(a0) * r1, y0 + h, math.sin(a0) * r1)
        p11 = (math.cos(a1) * r1, y0 + h, math.sin(a1) * r1)
        tris += [p00, p01, p10, p10, p01, p11]
        tris += [(0, y0 + h, 0), p11, p01]
    return tris


def cone(r, h, seg, rings, y0, seed, amount):
    return orient(_cone(r, h, seg, rings, y0, seed, amount), lambda g: (0.0, min(max(g[1], y0 + 0.01), y0 + h - 0.01), 0.0))


def _cone(r, h, seg, rings, y0, seed, amount):
    tris = []
    def pt(i, j):
        a = i / seg * 2 * math.pi
        t = j / rings
        rr = r * (1 - t) * (1 + (hash3(i % seg, j, 0, seed) - 0.5) * amount if j < rings else 0)
        return (math.cos(a) * rr, y0 + h * t, math.sin(a) * rr)
    for j in range(rings):
        for i in range(seg):
            a, b, c, d = pt(i, j), pt(i + 1, j), pt(i, j + 1), pt(i + 1, j + 1)
            tris += [a, c, b, b, c, d]
    for i in range(seg):
        tris += [(0, y0, 0), pt(i, 0), pt(i + 1, 0)]
    return tris


def ico(radius, center, scale, seed, amount, sub=1):
    t = (1 + math.sqrt(5)) / 2
    v = [(-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t),
         (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
         (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    v = [tuple(c / math.sqrt(sum(x * x for x in p)) for c in p) for p in v]
    for _ in range(sub):
        cache, nf = {}, []
        def mid(a, b):
            key = tuple(sorted((a, b)))
            if key not in cache:
                p = [(v[a][k] + v[b][k]) / 2 for k in range(3)]
                n = math.sqrt(sum(x * x for x in p))
                v.append(tuple(x / n for x in p))
                cache[key] = len(v) - 1
            return cache[key]
        for (a, b, c) in f:
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            nf += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        f = nf
    pts = []
    for p in v:
        k = radius * (1 + (hash3(round(p[0], 3), round(p[1], 3), round(p[2], 3), seed) - 0.5) * amount)
        pts.append((center[0] + p[0] * k * scale[0], center[1] + p[1] * k * scale[1], center[2] + p[2] * k * scale[2]))
    tris = []
    for (a, b, c) in f:
        tris += [pts[a], pts[c], pts[b]]
    return orient(tris, lambda g: center)


def orient(tris, ref):
    """Otočí trojúhelníky tak, aby normála mířila ven od bodu ref(těžiště) – ořez odvrácených stěn."""
    out = []
    for i in range(0, len(tris), 3):
        a, b, c = tris[i], tris[i + 1], tris[i + 2]
        u = [b[k] - a[k] for k in range(3)]
        w = [c[k] - a[k] for k in range(3)]
        n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
        g = [(a[k] + b[k] + c[k]) / 3 for k in range(3)]
        r = ref(g)
        if sum(n[k] * (g[k] - r[k]) for k in range(3)) < 0:
            a, b, c = a, c, b
        out += [a, b, c]
    return out


def axis_ref(tris):
    ys = [p[1] for p in tris]
    lo, hi = min(ys) + 0.01, max(ys) - 0.01
    return lambda g: (0.0, min(max(g[1], lo), hi), 0.0)


def write_gltf(name, parts):
    """parts = [(triangles, (r, g, b), double_sided)] – ploché normály (low-poly vzhled jako Unity verze)."""
    buf = bytearray()
    meshes_prims, accessors, views, materials = [], [], [], []
    for idx, (tris, color, double) in enumerate(parts):
        positions, normals = [], []
        for i in range(0, len(tris), 3):
            a, b, c = tris[i], tris[i + 1], tris[i + 2]
            u = [b[k] - a[k] for k in range(3)]
            w = [c[k] - a[k] for k in range(3)]
            n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
            ln = math.sqrt(sum(x * x for x in n)) or 1
            n = [x / ln for x in n]
            for p in (a, b, c):
                positions.append(p)
                normals.append(n)
        pos_off = len(buf)
        for p in positions:
            buf += struct.pack("<3f", *p)
        nrm_off = len(buf)
        for n in normals:
            buf += struct.pack("<3f", *n)
        count = len(positions)
        mn = [min(p[k] for p in positions) for k in range(3)]
        mx = [max(p[k] for p in positions) for k in range(3)]
        views.append({"buffer": 0, "byteOffset": pos_off, "byteLength": count * 12, "target": 34962})
        views.append({"buffer": 0, "byteOffset": nrm_off, "byteLength": count * 12, "target": 34962})
        accessors.append({"bufferView": len(views) - 2, "componentType": 5126, "count": count, "type": "VEC3", "min": mn, "max": mx})
        accessors.append({"bufferView": len(views) - 1, "componentType": 5126, "count": count, "type": "VEC3"})
        materials.append({"name": f"{name}_{idx}", "doubleSided": double,
                          "pbrMetallicRoughness": {"baseColorFactor": [*color, 1.0], "metallicFactor": 0.0, "roughnessFactor": 0.92}})
        meshes_prims.append({"attributes": {"POSITION": len(accessors) - 2, "NORMAL": len(accessors) - 1}, "material": idx})
    gltf = {"asset": {"version": "2.0", "generator": "Ashes of Eryon make_scenery_models.py"},
            "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"name": name, "mesh": 0}],
            "meshes": [{"name": name, "primitives": meshes_prims}], "materials": materials,
            "accessors": accessors, "bufferViews": views,
            "buffers": [{"byteLength": len(buf), "uri": "data:application/octet-stream;base64," + base64.b64encode(bytes(buf)).decode()}]}
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + ".gltf"), "w") as f:
        json.dump(gltf, f, separators=(",", ":"))
    print("wrote", name, sum(len(p[0]) // 3 for p in parts), "triangles")


trunk = (0.63 * 0.7, 0.54 * 0.7, 0.44 * 0.7)
# cypřiš: štíhlý kužel (Scenery.cs: Cone(0.72, 4.6, 9, 6) posunutý o 0.9 m, kmen 1.2 m)
write_gltf("cypress", [(cylinder(0.16, 0.1, 1.2, 6), trunk, False),
                       (cone(0.72, 4.6, 9, 6, 0.9, 3, 0.32), (0.24 * 0.75, 0.29 * 0.75, 0.17 * 0.75), False)])
# olivovník: kmen 1.9 m a pět kulovitých chomáčů
blobs = [(0, 2.7, 0, 1.25), (0.8, 2.4, 0.3, 0.9), (-0.7, 2.5, -0.4, 0.95), (0.1, 3.2, -0.6, 0.85), (-0.3, 2.3, 0.8, 0.8)]
crown = []
for i, (x, y, z, r) in enumerate(blobs):
    crown += ico(r, (x, y, z), (1.15, 0.75, 1.15), i * 3.1, 0.35, 1)
write_gltf("olive", [(cylinder(0.3, 0.16, 1.9, 7), trunk, False), (crown, (0.42 * 0.8, 0.46 * 0.8, 0.31 * 0.8), False)])
# kámen: zdeformovaná ikosféra (zploštělá)
write_gltf("rock", [(ico(1.0, (0, 0, 0), (1, 0.7, 1), 7, 0.25, 1), (0.85 * 0.75, 0.82 * 0.75, 0.75 * 0.75), False)])
# písečný kámen jihu (rudý)
write_gltf("rock_red", [(ico(1.0, (0, 0, 0), (1, 0.75, 1), 11, 0.3, 1), (0.61, 0.36, 0.24), False)])
# tráva: šest stébel
tuft = []
for k in range(6):
    a = k / 6 * 2 * math.pi
    ox, oz = math.cos(a) * 0.12, math.sin(a) * 0.12
    px, pz = -math.sin(a) * 0.035, math.cos(a) * 0.035
    hh = 0.35 + (k % 3) * 0.12
    tuft += [(ox - px, 0, oz - pz), (ox * 2.2, hh, oz * 2.2), (ox + px, 0, oz + pz)]
write_gltf("grass", [(tuft, (0.64 * 0.6, 0.6 * 0.6, 0.36 * 0.6), True)])
# palma (oáza): kmen a listy
fronds = []
for k in range(7):
    a = k / 7 * 2 * math.pi
    d = (math.cos(a), math.sin(a))
    fronds += [(0, 5.0, 0), (d[0] * 2.6 - d[1] * 0.35, 4.3, d[1] * 2.6 + d[0] * 0.35), (d[0] * 2.6 + d[1] * 0.35, 4.3, d[1] * 2.6 - d[0] * 0.35)]
write_gltf("palm", [(cylinder(0.22, 0.14, 5.0, 7), (0.55, 0.42, 0.3), False), (fronds, (0.3, 0.45, 0.18), True)])
