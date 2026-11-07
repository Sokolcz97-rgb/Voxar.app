"""Realistické postavy Eryndoru z MakeHumanu (CC0) + brnění na míru + animace přenesené z KayKitu.

  python3 tools/mh_build.py [--mh <data MPFB2>] [--assets <systémové assety MakeHumanu>]
        -> Assets/Models/humans/*.glb

Zdroje (vše CC0):
  * MPFB2 data (src/mpfb/data): základní mesh hm08, morfy (pohlaví, věk, svaly, váha, výška, uši…),
    kostra game_engine (53 kostí jako v UE) s vahami,
  * MakeHuman system assets: kůže, oči, obočí, řasy, vlasy,
  * KayKit Adventurers: 76 animací – přenesou se (retarget) z kostry KayKitu na kostru MakeHumanu.
Brnění se staví přímo z těla (skořepiny obepínající oblasti těla s vahami těla) + tuhé díly na kostech.
Každý díl je zvláštní uzel glTF (Body, Armor_Chest, Helm…), takže ve hře jde vybírat přes entity.show_part
a oblékat přes entity.equip.
"""
import argparse
import gzip
import io
import json
import math
import os
import struct
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from meshkit import Mesh, cylinder, lathe, merge, sphere, crystal, rot_matrix, fbm  # noqa: E402

OUT = os.path.join(HERE, "..", "Assets", "Models", "humans")
SCRATCH = os.environ.get("ERYNDOR_MH_DIR", "")
UNIT = 0.1   # MakeHuman: decimetry -> metry


# ================================================================== načítání MakeHumanu
def load_obj(path):
    V, VT, F, G = [], [], [], []
    group = ""
    for line in open(path, encoding="utf-8", errors="ignore"):
        if line.startswith("v "):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vt "):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith("g "):
            group = line.split()[1].strip()
        elif line.startswith("f "):
            vs, ts = [], []
            for tok in line.split()[1:]:
                p = tok.split("/")
                vs.append(int(p[0]) - 1)
                ts.append(int(p[1]) - 1 if len(p) > 1 and p[1] else -1)
            F.append((vs, ts))
            G.append(group)
    return np.array(V, np.float64), np.array(VT, np.float64) if VT else np.zeros((0, 2)), F, G


def load_target(path):
    op = gzip.open if path.endswith(".gz") else open
    idx, d = [], []
    with op(path, "rt") as f:
        for line in f:
            p = line.split()
            if len(p) == 4 and not line.startswith("#"):
                idx.append(int(p[0]))
                d.append([float(p[1]), float(p[2]), float(p[3])])
    return np.array(idx, np.int64), np.array(d, np.float64)


def apply_targets(V, mh, targets):
    V = V.copy()
    for rel, w in targets:
        if w == 0:
            continue
        p = os.path.join(mh, "targets", rel)
        if not os.path.exists(p):
            p += ".gz" if os.path.exists(p + ".gz") else ""
        idx, d = load_target(p)
        if len(idx):   # výchozí kombinace (average/average) je prázdný morf
            V[idx] += d * w
    return V


def group_vertices(F, G, name):
    vs = set()
    for (f, _), g in zip(F, G):
        if g == name:
            vs.update(f)
    return sorted(vs)


def load_mhclo(path):
    """Proxy MakeHumanu (oblečení, vlasy, oči): vrcholy navázané na trojúhelníky těla."""
    info = {"refs": [], "scales": {}}
    mode = None
    for line in open(path, encoding="utf-8", errors="ignore"):
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        p = s.split()
        if p[0] == "verts":
            mode = "verts"
            continue
        if p[0] in ("delete_verts", "weights"):
            mode = p[0]
            continue
        if mode == "verts":
            if len(p) >= 9:
                info["refs"].append(([int(p[0]), int(p[1]), int(p[2])], [float(p[3]), float(p[4]), float(p[5])],
                                     [float(p[6]), float(p[7]), float(p[8])]))
            elif len(p) == 1:
                info["refs"].append(([int(p[0])] * 3, [1.0, 0, 0], [0, 0, 0]))
            continue
        if p[0] in ("x_scale", "y_scale", "z_scale"):
            info["scales"][p[0][0]] = (int(p[1]), int(p[2]), float(p[3]))
        elif p[0] in ("obj_file", "material", "name"):
            info[p[0]] = p[1]
    return info


def fit_proxy(info, V):
    sc = np.ones(3)
    for k, ax in (("x", 0), ("y", 1), ("z", 2)):
        if k in info["scales"]:
            a, b, ref = info["scales"][k]
            sc[ax] = abs(V[a, ax] - V[b, ax]) / ref
    out = np.zeros((len(info["refs"]), 3))
    for i, (vs, ws, d) in enumerate(info["refs"]):
        out[i] = V[vs[0]] * ws[0] + V[vs[1]] * ws[1] + V[vs[2]] * ws[2] + np.array(d) * sc
    return out


def load_mhmat(path):
    m = {}
    for line in open(path, encoding="utf-8", errors="ignore"):
        p = line.split()
        if len(p) >= 2 and not line.startswith("#"):
            m[p[0]] = p[1:]
    return m


# ================================================================== kostra a váhy
def bone_points(rig, V, F, G):
    groups = {}

    def cube(name):
        if name not in groups:
            groups[name] = group_vertices(F, G, name)
        vs = groups[name]
        return V[vs].mean(0) if vs else None

    def point(spec):
        st = spec.get("strategy")
        if st == "CUBE":
            p = cube(spec["cube_name"])
            if p is not None:
                return p
        if st == "MEAN" and spec.get("vertex_indices"):
            return V[spec["vertex_indices"]].mean(0)
        if st == "VERTEX" and "vertex_index" in spec:
            return V[spec["vertex_index"]]
        dp = spec["default_position"]   # Blender (Z nahoru, −Y vpřed) -> MakeHuman (Y nahoru, +Z vpřed), dm
        return np.array([dp[0], dp[2], -dp[1]]) / UNIT
    heads, tails = {}, {}
    for name, b in rig.items():
        heads[name] = point(b["head"])
        tails[name] = point(b["tail"])
    return heads, tails


def order_bones(rig):
    order, seen = [], set()

    def visit(n):
        if n in seen:
            return
        p = rig[n]["parent"]
        if p:
            visit(p)
        seen.add(n)
        order.append(n)
    for n in rig:
        visit(n)
    return order


# ================================================================== KayKit: animace pro přenos
def read_glb(path):
    d = open(path, "rb").read()
    jl = struct.unpack("<I", d[12:16])[0]
    j = json.loads(d[20:20 + jl])
    bl = struct.unpack("<I", d[20 + jl:24 + jl])[0]
    return j, d[28 + jl:28 + jl + bl]


def accessor(j, bn, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
    dt = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}[a["componentType"]]
    off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride", 0) or np.dtype(dt).itemsize * n
    raw = np.frombuffer(bn, np.uint8, count=stride * (a["count"] - 1) + np.dtype(dt).itemsize * n, offset=off)
    arr = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], np.dtype(dt).itemsize * n), strides=(stride, 1)).copy()
    return arr.view(dt).reshape(a["count"], n).astype(np.float64)


def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def mat_quat(m):
    t = np.trace(m)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2
        return np.array([(m[2, 1] - m[1, 2]) / s, (m[0, 2] - m[2, 0]) / s, (m[1, 0] - m[0, 1]) / s, 0.25 * s])
    if m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = math.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        return np.array([0.25 * s, (m[0, 1] + m[1, 0]) / s, (m[0, 2] + m[2, 0]) / s, (m[2, 1] - m[1, 2]) / s])
    if m[1, 1] > m[2, 2]:
        s = math.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        return np.array([(m[0, 1] + m[1, 0]) / s, 0.25 * s, (m[1, 2] + m[2, 1]) / s, (m[0, 2] - m[2, 0]) / s])
    s = math.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
    return np.array([(m[0, 2] + m[2, 0]) / s, (m[1, 2] + m[2, 1]) / s, 0.25 * s, (m[1, 0] - m[0, 1]) / s])


def slerp(a, b, t):
    d = np.dot(a, b)
    if d < 0:
        b, d = -b, -d
    if d > 0.9995:
        r = a + (b - a) * t
        return r / np.linalg.norm(r)
    th = math.acos(min(1.0, d))
    return (math.sin((1 - t) * th) * a + math.sin(t * th) * b) / math.sin(th)


def align_rot(a, b):
    """Rotace, která natočí směr a do směru b."""
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.9999:
        axis = np.cross(a, [1, 0, 0])
        if np.linalg.norm(axis) < 1e-6:
            axis = np.cross(a, [0, 1, 0])
        axis /= np.linalg.norm(axis)
        return 2 * np.outer(axis, axis) - np.eye(3)
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx / (1 + c)


class KayKitAnims:
    """Kostra a animace KayKitu: světové rotace kostí v klidu a v čase."""

    def __init__(self, path):
        j, bn = read_glb(path)
        self.j, self.bn = j, bn
        nodes = j["nodes"]
        self.names = [n.get("name", "") for n in nodes]
        self.parent = [-1] * len(nodes)
        for i, n in enumerate(nodes):
            for c in n.get("children", []):
                self.parent[c] = i
        self.rest_t = [np.array(n.get("translation", [0, 0, 0]), np.float64) for n in nodes]
        self.rest_r = [np.array(n.get("rotation", [0, 0, 0, 1]), np.float64) for n in nodes]
        self.rest_s = [np.array(n.get("scale", [1, 1, 1]), np.float64) for n in nodes]
        self.order = []
        seen = set()

        def visit(i):
            if i in seen:
                return
            if self.parent[i] >= 0:
                visit(self.parent[i])
            seen.add(i)
            self.order.append(i)
        for i in range(len(nodes)):
            visit(i)
        self.rest_world = self.world(self.rest_t, self.rest_r)

    def world(self, T, R):
        W = [None] * len(T)
        for i in self.order:
            M = np.eye(4)
            M[:3, :3] = qmat(R[i]) * self.rest_s[i]
            M[:3, 3] = T[i]
            W[i] = (W[self.parent[i]] @ M) if self.parent[i] >= 0 else M
        return W

    def node(self, name):
        return self.names.index(name)

    def clips(self):
        out = []
        for a in self.j.get("animations", []):
            ch = []
            dur = 0.0
            for c in a["channels"]:
                s = a["samplers"][c["sampler"]]
                times = accessor(self.j, self.bn, s["input"])[:, 0]
                vals = accessor(self.j, self.bn, s["output"])
                dur = max(dur, float(times[-1]))
                ch.append((c["target"]["node"], c["target"]["path"], times, vals))
            out.append((a["name"], dur, ch))
        return out

    def sample(self, channels, t):
        T = [x.copy() for x in self.rest_t]
        R = [x.copy() for x in self.rest_r]
        for node, path, times, vals in channels:
            if t <= times[0]:
                v = vals[0]
            elif t >= times[-1]:
                v = vals[-1]
            else:
                k = int(np.searchsorted(times, t)) - 1
                u = (t - times[k]) / max(times[k + 1] - times[k], 1e-9)
                v = slerp(vals[k], vals[k + 1], u) if path == "rotation" else vals[k] * (1 - u) + vals[k + 1] * u
            if path == "rotation":
                R[node] = v / np.linalg.norm(v)
            elif path == "translation":
                T[node] = v
        return self.world(T, R)


# kost MakeHumanu -> kost KayKitu (pohyb se přenáší ve světových rotacích)
MAP = {"pelvis": "hips", "spine_01": "spine", "spine_03": "chest", "head": "head",
       "upperarm_l": "upperarm.l", "lowerarm_l": "lowerarm.l", "hand_l": "hand.l",
       "upperarm_r": "upperarm.r", "lowerarm_r": "lowerarm.r", "hand_r": "hand.r",
       "thigh_l": "upperleg.l", "calf_l": "lowerleg.l", "foot_l": "foot.l", "ball_l": "toes.l",
       "thigh_r": "upperleg.r", "calf_r": "lowerleg.r", "foot_r": "foot.r", "ball_r": "toes.r"}
# směr kosti v KayKitu (od kosti k jejímu „konci“) pro zarovnání klidových póz
KK_TAIL = {"upperarm.l": "lowerarm.l", "lowerarm.l": "wrist.l", "hand.l": ("wrist.l", "hand.l"),
           "upperarm.r": "lowerarm.r", "lowerarm.r": "wrist.r", "hand.r": ("wrist.r", "hand.r"),
           "upperleg.l": "lowerleg.l", "lowerleg.l": "foot.l", "foot.l": "toes.l",
           "upperleg.r": "lowerleg.r", "lowerleg.r": "foot.r", "foot.r": "toes.r"}


def _rz(deg):
    a = math.radians(deg)
    return np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])


# korekce proporcí (KayKit = postavičky se širokým tělem): paže a nohy celým řetězcem blíž k tělu
ARM_IN, LEG_IN = 34.0, 7.0
CORR = {}
for _b in ("upperarm_l", "lowerarm_l", "hand_l"):
    CORR[_b] = _rz(-ARM_IN)
for _b in ("upperarm_r", "lowerarm_r", "hand_r"):
    CORR[_b] = _rz(ARM_IN)
for _b in ("thigh_l", "calf_l", "foot_l", "ball_l"):
    CORR[_b] = _rz(-LEG_IN)
for _b in ("thigh_r", "calf_r", "foot_r", "ball_r"):
    CORR[_b] = _rz(LEG_IN)


def retarget(kk, order, parent, heads, tails, leg_ratio, mh_hips):
    """-> [(jméno, délka, smyčka, {kost: [(t, quat)]}, pánev [(t, xyz)])]"""
    nidx = {n: kk.node(MAP[n]) for n in MAP if MAP[n] in kk.names}
    # zarovnání: světová rotace MH kosti v klidu = A (natočí MH kost do směru KayKit kosti)
    align = {}
    for m, ki in nidx.items():
        kname = MAP[m]
        tail = KK_TAIL.get(kname)
        if isinstance(tail, tuple):
            kd = kk.rest_world[kk.node(tail[1])][:3, 3] - kk.rest_world[kk.node(tail[0])][:3, 3]
            md = tails[m] - heads[m]
            align[m] = align_rot(md, kd)
        elif tail in kk.names:
            kd = kk.rest_world[kk.node(tail)][:3, 3] - kk.rest_world[ki][:3, 3]
            md = tails[m] - heads[m]
            align[m] = align_rot(md, kd)
        else:
            align[m] = np.eye(3)
    hips_k = kk.node("hips")
    rest_hips = kk.rest_world[hips_k][:3, 3]
    clips = []
    for name, dur, ch in kk.clips():
        fps = 30
        nf = max(2, int(round(dur * fps)) + 1)
        times = np.linspace(0, dur, nf)
        rots = {b: [] for b in order}
        hips = []
        for t in times:
            W = kk.sample(ch, float(t))
            world = {}
            for b in order:
                if b in nidx:
                    ki = nidx[b]
                    delta = W[ki][:3, :3] @ np.linalg.inv(kk.rest_world[ki][:3, :3])
                    # odstranit měřítko (KayKit má na kořeni měřítko)
                    u, _, vt = np.linalg.svd(delta)
                    delta = u @ vt
                    world[b] = CORR.get(b, np.eye(3)) @ delta @ align[b]
                else:
                    world[b] = world[parent[b]] if parent[b] else np.eye(3)
            for b in order:
                pw = world[parent[b]] if parent[b] else np.eye(3)
                rots[b].append(mat_quat(pw.T @ world[b]))
            d = (W[hips_k][:3, 3] - rest_hips)
            # KayKit kořen: světové osy glTF (Y nahoru); posun pánve v měřítku nohou
            hips.append(d * leg_ratio)
        clips.append((name, dur, not any(k in name for k in ("Attack", "Death", "Hit", "Jump_", "Shoot", "Throw", "Use_Item",
                                                               "Cheer", "Dodge", "Spellcast_Shoot", "Spellcast_Raise", "Block_Attack",
                                                               "Block_Hit", "Interact", "PickUp", "Reload", "Lie_", "Sit_", "_Down",
                                                               "_StandUp", "Spellcast_Long")), times, rots, hips))
    retarget.align = align
    return clips


# ================================================================== brnění na míru tělu
class Part:
    """Díl postavy: síť s UV / barvami, váhy kostí (Nx4) a materiál."""

    def __init__(self, name, P, N, I, J, W, mat, UV=None, C=None):
        self.name, self.P, self.N, self.I, self.J, self.W, self.mat = name, P, N, I, J, W, mat
        self.UV, self.C = UV, C


def vertex_normals(P, I):
    fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
    N = np.zeros_like(P)
    for k in range(3):
        np.add.at(N, I[:, k], fn)
    L = np.linalg.norm(N, axis=1, keepdims=True)
    return N / np.maximum(L, 1e-12)


def shell(body, mask, offset, name, mat, color_fn, smooth=2, rim=True):
    """Skořepina z oblasti těla (mask = vrcholy), odsazená po normále – sedí na tělo a deformuje se s ním."""
    P, I = body["P"], body["I"]
    keep = mask[I].all(axis=1)
    tris = I[keep]
    used = np.unique(tris)
    remap = -np.ones(len(P), np.int64)
    remap[used] = np.arange(len(used))
    T = remap[tris]
    Q = P[used].copy()
    N = body["N"][used]
    # vyhlazení tvaru (brnění nekopíruje každý sval)
    adj_e = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
    adj_e = np.concatenate([adj_e, adj_e[:, ::-1]])
    deg = np.bincount(adj_e[:, 0], minlength=len(Q)).astype(np.float64)
    for _ in range(smooth):
        acc = np.zeros_like(Q)
        np.add.at(acc, adj_e[:, 0], Q[adj_e[:, 1]])
        Q = Q * 0.5 + 0.5 * acc / np.maximum(deg[:, None], 1)
    off = offset(P[used], N) if callable(offset) else np.full(len(used), offset)
    Q = Q + N * off[:, None]
    J, W = body["J"][used], body["W"][used]
    C = color_fn(P[used], N)
    parts = [Part(name, Q, None, T, J, W, mat, C=C)]
    if rim:   # okraj: zlatý / ocelový lem po hranici skořepiny
        e = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
        key = np.sort(e, axis=1)
        _, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
        border = e[cnt[inv.reshape(-1)] == 1]
        if len(border):
            Pa, Na = Q, vertex_normals(Q, T)
            rp, ri = [], []
            for a, b in border:
                base = len(rp)
                for v in (a, b):
                    rp.append(Pa[v] + Na[v] * 0.004)
                    rp.append(Pa[v] - Na[v] * 0.006 + (Pa[v] - Q.mean(0)) * 0.0)
                ri += [[base, base + 2, base + 1], [base + 1, base + 2, base + 3]]
            rp = np.array(rp)
            rj = np.repeat(J[border.reshape(-1)], 2, axis=0)
            rw = np.repeat(W[border.reshape(-1)], 2, axis=0)
            parts.append(("rim", rp, np.array(ri), rj, rw))
    return parts


# ================================================================== zápis GLB
class Writer:
    def __init__(self):
        self.data = bytearray()
        self.views, self.accs = [], []

    def view(self, raw, target=None):
        while len(self.data) % 4:
            self.data += b"\0"
        v = {"buffer": 0, "byteOffset": len(self.data), "byteLength": len(raw)}
        if target:
            v["target"] = target
        self.data += raw
        self.views.append(v)
        return len(self.views) - 1

    def acc(self, arr, ctype, typ, target=None, minmax=False):
        arr = np.ascontiguousarray(arr)
        a = {"bufferView": self.view(arr.tobytes(), target), "componentType": ctype, "count": int(arr.shape[0]), "type": typ}
        if minmax:
            f = arr.reshape(arr.shape[0], -1)
            a["min"] = [float(x) for x in f.min(0)]
            a["max"] = [float(x) for x in f.max(0)]
        self.accs.append(a)
        return len(self.accs) - 1


def png_bytes(img, size=None):
    if size:
        img = img.resize((size, size), Image.LANCZOS)
    b = io.BytesIO()
    img.save(b, "PNG", optimize=True)
    return b.getvalue()


# ================================================================== sestavení postavy
def top4(Wfull):
    """(N, kosti) -> indexy a váhy 4 nejsilnějších."""
    order = np.argsort(-Wfull, axis=1)[:, :4]
    w = np.take_along_axis(Wfull, order, axis=1)
    s = w.sum(1, keepdims=True)
    s[s <= 0] = 1
    w = w / s
    order[Wfull.sum(1) <= 0] = 0
    return order.astype(np.uint16), w.astype(np.float32)


class Human:
    def __init__(self, mh, assets, targets):
        self.mh, self.assets = mh, assets
        V, VT, F, G = load_obj(os.path.join(mh, "3dobjs", "base.obj"))
        V = apply_targets(V, mh, targets)
        self.V0 = V
        self.F, self.G = F, G
        rig = json.load(open(os.path.join(mh, "rigs", "standard", "rig.game_engine.json")))
        self.order = order_bones(rig)
        self.parent = {b: rig[b]["parent"] for b in self.order}
        heads, tails = bone_points(rig, V, F, G)
        body_faces = [i for i, g in enumerate(G) if g == "body"]
        bv = sorted({v for i in body_faces for v in F[i][0]})
        ground = V[bv, 1].min()
        self.shift = np.array([0, -ground, 0])
        self.Vm = (V + self.shift) * UNIT
        self.heads = {b: (heads[b] + self.shift) * UNIT for b in self.order}
        self.tails = {b: (tails[b] + self.shift) * UNIT for b in self.order}
        self.heads["Root"] = np.array([0.0, 0.0, 0.0])
        wj = json.load(open(os.path.join(mh, "rigs", "standard", "weights.game_engine.json")))["weights"]
        self.bidx = {b: i for i, b in enumerate(self.order)}
        Wfull = np.zeros((len(V), len(self.order)))
        for b, lst in wj.items():
            if b in self.bidx:
                for v, w in lst:
                    Wfull[int(v), self.bidx[b]] += w
        self.Wfull = Wfull
        # svařená síť těla (pro brnění)
        tris = []
        for i in body_faces:
            f = F[i][0]
            for k in range(1, len(f) - 1):
                tris.append([f[0], f[k], f[k + 1]])
        self.Iw = np.array(tris, np.int64)
        J, W = top4(Wfull)
        self.body = {"P": self.Vm, "I": self.Iw, "J": J, "W": W, "N": vertex_normals(self.Vm, self.Iw)}
        self.VT, self.body_faces = VT, body_faces
        self.parts = []

    def weights_of(self, refs):
        Wf = np.zeros((len(refs), len(self.order)))
        for i, (vs, ws, _) in enumerate(refs):
            for v, w in zip(vs, ws):
                Wf[i] += self.Wfull[v] * w
        return top4(Wf)

    def add_body(self, skin_png, tex_size=2048, hide=None):
        F, VT = self.F, self.VT
        key, P, UV, src, I = {}, [], [], [], []
        for i in self.body_faces:
            vs, ts = F[i]
            if hide is not None and all(hide[v] for v in vs):
                continue
            ids = []
            for v, t in zip(vs, ts):
                k = (v, t)
                if k not in key:
                    key[k] = len(P)
                    P.append(self.Vm[v])
                    UV.append(VT[t] if t >= 0 else [0, 0])
                    src.append(v)
                ids.append(key[k])
            for k in range(1, len(ids) - 1):
                I.append([ids[0], ids[k], ids[k + 1]])
        P, UV, src, I = np.array(P), np.array(UV), np.array(src), np.array(I, np.int64)
        J, W = top4(self.Wfull[src])
        img = Image.open(skin_png).convert("RGB")
        self.parts.append(Part("Body", P, vertex_normals(P, I), I, J, W,
                               {"name": "skin", "texture": png_bytes(img, tex_size), "roughness": 0.62}, UV=UV))

    def add_proxy(self, folder, name, material=None, tex_size=1024, alpha=False, uv_flip=True, color=None, part=None):
        d = os.path.join(self.assets, folder, name)
        info = load_mhclo(os.path.join(d, name + ".mhclo"))
        V, VT, F, _ = load_obj(os.path.join(d, info.get("obj_file", name + ".obj")))
        pos = (fit_proxy(info, self.V0) + self.shift) * UNIT
        J, W = self.weights_of(info["refs"])
        key, P, UV, Jn, Wn, I = {}, [], [], [], [], []
        for vs, ts in F:
            ids = []
            for v, t in zip(vs, ts):
                k = (v, t)
                if k not in key:
                    key[k] = len(P)
                    P.append(pos[v])
                    UV.append(VT[t] if t >= 0 and len(VT) else [0, 0])
                    Jn.append(J[v])
                    Wn.append(W[v])
                ids.append(key[k])
            for k in range(1, len(ids) - 1):
                I.append([ids[0], ids[k], ids[k + 1]])
        P, UV, I = np.array(P), np.array(UV), np.array(I, np.int64)
        mat_file = material or os.path.join(d, info.get("material", name + ".mhmat"))
        mm = load_mhmat(mat_file) if os.path.exists(mat_file) else {}
        tex = None
        if "diffuseTexture" in mm:
            tp = os.path.join(os.path.dirname(mat_file), mm["diffuseTexture"][0])
            if os.path.exists(tp):
                img = Image.open(tp)
                img = img.convert("RGBA" if alpha else "RGB")
                if color is not None:   # přebarvení (vlasy)
                    a = np.asarray(img).astype(np.float32)
                    lum = a[..., :3].mean(-1, keepdims=True) / 255
                    a[..., :3] = np.clip(lum * np.array(color) * 255 * 1.6, 0, 255)
                    img = Image.fromarray(a.astype(np.uint8), img.mode)
                tex = png_bytes(img, tex_size)
        mat = {"name": name, "texture": tex, "roughness": 0.5, "alpha": alpha, "double": alpha}
        self.parts.append(Part(part or name, P, vertex_normals(P, I), I, np.array(Jn), np.array(Wn), mat, UV=UV))

    # ---------------------------------------------------------- brnění
    def region(self, bones, extra=None, exclude=None, thresh=0.5):
        """Vrcholy těla, kde součet vah zadaných kostí > práh."""
        idx = [self.bidx[b] for b in bones if b in self.bidx]
        w = self.Wfull[:, idx].sum(1)
        m = w > thresh
        if exclude:
            ex = [self.bidx[b] for b in exclude if b in self.bidx]
            m &= self.Wfull[:, ex].sum(1) < 0.3
        if extra is not None:
            m &= extra(self.Vm)
        return m

    def add_shell(self, name, mask, offset, mat, color_fn, smooth=2, rim_color=None, rim_mat=None):
        body = self.body
        P, I = body["P"], body["I"]
        keep = mask[I].all(axis=1)
        tris = I[keep]
        if not len(tris):
            return
        used = np.unique(tris)
        remap = -np.ones(len(P), np.int64)
        remap[used] = np.arange(len(used))
        T = remap[tris]
        Q = P[used].copy()
        N = body["N"][used]
        e = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
        e2 = np.concatenate([e, e[:, ::-1]])
        deg = np.bincount(e2[:, 0], minlength=len(Q)).astype(np.float64)
        for _ in range(smooth):
            acc = np.zeros_like(Q)
            np.add.at(acc, e2[:, 0], Q[e2[:, 1]])
            Q = Q * 0.5 + 0.5 * acc / np.maximum(deg[:, None], 1)
        off = offset(P[used], N) if callable(offset) else np.full(len(used), float(offset))
        Q = Q + N * off[:, None]
        J, W = body["J"][used], body["W"][used]
        C = np.clip(color_fn(P[used], N), 0, 1)
        Nq = vertex_normals(Q, T)
        self.parts.append(Part(name, Q, Nq, T, J, W, mat, C=np.concatenate([C, np.ones((len(C), 1))], 1)))
        if rim_color is not None:
            key = np.sort(e, axis=1)
            _, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True)
            border = e[cnt[inv.reshape(-1)] == 1]
            # lem: pásek kolem hranice skořepiny (o kousek nad povrchem), normála od středu hrany ven
            cen = Q.mean(0)
            rp, rn, ri, rj, rw = [], [], [], [], []
            for a, b in border:
                base = len(rp)
                for v in (a, b):
                    out = Nq[v]
                    rp += [Q[v] + out * 0.007, Q[v] - out * 0.004]
                    rn += [out, out]
                    rj += [J[v], J[v]]
                    rw += [W[v], W[v]]
                ri += [[base, base + 2, base + 1], [base + 1, base + 2, base + 3]]
            if rp:
                rp = np.array(rp)
                ri = np.array(ri, np.int64)
                ri = np.concatenate([ri, ri[:, ::-1]])
                C2 = np.tile(np.array(list(rim_color) + [1.0]), (len(rp), 1))
                self.parts.append(Part(name + "_Trim", rp, np.array(rn), ri, np.array(rj), np.array(rw),
                                       dict(rim_mat or {"name": "trim", "roughness": 0.3, "metallic": 0.9}, double=True), C=C2))

    def add_rigid(self, name, mesh, bone, mat, color=None):
        """Tuhý díl (nárameník, helma, opasek) navázaný na jednu kost."""
        n = len(mesh.P)
        J = np.zeros((n, 4), np.uint16)
        J[:, 0] = self.bidx[bone]
        W = np.zeros((n, 4), np.float32)
        W[:, 0] = 1
        C = mesh.C.copy()
        if color is not None:
            C[:, :3] = color
        P = mesh.P.astype(np.float64)
        N = mesh.normals().astype(np.float64)
        if mesh.flat:
            P = P[mesh.I.reshape(-1)]
            C = C[mesh.I.reshape(-1)]
            I = np.arange(len(P)).reshape(-1, 3)
            fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
            fn /= np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-12)
            N = np.repeat(fn, 3, axis=0)
            J = np.repeat(J[:1], len(P), axis=0)
            W = np.repeat(W[:1], len(P), axis=0)
        else:
            I = mesh.I
        self.parts.append(Part(name, P, N, I, J, W, mat, C=C))

    # ---------------------------------------------------------- zápis
    def write(self, path, clips):
        w = Writer()
        materials, meshes, nodes = [], [], []
        images, textures = [], []
        names = self.order
        for part in self.parts:
            m = part.mat
            mat = {"name": m.get("name", part.name), "pbrMetallicRoughness": {
                "baseColorFactor": list(m.get("color", (1, 1, 1))) + [1.0],
                "roughnessFactor": float(m.get("roughness", 0.8)), "metallicFactor": float(m.get("metallic", 0.0))}}
            if m.get("texture"):
                images.append({"bufferView": w.view(m["texture"]), "mimeType": "image/png"})
                textures.append({"source": len(images) - 1})
                mat["pbrMetallicRoughness"]["baseColorTexture"] = {"index": len(textures) - 1}
            if m.get("alpha"):
                mat["alphaMode"] = "MASK"
                mat["alphaCutoff"] = 0.4
            if m.get("double"):
                mat["doubleSided"] = True
            if m.get("emissive"):
                mat["emissiveFactor"] = list(m["emissive"])
            materials.append(mat)
            attrs = {"POSITION": w.acc(part.P.astype(np.float32), 5126, "VEC3", 34962, True),
                     "NORMAL": w.acc((part.N if part.N is not None else vertex_normals(part.P, part.I)).astype(np.float32), 5126, "VEC3", 34962),
                     "JOINTS_0": w.acc(part.J.astype(np.uint16), 5123, "VEC4", 34962),
                     "WEIGHTS_0": w.acc(part.W.astype(np.float32), 5126, "VEC4", 34962)}
            if part.UV is not None:
                uv = part.UV.copy()
                uv[:, 1] = 1 - uv[:, 1]
                attrs["TEXCOORD_0"] = w.acc(uv.astype(np.float32), 5126, "VEC2", 34962)
            if part.C is not None:
                attrs["COLOR_0"] = w.acc(part.C.astype(np.float32), 5126, "VEC4", 34962)
            ind = w.acc(part.I.reshape(-1).astype(np.uint32), 5125, "SCALAR", 34963)
            meshes.append({"name": part.name, "primitives": [{"attributes": attrs, "indices": ind, "material": len(materials) - 1}]})
            nodes.append({"name": part.name, "mesh": len(meshes) - 1, "skin": 0})
        first_bone = len(nodes)
        for b in names:
            p = self.parent[b]
            local = self.heads[b] - (self.heads[p] if p else 0)
            nodes.append({"name": b, "translation": [float(x) for x in local]})
        for i, b in enumerate(names):
            p = self.parent[b]
            if p:
                nodes[first_bone + names.index(p)].setdefault("children", []).append(first_bone + i)
        for slot, (bone, off, q) in getattr(self, "slots", {}).items():
            nodes.append({"name": slot, "translation": [float(x) for x in off], "rotation": [float(x) for x in q]})
            nodes[first_bone + names.index(bone)].setdefault("children", []).append(len(nodes) - 1)
        ibm = np.zeros((len(names), 16), np.float32)
        for i, b in enumerate(names):
            m4 = np.eye(4, dtype=np.float32)
            m4[:3, 3] = -self.heads[b]
            ibm[i] = m4.T.reshape(-1)
        root = first_bone + names.index("Root")
        gl = {"asset": {"version": "2.0", "generator": "Eryndor mh_build (MakeHuman CC0)"}, "scene": 0,
              "scenes": [{"nodes": list(range(first_bone)) + [root]}], "nodes": nodes, "meshes": meshes,
              "materials": materials,
              "skins": [{"inverseBindMatrices": w.acc(ibm, 5126, "MAT4"), "joints": list(range(first_bone, first_bone + len(names))), "skeleton": root}]}
        if images:
            gl["images"], gl["textures"] = images, textures
        anims = []
        pelvis_base = self.heads["pelvis"] - self.heads["Root"]
        for name, dur, loop, times, rots, hips in clips:
            tacc = w.acc(times.astype(np.float32).reshape(-1, 1), 5126, "SCALAR", minmax=True)
            samplers, channels = [], []
            for i, b in enumerate(names):
                q = np.array(rots[b], np.float32)
                if np.allclose(q, [0, 0, 0, 1], atol=1e-4):
                    continue
                samplers.append({"input": tacc, "output": w.acc(q, 5126, "VEC4"), "interpolation": "LINEAR"})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": first_bone + i, "path": "rotation"}})
            tr = (np.array(hips) + pelvis_base).astype(np.float32)
            samplers.append({"input": tacc, "output": w.acc(tr, 5126, "VEC3"), "interpolation": "LINEAR"})
            channels.append({"sampler": len(samplers) - 1, "target": {"node": first_bone + names.index("pelvis"), "path": "translation"}})
            anims.append({"name": name, "samplers": samplers, "channels": channels})
        gl["animations"] = anims
        gl["accessors"], gl["bufferViews"], gl["buffers"] = w.accs, w.views, [{"byteLength": len(w.data)}]
        js = json.dumps(gl, separators=(",", ":")).encode()
        while len(js) % 4:
            js += b" "
        while len(w.data) % 4:
            w.data += b"\0"
        with open(path, "wb") as f:
            f.write(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(w.data)))
            f.write(struct.pack("<I4s", len(js), b"JSON"))
            f.write(js)
            f.write(struct.pack("<I4s", len(w.data), b"BIN\0"))
            f.write(w.data)


# ================================================================== výbava (brnění, oděvy) na míru tělu
def rgb(h):
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (1, 3, 5)])


def metal(base, var=0.25, seed=0, scale=9.0):
    """Barvy kovu: lesk nahoře, tmavší spodky, jemné šmouhy (ručně malovaný vzhled)."""
    base = rgb(base) if isinstance(base, str) else np.asarray(base)
    def fn(P, N):
        n = fbm(P, scale, 3, seed)[:, None]
        up = np.clip(N[:, 1:2] * 0.5 + 0.5, 0, 1)
        # rytý vzor: jemné pásy (kování), tmavší spáry
        band = 0.92 + 0.08 * np.sign(np.sin(P[:, 1:2] * 90.0))
        return base * (0.62 + var * 1.6 * n + 0.32 * up) * band
    return fn


def cloth(base, seed=0, scale=14.0):
    base = rgb(base) if isinstance(base, str) else np.asarray(base)
    def fn(P, N):
        n = fbm(P * np.array([1, 3, 1]), scale, 3, seed)[:, None]
        return base * (0.78 + 0.3 * n) * (0.85 + 0.15 * np.clip(N[:, 1:2] * 0.5 + 0.5, 0, 1))
    return fn


STEEL = {"name": "steel", "roughness": 0.55, "metallic": 0.6}
GOLD = {"name": "gold", "roughness": 0.35, "metallic": 0.9}
CLOTH = {"name": "cloth", "roughness": 0.9, "double": True}
LEATHER = {"name": "leather", "roughness": 0.7}


def nearest_weights(h, Q):
    """Váhy pro body mimo tělo (sukně, plášť): od nejbližšího vrcholu těla."""
    P = h.body["P"]
    J, W = h.body["J"], h.body["W"]
    out_j, out_w = np.zeros((len(Q), 4), np.uint16), np.zeros((len(Q), 4), np.float32)
    for k in range(0, len(Q), 512):
        d = ((Q[k:k + 512, None, :] - P[None, :, :]) ** 2).sum(-1)
        nn = d.argmin(1)
        out_j[k:k + 512], out_w[k:k + 512] = J[nn], W[nn]
    return out_j, out_w


def blend_weights(h, pairs):
    """pairs: [(kost, váha)] -> (J, W) jednoho bodu."""
    Wf = np.zeros(len(h.order))
    for b, w in pairs:
        Wf[h.bidx[b]] += w
    j, w = top4(Wf[None, :])
    return j[0], w[0]


def add_panel_skirt(h, name, top_y, bottom_y, panels, flare, mat, color_fn, gap=0.08, offset=0.035, rim=None):
    """Sukně / šosy / roucho z panelů (mezi panely mezera – nohy se pohnou bez natažení látky)."""
    P = h.body["P"]
    rings = 7
    cols = 5
    allP, allI, allJ, allW, allC = [], [], [], [], []
    hip = h.heads["pelvis"]
    legmask = h.Wfull[:, [h.bidx[b] for b in ("pelvis", "spine_01", "thigh_l", "thigh_r", "calf_l", "calf_r")]].sum(1) > 0.6
    for pi in range(panels):
        a0 = 2 * math.pi * pi / panels + gap / 2
        a1 = 2 * math.pi * (pi + 1) / panels - gap / 2
        base = len(allP)
        for r in range(rings):
            t = r / (rings - 1)
            y = top_y + (bottom_y - top_y) * t
            # průřez těla v této výšce (poloměr podle nejvzdálenějších vrcholů pánve a stehen)
            band = P[(np.abs(P[:, 1] - y) < 0.03) & legmask]
            rx = (np.abs(band[:, 0] - hip[0]).max() if len(band) else 0.18) + offset + flare * t * t
            rz = (np.abs(band[:, 2] - hip[2]).max() if len(band) else 0.14) + offset + flare * t * t
            for c in range(cols):
                a = a0 + (a1 - a0) * c / (cols - 1)
                x, z = math.sin(a), math.cos(a)
                q = np.array([hip[0] + x * rx, y, hip[2] + z * rz])
                allP.append(q)
                # váhy: nahoře pánev, dole stehno na té straně (vpředu/vzadu napůl)
                side = "thigh_l" if x > 0 else "thigh_r"
                lat = abs(x)
                wl = min(0.85, t * (0.35 + 0.65 * lat))
                j, w = blend_weights(h, [("pelvis", 1 - wl), (side, wl * 0.8), ("calf_l" if x > 0 else "calf_r", wl * 0.2 * t)])
                allJ.append(j)
                allW.append(w)
        for r in range(rings - 1):
            for c in range(cols - 1):
                a = base + r * cols + c
                allI += [[a, a + cols, a + 1], [a + 1, a + cols, a + cols + 1]]
    Q = np.array(allP)
    I = np.array(allI, np.int64)
    N = vertex_normals(Q, I)
    C = np.clip(color_fn(Q, N), 0, 1)
    h.parts.append(Part(name, Q, N, I, np.array(allJ), np.array(allW), mat, C=np.concatenate([C, np.ones((len(C), 1))], 1)))
    if rim is not None:   # lem dole
        pass


def add_cape(h, name, color, length=1.0, width=0.46, mat=None):
    P = h.body["P"]
    top = h.heads["spine_03"][1] + 0.14
    rows, cols = 12, 9
    pts, J, W = [], [], []
    for r in range(rows):
        t = r / (rows - 1)
        y = top - length * t
        band = P[(np.abs(P[:, 1] - y) < 0.04) & (np.abs(P[:, 0]) < 0.2)]
        back = band[:, 2].min() if len(band) else -0.12
        for c in range(cols):
            u = c / (cols - 1) - 0.5
            wdt = width * (0.75 + 0.5 * t)
            x = u * wdt
            z = min(back, -0.1) - 0.03 - 0.06 * t - 0.04 * (u * 2) ** 2 * (1 - t)
            pts.append([x, y, z])
            if y > h.heads["spine_02"][1]:
                pairs = [("spine_03", 1.0)]
            elif y > h.heads["pelvis"][1]:
                k = (h.heads["spine_02"][1] - y) / max(h.heads["spine_02"][1] - h.heads["pelvis"][1], 1e-3)
                pairs = [("spine_03", 1 - k), ("spine_01", k)]
            else:
                k = min(1.0, (h.heads["pelvis"][1] - y) / 0.5)
                pairs = [("pelvis", 1 - 0.5 * k), ("thigh_l", 0.25 * k), ("thigh_r", 0.25 * k)]
            j, w = blend_weights(h, pairs)
            J.append(j)
            W.append(w)
    Q = np.array(pts)
    I = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            a = r * cols + c
            I += [[a, a + 1, a + cols], [a + 1, a + cols + 1, a + cols]]
    I = np.array(I, np.int64)
    I2 = np.concatenate([I, I[:, ::-1]])
    N = vertex_normals(Q, I)
    C = np.clip(cloth(color, 3)(Q, N), 0, 1)
    h.parts.append(Part(name, Q, N, I2, np.array(J), np.array(W), mat or CLOTH, C=np.concatenate([C, np.ones((len(C), 1))], 1)))


def dome(r, sx=1.0, sy=0.8, sz=1.0, seg=16):
    m = sphere(1.0, seg, 10)
    m.P = m.P[:, :] * np.array([r * sx, r * sy, r * sz])
    m.P[:, 1] = np.maximum(m.P[:, 1], -r * sy * 0.15)
    m.invalidate()
    return m


def shoulder_plates(h, side, col, trim, big=1.0, rivets=False, leaf=None):
    s = 1 if side == "l" else -1
    ua = h.heads["upperarm_" + side]
    plates = []
    for k in range(3):
        m = dome(0.11 * big * (1 - 0.13 * k), 1.25, 0.75, 1.15)
        m.rotate(0, 0, -28 * s - k * 6 * s).translate(ua[0] + s * (0.03 + 0.035 * k), ua[1] + 0.05 - 0.055 * k, ua[2])
        plates.append(m)
    h.add_rigid("Armor_Shoulder_" + side.upper(), merge(*plates).paint(lambda P, N: metal(col, seed=3)(P, N)), "upperarm_" + side, STEEL)
    r0 = 0.11 * big
    edge = lathe([(r0 * 1.0, -0.008), (r0 * 1.04, 0), (r0 * 1.0, 0.008)], 24, False, False)
    edge.P = edge.P * np.array([1.25, 1.0, 1.15])
    edge.translate(0, -r0 * 0.75 * 0.12, 0)
    edge.rotate(0, 0, -28 * s).translate(ua[0] + s * 0.03, ua[1] + 0.05, ua[2]).color(rgb(trim))
    h.add_rigid("Armor_Shoulder_" + side.upper() + "_Trim", edge, "upperarm_" + side, GOLD)
    if rivets:
        rv = merge(*[sphere(0.012, 6, 4).translate(ua[0] + s * (0.06 + 0.03 * k), ua[1] + 0.12 - 0.02 * k, ua[2] + (k - 1) * 0.05) for k in range(3)])
        h.add_rigid("Armor_Shoulder_" + side.upper() + "_Rivets", rv.color(rgb(trim)), "upperarm_" + side, GOLD)
    if leaf:
        lf = merge(*[crystal(0.16, 0.03, 4, 0.6, k).rotate(0, 0, (-70 - k * 18) * s).translate(ua[0] + s * 0.1, ua[1] + 0.09, ua[2] + (k - 1) * 0.04)
                     for k in range(3)])
        h.add_rigid("Armor_Shoulder_" + side.upper() + "_Leaf", lf.color(rgb(leaf)), "upperarm_" + side, GOLD)


def belt(h, col, buckle, y_off=0.06):
    hip = h.heads["pelvis"]
    P = h.body["P"]
    y = hip[1] + y_off
    tw = h.Wfull[:, [h.bidx[b] for b in ("pelvis", "spine_01", "spine_02")]].sum(1) > 0.5
    band = P[(np.abs(P[:, 1] - y) < 0.02) & tw]
    rx = np.abs(band[:, 0] - hip[0]).max() + 0.012
    rz = np.abs(band[:, 2] - hip[2]).max() + 0.012
    b = lathe([(1.0, -0.025), (1.03, 0.0), (1.0, 0.025)], 28, False, False)
    b.P = b.P * np.array([rx, 1, rz])
    b.translate(hip[0], y, hip[2]).color(rgb(col))
    h.add_rigid("Belt", b, "pelvis", LEATHER)
    bk = cylinder(0.035, 0.035, 0.012, 10).rotate(90, 0, 0).translate(hip[0], y, hip[2] + rz + 0.006).color(rgb(buckle))
    h.add_rigid("Belt_Buckle", bk, "pelvis", GOLD)


def head_y(h):
    return h.heads["head"][1]


def dress(h, style):
    """Výbava podle stylu (podle lore Eryndoru)."""
    R = h.region
    up_y = lambda y: (lambda V: V[:, 1] > y)
    below = lambda y: (lambda V: V[:, 1] < y)
    hy = head_y(h)
    neck_y = h.heads["neck_01"][1]
    torso = ["spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r", "pelvis"]
    if style in ("syl_knight", "aeth_heavy"):
        syl = style == "syl_knight"
        A = dict(metal="#b8c0c8" if syl else "#4c525c", trim="#d9a840" if syl else "#b8873a",
                 cloth="#1f8f88" if syl else "#8a1e1a", under="#e8e2d2" if syl else "#2e2a2a", leather="#5a3e2a" if syl else "#2a2422")
        # spodní oděv: tunika na trupu, nohavice, rukávy
        h.add_shell("Tunic", R(torso + ["upperarm_l", "upperarm_r", "thigh_l", "thigh_r"], extra=below(neck_y - 0.02)), 0.005,
                    CLOTH, cloth(A["under"], 1))
        h.add_shell("Leggings", R(["thigh_l", "thigh_r", "calf_l", "calf_r"], thresh=0.3), 0.006, LEATHER, cloth(A["leather"], 2))
        # kyrys
        h.add_shell("Armor_Chest", R(["spine_01", "spine_02", "spine_03", "clavicle_l", "clavicle_r"], extra=below(neck_y - 0.03)),
                    0.022 if syl else 0.03, STEEL, metal(A["metal"], seed=1), smooth=6, rim_color=rgb(A["trim"]), rim_mat=GOLD)
        # krk / límec
        h.add_shell("Armor_Gorget", R(["neck_01"], extra=below(neck_y + 0.05)), 0.016, STEEL, metal(A["metal"], seed=2), smooth=4,
                    rim_color=rgb(A["trim"]), rim_mat=GOLD)
        # nátepníky, rukavice, holenice, boty
        h.add_shell("Armor_Bracers", R(["lowerarm_l", "lowerarm_r"], thresh=0.6), 0.014, STEEL, metal(A["metal"], seed=4), smooth=4,
                    rim_color=rgb(A["trim"]), rim_mat=GOLD)
        h.add_shell("Gloves", R(["hand_l", "hand_r"] + [f"{f}_0{k}_{s}" for f in ("index", "middle", "ring", "pinky", "thumb") for k in (1, 2, 3) for s in "lr"],
                    thresh=0.4), 0.004, LEATHER, cloth(A["leather"], 5), smooth=1)
        h.add_shell("Armor_Greaves", R(["calf_l", "calf_r"], thresh=0.6), 0.022, STEEL, metal(A["metal"], seed=6), smooth=4,
                    rim_color=rgb(A["trim"]), rim_mat=GOLD)
        h.add_shell("Boots", R(["foot_l", "foot_r", "ball_l", "ball_r"], thresh=0.4), 0.012, LEATHER, cloth(A["leather"], 7), smooth=2)
        if not syl:   # těžká zbroj: stehenní pláty
            h.add_shell("Armor_Cuisses", R(["thigh_l", "thigh_r"], thresh=0.7, extra=below(h.heads["pelvis"][1] - 0.12)), 0.02, STEEL,
                        metal(A["metal"], seed=8), smooth=4, rim_color=rgb(A["trim"]), rim_mat=GOLD)
        for sd in "lr":
            shoulder_plates(h, sd, A["metal"], A["trim"], big=1.0 if syl else 1.3, rivets=not syl, leaf=None if not syl else "#bfe8e0")
        belt(h, A["leather"], A["trim"])
        add_panel_skirt(h, "Tabard", h.heads["pelvis"][1] + 0.02, h.heads["pelvis"][1] - (0.42 if syl else 0.3), 4, 0.05,
                        CLOTH, cloth(A["cloth"], 9), gap=0.55)
        add_cape(h, "Cape", A["cloth"], length=1.15 if syl else 1.0)
        # helma (ve hře volitelná přes entity.show_part)
        brow = h.heads["head"][1] + 0.085
        h.add_shell("Helm", R(["head"], extra=up_y(brow)), 0.028 if syl else 0.035, STEEL, metal(A["metal"], seed=11), smooth=5,
                    rim_color=rgb(A["trim"]), rim_mat=GOLD)
        hd = h.heads["head"]
        if syl:
            crest = merge(*[crystal(0.16 - 0.03 * k, 0.025, 4, 0.6, k).rotate(-60 + k * 20, 0, 0).translate(hd[0], hd[1] + 0.2, hd[2] - 0.02 - k * 0.04) for k in range(3)])
            h.add_rigid("Helm_Crest", crest.color(rgb("#9fe8ff")), "head", {"name": "aether", "roughness": 0.2, "emissive": [0.15, 0.6, 0.9]})
        else:
            nasal = rounded = sphere(0.02, 6, 4)
            visor = cylinder(0.012, 0.012, 0.09, 6).translate(hd[0], hd[1] + 0.04, hd[2] + 0.13).color(rgb(A["metal"]))
            h.add_rigid("Helm_Nasal", visor, "head", STEEL)
            plume = merge(*[sphere(0.035, 8, 6).translate(hd[0], hd[1] + 0.23 - 0.01 * k, hd[2] - 0.03 - 0.035 * k) for k in range(5)])
            h.add_rigid("Helm_Plume", plume.color(rgb("#9a1a16")), "head", CLOTH)
        # znak na hrudi
        ch = h.heads["spine_03"]
        P = h.body["P"]
        front = P[(np.abs(P[:, 1] - (ch[1] + 0.06)) < 0.02) & (np.abs(P[:, 0]) < 0.04)][:, 2].max() + 0.03
        if syl:
            moon = lathe([(0.055, -0.006), (0.06, 0), (0.055, 0.006)], 18, False, False).rotate(90, 0, 0)
            moon.translate(ch[0], ch[1] + 0.06, front).color(rgb(A["trim"]))
            h.add_rigid("Emblem", moon, "spine_03", GOLD)
            gem = crystal(0.05, 0.016, 4, 0.5, 2).rotate(90, 0, 0).translate(ch[0], ch[1] + 0.06, front + 0.005).color(rgb("#bff4ff"))
            h.add_rigid("Emblem_Gem", gem, "spine_03", {"name": "aether", "roughness": 0.2, "emissive": [0.15, 0.7, 1.0]})
        else:
            core = crystal(0.06, 0.022, 6, 0.5, 4).rotate(90, 0, 0).translate(ch[0], ch[1] + 0.06, front).color(rgb("#ffd08a"))
            h.add_rigid("Emblem_Core", core, "spine_03", {"name": "core", "roughness": 0.3, "emissive": [1.0, 0.5, 0.15]})
            ring = merge(*[lathe([(0.07, -0.008), (0.075, 0), (0.07, 0.008)], 16, False, False).rotate(90, 0, 0)]).translate(ch[0], ch[1] + 0.06, front - 0.004).color(rgb(A["trim"]))
            h.add_rigid("Emblem", ring, "spine_03", GOLD)
    elif style in ("syl_mage", "lyrise"):
        star = style == "lyrise"
        robe = "#2a3aa8" if star else "#1a6a78"
        h.add_shell("Bodice", R(torso + ["upperarm_l", "upperarm_r"], extra=below(neck_y - 0.03)), 0.006, CLOTH, cloth(robe, 1))
        h.add_shell("Sleeves", R(["lowerarm_l", "lowerarm_r"], thresh=0.5), 0.012, CLOTH, cloth("#e8e2d2" if not star else "#3a5ad8", 2), smooth=3)
        h.add_shell("Leggings", R(["thigh_l", "thigh_r", "calf_l", "calf_r"]), 0.004, CLOTH, cloth("#2a2430", 3))
        h.add_shell("Boots", R(["foot_l", "foot_r", "ball_l", "ball_r"], thresh=0.4), 0.01, LEATHER, cloth("#e8e2d2" if not star else "#c8b060", 4), smooth=2)
        add_panel_skirt(h, "Robe", h.heads["pelvis"][1] + 0.05, 0.08, 8, 0.16, CLOTH, cloth(robe, 5), gap=0.12, offset=0.03)
        h.add_shell("Mantle", R(["spine_03", "clavicle_l", "clavicle_r", "upperarm_l", "upperarm_r"], thresh=0.5,
                    extra=lambda V: (V[:, 1] > h.heads["spine_03"][1] + 0.06) & (V[:, 1] < neck_y)), 0.02, CLOTH,
                    cloth("#e8e2d2" if not star else "#1a2470", 6), smooth=4, rim_color=rgb("#d9a840"), rim_mat=GOLD)
        belt(h, "#d9a840" if not star else "#e8c060", "#bff4ff", y_off=0.12)
        add_cape(h, "Cape", "#e8e2d2" if not star else "#1a2470", length=1.25, width=0.5)
        hd = h.heads["head"]
        circ = lathe([(0.098, -0.006), (0.102, 0), (0.098, 0.006)], 28, False, False).translate(hd[0], hd[1] + 0.12, hd[2] + 0.01)
        h.add_rigid("Circlet", circ.color(rgb("#e0b04a")), "head", GOLD)
        gem = crystal(0.035, 0.012, 4, 0.5, 1).rotate(90, 0, 0).translate(hd[0], hd[1] + 0.115, hd[2] + 0.105).color(rgb("#bff4ff"))
        h.add_rigid("Circlet_Gem", gem, "head", {"name": "aether", "roughness": 0.2, "emissive": [0.2, 0.7, 1.0] if not star else [0.6, 0.7, 1.0]})
    elif style == "aeth_engineer":
        h.add_shell("Coat", R(torso + ["upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r"], extra=below(neck_y - 0.02), thresh=0.4), 0.012,
                    LEATHER, cloth("#2e3a2c", 1), smooth=3, rim_color=rgb("#b8873a"), rim_mat=GOLD)
        h.add_shell("Pants", R(["thigh_l", "thigh_r", "calf_l", "calf_r"]), 0.006, CLOTH, cloth("#3a3430", 2))
        h.add_shell("Boots", R(["foot_l", "foot_r", "ball_l", "ball_r", "calf_l", "calf_r"], thresh=0.4, extra=below(0.32)), 0.014, LEATHER,
                    cloth("#2a2220", 3), smooth=2)
        h.add_shell("Gloves", R(["hand_l", "hand_r"] + [f"{f}_0{k}_{s}" for f in ("index", "middle", "ring", "pinky", "thumb") for k in (1, 2, 3) for s in "lr"],
                    thresh=0.4), 0.004, LEATHER, cloth("#3a2a20", 5), smooth=1)
        h.add_shell("Armor_Bracers", R(["lowerarm_l", "lowerarm_r"], thresh=0.7), 0.02, STEEL, metal("#b8873a", seed=4), smooth=4,
                    rim_color=rgb("#6a4a20"), rim_mat=GOLD)
        add_panel_skirt(h, "Coat_Tails", h.heads["pelvis"][1] + 0.03, h.heads["pelvis"][1] - 0.45, 5, 0.06, LEATHER, cloth("#2e3a2c", 6), gap=0.35)
        belt(h, "#2a2220", "#b8873a")
        for sd in "lr":
            shoulder_plates(h, sd, "#5a5e66", "#b8873a", big=0.8, rivets=True)
        hd = h.heads["head"]
        gog = merge(*[cylinder(0.026, 0.026, 0.02, 12).rotate(90, 0, 0).translate(hd[0] + s * 0.034, hd[1] + 0.12, hd[2] + 0.1) for s in (-1, 1)])
        h.add_rigid("Goggles", gog.color(rgb("#b8873a")), "head", GOLD)
        lens = merge(*[cylinder(0.02, 0.02, 0.004, 12).rotate(90, 0, 0).translate(hd[0] + s * 0.034, hd[1] + 0.12, hd[2] + 0.112) for s in (-1, 1)])
        h.add_rigid("Goggles_Lens", lens.color(rgb("#ffb050")), "head", {"name": "lens", "roughness": 0.1, "emissive": [0.8, 0.45, 0.1]})
    elif style == "cultist":
        h.add_shell("Robe_Top", R(torso + ["upperarm_l", "upperarm_r", "lowerarm_l", "lowerarm_r"], extra=below(neck_y), thresh=0.4), 0.012,
                    CLOTH, cloth("#2b1838", 1), smooth=3)
        h.add_shell("Pants", R(["thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "ball_l", "ball_r"]), 0.006, CLOTH, cloth("#1a1020", 2))
        add_panel_skirt(h, "Robe", h.heads["pelvis"][1] + 0.05, 0.12, 8, 0.14, CLOTH, cloth("#2b1838", 3), gap=0.14, offset=0.03)
        h.add_shell("Hood", R(["head", "neck_01"], extra=lambda V: (V[:, 2] < h.heads["head"][2] + 0.05) | (V[:, 1] > h.heads["head"][1] + 0.13)), 0.035,
                    CLOTH, cloth("#2b1838", 4), smooth=6)
        belt(h, "#6a2a8a", "#b070ff", y_off=0.1)
        for sd in "lr":
            ua = h.heads["upperarm_" + sd]
            s = 1 if sd == "l" else -1
            cr = merge(*[crystal(0.14 + 0.04 * k, 0.025, 5, 0.4, k + (3 if s > 0 else 7)).rotate(-20 + k * 18, 0, -35 * s).translate(ua[0] + s * 0.04, ua[1] + 0.06, ua[2] - 0.03 + k * 0.03) for k in range(3)])
            h.add_rigid("Crystals_" + sd.upper(), cr.color(rgb("#b070ff")), "upperarm_" + sd, {"name": "void", "roughness": 0.2, "emissive": [0.55, 0.15, 0.9]})
        add_cape(h, "Cape", "#1a0f22", length=1.2)
    elif style == "crusher":
        A = "#2a2624"
        h.add_shell("Armor_Body", R(torso + ["upperarm_l", "upperarm_r", "thigh_l", "thigh_r"], extra=below(neck_y)), 0.03, STEEL,
                    metal(A, seed=1, var=0.4), smooth=5)
        h.add_shell("Armor_Limbs", R(["lowerarm_l", "lowerarm_r", "calf_l", "calf_r", "hand_l", "hand_r", "foot_l", "foot_r", "ball_l", "ball_r"], thresh=0.4),
                    0.025, STEEL, metal(A, seed=2, var=0.4), smooth=4)
        # žhnoucí praskliny: druhá skořepina těsně nad zbrojí jen tam, kde je „roztavená“
        cr = R(torso + ["upperarm_l", "upperarm_r", "thigh_l", "thigh_r", "lowerarm_l", "lowerarm_r", "calf_l", "calf_r"])
        n = fbm(h.body["P"], 18, 3, 5) > 0.62
        h.add_shell("Molten", cr & n, 0.034, {"name": "molten", "roughness": 0.5, "emissive": [1.0, 0.35, 0.05]},
                    lambda P, N: np.tile(rgb("#ff7a20"), (len(P), 1)), smooth=1)
        h.add_shell("Helm", R(["head"], extra=up_y(h.heads["head"][1] - 0.02)), 0.04, STEEL, metal(A, seed=3, var=0.4), smooth=5)
        hd = h.heads["head"]
        visor = cylinder(0.006, 0.006, 0.12, 6).rotate(0, 0, 90).translate(hd[0] + 0.06, hd[1] + 0.09, hd[2] + 0.13).color(rgb("#ffb040"))
        h.add_rigid("Visor", visor, "head", {"name": "eyes", "roughness": 0.3, "emissive": [1.0, 0.45, 0.1]})
        for sd in "lr":
            shoulder_plates(h, sd, A, "#3a3230", big=1.6)
            s = 1 if sd == "l" else -1
            ua = h.heads["upperarm_" + sd]
            sp = merge(*[lathe([(0.03, 0), (0.001, 0.2)], 6).rotate(0, 0, -30 * s - k * 14 * s).translate(ua[0] + s * (0.08 + 0.03 * k), ua[1] + 0.12, ua[2] + (k - 1) * 0.06) for k in range(3)])
            h.add_rigid("Spikes_" + sd.upper(), sp.color(rgb("#141210")), "upperarm_" + sd, STEEL)


# ================================================================== postavy Eryndoru
SK = "skins/"
CHARACTERS = {
    # jméno: (morfy, kůže, vlasy (+ barva), obočí, styl, elf)
    "syl_knight_m": (dict(gender="male", muscle=0.75, weight=0.55, height=0.35, race="caucasian"), "young_caucasian_male", ("short02", "#d8c090"), "eyebrow001", "syl_knight", True),
    "syl_mage_f": (dict(gender="female", muscle=0.45, weight=0.4, height=0.25, race="caucasian"), "young_caucasian_female", ("long01", "#e8d8a8"), "eyebrow010", "syl_mage", True),
    "aeth_heavy_m": (dict(gender="male", muscle=0.9, weight=0.7, height=0.4, race="caucasian"), "middleage_caucasian_male", ("short04", "#3a2a20"), "eyebrow002", "aeth_heavy", False),
    "aeth_engineer_f": (dict(gender="female", muscle=0.55, weight=0.5, height=0.15, race="african"), "young_african_female", ("ponytail01", "#2a1a14"), "eyebrow011", "aeth_engineer", False),
    "cultist_m": (dict(gender="male", muscle=0.5, weight=0.35, height=0.2, race="caucasian"), "old_caucasian_male", None, "eyebrow006", "cultist", False),
    "crusher": (dict(gender="male", muscle=1.0, weight=0.95, height=0.9, race="african"), "middleage_african_male", None, "eyebrow004", "crusher", False),
    "lyrise": (dict(gender="female", muscle=0.4, weight=0.35, height=0.6, race="asian"), "young_asian_female", ("braid01", "#c8d8ff"), "eyebrow010", "lyrise", True),
}


def macro_targets(c):
    g = c["gender"]
    M = "macrodetails/"
    mus, wgt = c["muscle"], c["weight"]
    # svaly a váha: lineárně mezi min / average / max (jako v MakeHumanu)
    def split(v):
        return [("min", 1 - v * 2), ("average", v * 2)] if v < 0.5 else [("average", 2 - v * 2), ("max", v * 2 - 1)]
    T = []
    for mn, mw in split(mus):
        for wn, ww in split(wgt):
            T.append((M + f"universal-{g}-young-{mn}muscle-{wn}weight.target", mw * ww))
    T.append((M + f"{c['race']}-{g}-young.target", 1.0))
    if c["height"] > 0:
        T.append((M + f"height/{g}-young-averagemuscle-averageweight-maxheight.target", c["height"]))
    T.append((M + f"proportions/{g}-young-averagemuscle-averageweight-idealproportions.target", 0.7))
    return T


def build(name, mh, assets, clips_cache):
    morph, skin, hair, brow, style, elf = CHARACTERS[name]
    T = macro_targets(morph)
    if elf:
        for s in "lr":
            T += [(f"ears/{s}-ear-shape-pointed.target", 1.0), (f"ears/{s}-ear-scale-vert-incr.target", 0.6)]
    h = Human(mh, assets, T)
    skin_dir = os.path.join(assets, SK, skin)
    skin_png = next(os.path.join(skin_dir, f) for f in os.listdir(skin_dir) if f.endswith(".png") and "thumb" not in f)
    h.add_body(skin_png)
    h.add_proxy("eyes", "high-poly", material=os.path.join(assets, "eyes/materials/" + ("bluegreen" if elf else "brown") + ".mhmat"),
                part="Eyes", alpha=True)
    h.add_proxy("eyebrows", brow, alpha=True, part="Eyebrows")
    h.add_proxy("eyelashes", "eyelashes01", alpha=True, part="Eyelashes")
    if hair:
        h.add_proxy("hair", hair[0], alpha=True, part="Hair", color=rgb(hair[1]))
    dress(h, style)
    key = morph["gender"]
    clips = kaykit_clips(h)
    h.write(os.path.join(OUT, name + ".glb"), clips)
    print(f"{name}.glb: {os.path.getsize(os.path.join(OUT, name + '.glb')) // 1024} KB, dílů {len(h.parts)}, {len(clips)} animací")


def find_data(args):
    cand_mh = [args.mh, os.path.join(SCRATCH, "mpfb2/src/mpfb/data") if SCRATCH else None]
    cand_as = [args.assets, os.path.join(SCRATCH, "mhsys/x") if SCRATCH else None]
    mh = next((c for c in cand_mh if c and os.path.isdir(c)), None)
    assets = next((c for c in cand_as if c and os.path.isdir(c)), None)
    if not mh or not assets:
        sys.exit("Chybí data MakeHumanu: --mh <mpfb2/src/mpfb/data> --assets <makehuman_system_assets_cc0>")
    return mh, assets


def kaykit_clips(h):
    kk = KayKitAnims(os.path.join(HERE, "..", "Assets", "Models", "kaykit", "chars", "Knight.glb"))
    kk_hips = kk.rest_world[kk.node("hips")][1, 3] if False else kk.rest_world[kk.node("hips")][:3, 3][1]
    ratio = h.heads["pelvis"][1] / max(kk_hips, 1e-6)
    clips = retarget(kk, h.order, h.parent, h.heads, h.tails, ratio, h.heads["pelvis"])
    # úchyty zbraní jako v KayKitu (handslot): zbraně z KayKitu pak sedí v ruce bez ladění
    h.slots = {}
    for side in "lr":
        A = retarget.align["hand_" + side]
        kh, ks = kk.rest_world[kk.node("hand." + side)], kk.rest_world[kk.node("handslot." + side)]
        rot = np.linalg.inv(A) @ ks[:3, :3]
        u, _, vt = np.linalg.svd(rot)
        rot = u @ vt
        arm_k = np.linalg.norm(kk.rest_world[kk.node("wrist." + side)][:3, 3] - kk.rest_world[kk.node("upperarm." + side)][:3, 3])
        arm_m = np.linalg.norm(h.heads["hand_" + side] - h.heads["upperarm_" + side])
        off = np.linalg.inv(A) @ (ks[:3, 3] - kh[:3, 3]) * (arm_m / arm_k)
        h.slots["handslot." + side] = ("hand_" + side, off, mat_quat(rot))
    return clips


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mh")
    ap.add_argument("--assets")
    ap.add_argument("--only")
    args = ap.parse_args()
    mh, assets = find_data(args)
    os.makedirs(OUT, exist_ok=True)
    for name in CHARACTERS:
        if args.only and name not in args.only.split(","):
            continue
        build(name, mh, assets, {})


if __name__ == "__main__":
    main()
