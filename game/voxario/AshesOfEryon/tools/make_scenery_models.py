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


def box(sx, sy, sz):
    """Kvádr se středem v počátku (MeshKit.Box)."""
    x, y, z = sx / 2, sy / 2, sz / 2
    c = [(-x, -y, -z), (x, -y, -z), (x, y, -z), (-x, y, -z), (-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (3, 7, 6, 2), (0, 4, 7, 3), (1, 2, 6, 5)]
    tris = []
    for a, b, cc, d in faces:
        tris += [c[a], c[b], c[cc], c[a], c[cc], c[d]]
    return orient(tris, lambda g: (0.0, 0.0, 0.0))


def rot(tris, ax=0.0, ay=0.0, az=0.0):
    """Otočení ve stupních v pořadí Unity (Z, pak X, pak Y)."""
    def r(p):
        x, y, z = p
        a = math.radians(az); x, y = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
        a = math.radians(ax); y, z = y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a)
        a = math.radians(ay); x, z = x * math.cos(a) + z * math.sin(a), -x * math.sin(a) + z * math.cos(a)
        return (x, y, z)
    return [r(p) for p in tris]


def move(tris, dx=0.0, dy=0.0, dz=0.0, s=(1.0, 1.0, 1.0)):
    return [(p[0] * s[0] + dx, p[1] * s[1] + dy, p[2] * s[2] + dz) for p in tris]


trunk = (0.63 * 0.7, 0.54 * 0.7, 0.44 * 0.7)
# cypřiš: štíhlý kmen a tři navazující organické kužele ve dvou odstínech (světlejší špička)
cyp_dark, cyp_light = [], []
for i, (r, h, y0) in enumerate([(0.82, 2.6, 0.7), (0.66, 2.4, 2.0), (0.42, 2.0, 3.4)]):
    part = cone(r, h, 10, 4, y0, 3 + i * 5, 0.38)
    (cyp_light if i == 2 else cyp_dark).extend(part)
write_gltf("cypress", [(cylinder(0.17, 0.1, 1.3, 7), (0.36, 0.27, 0.2), False),
                       (cyp_dark, (0.17, 0.25, 0.12), False), (cyp_light, (0.24, 0.33, 0.15), False)])
# olivovník: pokroucený dvojitý kmen a koruna z chomáčů ve dvou odstínech (stříbřitě zelená)
trunk_a = rot(cylinder(0.26, 0.17, 1.4, 7), az=12)
trunk_b = move(rot(cylinder(0.17, 0.1, 1.2, 6), az=-28, ax=10), dx=0.28, dy=1.3)
trunk_c = move(rot(cylinder(0.15, 0.09, 1.1, 6), az=30, ax=-12), dx=0.2, dy=1.25)
blobs = [(0, 2.8, 0, 1.15), (0.9, 2.5, 0.3, 0.85), (-0.8, 2.6, -0.4, 0.9), (0.1, 3.3, -0.6, 0.8),
         (-0.3, 2.4, 0.85, 0.78), (0.6, 3.1, 0.7, 0.7), (-0.7, 3.2, 0.3, 0.66)]
crown_dark, crown_light = [], []
for i, (x, y, z, r) in enumerate(blobs):
    (crown_light if y > 2.9 else crown_dark).extend(ico(r, (x, y, z), (1.15, 0.72, 1.15), i * 3.1, 0.35, 1))
write_gltf("olive", [(trunk_a + trunk_b + trunk_c, (0.4, 0.33, 0.26), False),
                     (crown_dark, (0.3, 0.36, 0.22), False), (crown_light, (0.42, 0.48, 0.32), False)])
# kámen: zdeformovaná ikosféra se světlejším horním a tmavším spodním dílem (+ mech nahoře)
def two_tone_rock(seed, scale, top, bottom, moss=None):
    tris = ico(1.0, (0, 0, 0), scale, seed, 0.28, 1)
    up, down = [], []
    for i in range(0, len(tris), 3):
        t = tris[i:i + 3]
        (up if sum(p[1] for p in t) / 3 > 0.12 else down).extend(t)
    parts = [(up, top, False), (down, bottom, False)]
    if moss:
        mossy = [p for i in range(0, len(up), 3) for p in up[i:i + 3] if sum(q[1] for q in up[i:i + 3]) / 3 > 0.45]
        if mossy:
            parts[0] = ([p for i in range(0, len(up), 3) for p in up[i:i + 3] if sum(q[1] for q in up[i:i + 3]) / 3 <= 0.45], top, False)
            parts.append((mossy, moss, False))
    return parts
write_gltf("rock", two_tone_rock(7, (1, 0.7, 1), (0.7, 0.68, 0.62), (0.5, 0.48, 0.44), moss=(0.36, 0.42, 0.22)))
# písečný kámen jihu (rudý)
write_gltf("rock_red", two_tone_rock(11, (1, 0.75, 1), (0.7, 0.42, 0.28), (0.48, 0.27, 0.18)))
# tráva: šest stébel
tuft = []
for k in range(6):
    a = k / 6 * 2 * math.pi
    ox, oz = math.cos(a) * 0.12, math.sin(a) * 0.12
    px, pz = -math.sin(a) * 0.035, math.cos(a) * 0.035
    hh = 0.35 + (k % 3) * 0.12
    tuft += [(ox - px, 0, oz - pz), (ox * 2.2, hh, oz * 2.2), (ox + px, 0, oz + pz)]
write_gltf("grass", [(tuft, (0.64 * 0.6, 0.6 * 0.6, 0.36 * 0.6), True)])
# palma (oáza): mírně prohnutý kmen z prstenců (širší u každého článku), trs obloukovitých listů
# s lístky do V a pár kokosů pod korunou
def palm_model(seed=0):
    trunk_tris, ring_tris = [], []
    segs, height, seg_n = 7, 5.0, 10
    bend = 0.55
    def center(t):
        return (bend * t * t, height * t, 0.0)
    for j in range(seg_n):
        t0, t1 = j / seg_n, (j + 1) / seg_n
        c0, c1 = center(t0), center(t1)
        r0 = 0.24 - 0.09 * t0
        r1 = (0.24 - 0.09 * t1) * 0.86          # článek se k vrcholu zužuje, další začíná zase širší
        for i in range(segs):
            a0, a1 = i / segs * 2 * math.pi, (i + 1) / segs * 2 * math.pi
            p00 = (c0[0] + math.cos(a0) * r0, c0[1], math.sin(a0) * r0)
            p10 = (c0[0] + math.cos(a1) * r0, c0[1], math.sin(a1) * r0)
            p01 = (c1[0] + math.cos(a0) * r1, c1[1], math.sin(a0) * r1)
            p11 = (c1[0] + math.cos(a1) * r1, c1[1], math.sin(a1) * r1)
            (ring_tris if j % 2 else trunk_tris).extend([p00, p01, p10, p10, p01, p11])
    top = center(1.0)
    fronds_dark, fronds_light = [], []
    n_fronds = 9
    for k in range(n_fronds):
        a = k / n_fronds * 2 * math.pi + hash3(k, 1, 2, seed) * 0.4
        length = 2.6 + hash3(k, 3, 1, seed) * 0.8
        lift = 0.5 + hash3(k, 5, 7, seed) * 0.4
        dx, dz = math.cos(a), math.sin(a)
        px, pz = -dz, dx
        steps = 7
        prev = None
        for st in range(steps + 1):
            t = st / steps
            # oblouk: nahoru, pak dolů
            y = top[1] + lift * math.sin(t * math.pi * 0.8) - 1.6 * t * t
            x = top[0] + dx * length * t
            z = dz * length * t
            w = 0.55 * math.sin(math.pi * min(1.0, t * 1.15 + 0.08)) + 0.05   # šířka lístků
            mid = (x, y + 0.06, z)
            left = (x + px * w, y - 0.18 * w, z + pz * w)
            right = (x - px * w, y - 0.18 * w, z - pz * w)
            if prev:
                pm, pl, pr = prev
                fronds_dark += [pm, pl, mid, mid, pl, left]
                fronds_light += [pm, mid, pr, pr, mid, right]
            prev = (mid, left, right)
    nuts = []
    for k in range(3):
        a = k / 3 * 2 * math.pi + 0.5
        nuts += ico(0.16, (top[0] + math.cos(a) * 0.22, top[1] - 0.25, math.sin(a) * 0.22), (1, 1.1, 1), k + 5, 0.15, 0)
    return [(trunk_tris, (0.5, 0.38, 0.26), False), (ring_tris, (0.4, 0.3, 0.2), False),
            (fronds_dark, (0.2, 0.36, 0.12), True), (fronds_light, (0.3, 0.48, 0.17), True),
            (nuts, (0.36, 0.26, 0.14), False)]
write_gltf("palm", palm_model())

# ---------------------------------------------------------------- další tvary z Unity verze (MeshKit)
# stan Legie: jehlan o čtyřech stranách (Scenery.BuildCamp: Cone(2.2, 2.6, 4, 1))
write_gltf("tent", [(cone(2.2, 2.6, 4, 1, 0.0, 0, 0.0), (0.45, 0.16, 0.12), False)])
# suchý keř (DesertScenery): sedm tenkých prutů a zploštělý chomáč
bush = []
for k in range(7):
    a = k / 7 * 2 * math.pi
    bush += rot(cone(0.05, 0.9, 3, 1, 0.0, 0, 0.0), ax=math.cos(a) * 45, az=math.sin(a) * 45)
bush += move(ico(0.35, (0, 0, 0), (1, 1, 1), 2, 0.4, 0), dy=0.25, s=(1.3, 0.6, 1.3))
write_gltf("bush", [(bush, (0.5, 0.4, 0.27), True)])
# rákos u oázy
write_gltf("reed", [(cone(0.04, 1.4, 3, 1, 0.0, 0, 0.0), (0.55, 0.55, 0.3), True)])
# kůl zátarasy
write_gltf("stake", [(cylinder(0.14, 0.05, 2.2, 5), (0.5, 0.38, 0.26), False)])
# loď v zátoce: dřevěný trup z žeber (zúžený k přídi i zádi, zvednutá záď a příď), červený pruh
# u okraje, paluba, bronzové kly na přídi, stěžeň s ráhnem, vydutá pruhovaná plachta a vesla
def ship_model():
    L, W, D = 11.0, 1.5, 1.1           # délka, poloviční šířka, ponor od okraje
    nz, prof = 16, 7
    def section(t):                    # t = -1 (záď) .. 1 (příď)
        w = W * max(0.05, (1 - abs(t) ** 2.2)) ** 0.6
        rise = 0.55 * abs(t) ** 3 + (0.5 * t ** 6 if t > 0 else 0.9 * t ** 6)
        pts = []
        for i in range(prof + 1):
            u = i / prof                   # 0 = levý okraj, 1 = pravý okraj
            ang = math.pi * u
            x = -math.cos(ang) * w
            y = 1.0 + rise - math.sin(ang) * D * (0.35 + 0.65 * (1 - abs(t) ** 4))
            pts.append((x, y, t * L / 2))
        return pts
    secs = [section(-1 + 2 * k / nz) for k in range(nz + 1)]
    planks_a, planks_b, stripe = [], [], []
    for k in range(nz):
        a, b = secs[k], secs[k + 1]
        for i in range(prof):
            quad = [a[i], b[i], a[i + 1], a[i + 1], b[i], b[i + 1]]
            if i == 0 or i == prof - 1:
                stripe += quad
            elif i % 2:
                planks_a += quad
            else:
                planks_b += quad
    # čela na koncích (uzavřít trup)
    for sec, flip in ((secs[0], True), (secs[-1], False)):
        c = (0.0, sum(p[1] for p in sec) / len(sec), sec[0][2])
        for i in range(prof):
            tri = [c, sec[i], sec[i + 1]] if flip else [c, sec[i + 1], sec[i]]
            planks_b += tri
    deck = []
    for k in range(nz):
        a, b = secs[k], secs[k + 1]
        la, ra, lb, rb = a[0], a[-1], b[0], b[-1]
        da, db = 0.12, 0.12
        la, ra = (la[0] * 0.92, la[1] - da, la[2]), (ra[0] * 0.92, ra[1] - da, ra[2])
        lb, rb = (lb[0] * 0.92, lb[1] - db, lb[2]), (rb[0] * 0.92, rb[1] - db, rb[2])
        deck += [la, lb, ra, ra, lb, rb]
    bronze = move(rot(cone(0.28, 1.1, 5, 1, 0.0, 0, 0.0), ax=90), dy=0.45, dz=L / 2 + 0.1)
    mast = move(cylinder(0.12, 0.08, 7.5, 6), dy=1.0, dz=0.6)
    yard = move(rot(cylinder(0.07, 0.07, 6.0, 5), az=90), dx=3.0, dy=7.3, dz=0.85)
    # plachta: vydutá mřížka 6 x 5, svislé pruhy střídavě krémové a rudé
    sail_cream, sail_red = [], []
    cols, rows = 6, 5
    def sp(i, j):
        u, v = i / cols, j / rows
        bulge = 0.55 * math.sin(math.pi * u) * math.sin(math.pi * (0.15 + 0.85 * v))
        return (-2.8 + 5.6 * u, 3.2 + 4.0 * v, 0.95 + bulge)
    for i in range(cols):
        for j in range(rows):
            q = [sp(i, j), sp(i + 1, j), sp(i, j + 1), sp(i, j + 1), sp(i + 1, j), sp(i + 1, j + 1)]
            (sail_red if i in (1, 4) else sail_cream).extend(q)
    oars = []
    for k in range(7):
        z = -3.2 + k * 1.05
        for side in (-1, 1):
            oars += move(rot(box(0.09, 0.07, 3.0), ay=90, az=side * -28), dx=side * (W + 0.9), dy=0.85, dz=z)
    return [(planks_a, (0.42, 0.27, 0.15), True), (planks_b, (0.35, 0.22, 0.12), True),
            (stripe, (0.55, 0.14, 0.1), True), (deck, (0.62, 0.48, 0.32), True),
            (bronze, (0.7, 0.5, 0.25), False), (mast + yard, (0.38, 0.28, 0.18), False),
            (sail_cream, (0.86, 0.8, 0.66), True), (sail_red, (0.62, 0.16, 0.12), True),
            (oars, (0.5, 0.38, 0.24), False)]
write_gltf("ship", ship_model())
# vybělený vrak na Solném pobřeží (DesertScenery.BuildWreck)
wreck = box(3, 1.2, 9)
for k in range(7):
    wreck += move(rot(box(0.22, 2.6, 0.25), az=-25), dx=1.4, dy=1.1, dz=-4 + k * 1.3)
wreck += move(rot(cylinder(0.14, 0.1, 6, 6), az=70), dy=0.5, dz=1)
write_gltf("wreck", [(wreck, (0.78, 0.72, 0.62), False)])
# zelený keř (sever: louky a okraje lesa) – stejný tvar, svěží barva
write_gltf("bush_green", [(bush, (0.27, 0.36, 0.16), True)])
