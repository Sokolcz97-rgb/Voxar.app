#!/usr/bin/env python3
"""Kostra a kosterní animace pro statické modely hrdinů (jako auto-rig v Unity / Unreal).

Vstup:  modely hrdinů z Unity verze (Assets/Models/heroes/*.glb, jeden mesh bez kostry).
Výstup: Assets/Models/heroes_rig/<model>.glb – stejný mesh a textura + humanoidní kostra (17 kostí),
        váhy skinningu (JOINTS_0 / WEIGHTS_0) a klipy Idle, Walk, Run, Attack, Block, Cast, Hit,
        Cheer, Death. LOD varianty (*_lo) dostanou stejnou kostru (engine pak LOD přepíná i u animací).

Kostra se staví z proporcí chibi postav (velká hlava): kyčle ~30 % výšky, ramena ~57 %, krk ~60 %.
Váhy: oblasti těla (hlava, ruce podle vzdálenosti od středu, nohy podle strany, trup) s plynulými
přechody u kloubů; rekvizity daleko od těla (kopí, luk, hůl) patří ruce, která je drží.

Spuštění:  python3 tools/rig_heroes.py        (potřebuje numpy)
"""
import json, math, os, struct, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "Assets", "Models", "heroes")
UNITY_SRC = os.path.join(HERE, "..", "..", "..", "unity", "AshesOfEryon", "Assets", "Models", "heroes")
OUT = os.path.join(HERE, "..", "Assets", "Models", "heroes_rig")

CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32, 5121: np.uint8}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


# ------------------------------------------------------------------ čtení GLB
def load_glb(path):
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl
    bl = struct.unpack("<I", b[off:off + 4])[0]
    return j, b[off + 8:off + 8 + bl]


def read_acc(j, bn, i):
    a = j["accessors"][i]
    bv = j["bufferViews"][a["bufferView"]]
    dt = CT[a["componentType"]]
    n = NC[a["type"]]
    isz = np.dtype(dt).itemsize
    stride = bv.get("byteStride", isz * n)
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    raw = np.frombuffer(bn, dtype=np.uint8, count=stride * (a["count"] - 1) + isz * n, offset=start)
    out = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], isz * n), strides=(stride, 1)).copy()
    out = out.view(dt).reshape(a["count"], n)
    if a.get("normalized") and dt != np.float32:
        out = out.astype(np.float32) / np.iinfo(dt).max
    return out


# ------------------------------------------------------------------ kostra
# (jméno, rodič, (x, podíl výšky y, z))  – x v jednotkách modelu od středu, +X = levá strana postavy
def skeleton(robe):
    hip, sh = 0.30, 0.57
    J = [
        ("Root", None, (0.0, 0.0, 0.0)),
        ("Hips", "Root", (0.0, hip, 0.0)),
        ("Spine", "Hips", (0.0, 0.40, 0.0)),
        ("Chest", "Spine", (0.0, 0.50, 0.0)),
        ("Neck", "Chest", (0.0, 0.60, 0.0)),
        ("Head", "Neck", (0.0, 0.645, 0.0)),
    ]
    for s, side in (("L", 1.0), ("R", -1.0)):
        J += [
            ("UpperArm." + s, "Chest", (0.21 * side, sh, 0.0)),
            ("LowerArm." + s, "UpperArm." + s, (0.26 * side, 0.45, 0.02)),
            ("Hand." + s, "LowerArm." + s, (0.29 * side, 0.345, 0.04)),
            ("UpperLeg." + s, "Hips", (0.09 * side, 0.27, 0.0)),
            ("LowerLeg." + s, "UpperLeg." + s, (0.09 * side, 0.14, 0.01)),
            ("Foot." + s, "LowerLeg." + s, (0.09 * side, 0.035, 0.0)),
        ]
    return J


def ramp(v, a, b):
    """0 pod a, 1 nad b, plynule mezi."""
    t = np.clip((v - a) / max(b - a, 1e-6), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def compute_weights(P, joints, y0, H, robe, tris=None, quiver=False, shield=False, drape=False):
    """Vrací (joint indexy Nx4, váhy Nx4)."""
    names = [j[0] for j in joints]
    idx = {n: i for i, n in enumerate(names)}
    N = len(P)
    W = np.zeros((N, len(names)), np.float32)
    x, z = P[:, 0], P[:, 2]
    f = (P[:, 1] - y0) / H           # výška jako podíl
    ax = np.abs(x)
    side_l = x >= 0.0

    def add(name, w):
        W[:, idx[name]] += w

    # rekvizity daleko od těla (kopí, luk, hůl, štít v natažené ruce) -> ruka na té straně
    prop = ax > 0.34
    if tris is not None:
        # rekvizita = jen to, co po síti modelu navazuje na ruku (kopí, luk, štít, hůl); věci daleko od
        # středu, které na ruku nenavazují (toulec na zádech, vlečka), zůstanou trupu
        cand = ax > 0.31
        if quiver:   # toulec přes pravé rameno (lukostřelec) – patří zádům, ne ruce
            cand &= ~(x < 0)   # pravá ruka nic nedrží (šípy a toulec zůstávají u těla)
        if shield:   # kulatý štít na levé paži leží i před tělem (dál vpředu než hruď)
            cand |= (x > 0.08) & (z > 0.33) & (f > 0.12) & (f < 0.6)
        reach = cand & (f > 0.22) & (f < 0.5) & (ax > 0.34)   # semínka: daleko od těla ve výšce rukou
        for _ in range(400):
            hit = reach[tris].any(axis=1)
            new = np.zeros(N, bool)
            new[tris[hit].reshape(-1)] = True
            new &= cand
            new |= reach
            if new.sum() == reach.sum():
                break
            reach = new
        prop = (prop | (shield & cand)) & reach
    # u země je daleko od těla i vlečka róby / pláště – rekvizitou je jen to, co pokračuje nahoru
    # (spodek kopí nebo hole); zbytek zůstane s tělem
    low = prop & (f < 0.12)
    if low.any():
        col = prop & (f >= 0.12) & (f < 0.3)
        A = P[low][:, [0, 2]]
        B = P[col][:, [0, 2]] if col.any() else np.zeros((1, 2), np.float32) + 1e3
        dmin = np.full(len(A), 1e9, np.float32)
        for k in range(0, len(B), 512):
            dmin = np.minimum(dmin, np.linalg.norm(A[:, None, :] - B[None, k:k + 512, :], axis=2).min(axis=1))
        keep = np.zeros(N, bool)
        keep[np.where(low)[0]] = dmin < 0.05
        prop = prop & ~(low & ~keep)
    # ruce: blízko úsečky rameno -> loket -> dlaň. Látka (tóga, plášť), která visí přes paži dál od ní,
    # zůstane trupu – jinak by se při zvednutí ruky natáhla jako křídlo.
    pos = {n: np.array(p, np.float32) for n, _, p in joints}
    near = np.zeros(N, np.float32)
    Q = np.stack([ax, f * H, z], axis=1)
    for s in ("L",):
        chain = [pos["UpperArm." + s], pos["LowerArm." + s], pos["Hand." + s]]
        chain = [np.array([c[0], c[1] * H, c[2]], np.float32) for c in chain]
        chain.append(chain[-1] + np.array([0.01, -0.06 * H, 0.0], np.float32))   # prsty
        d = np.full(N, 1e9, np.float32)
        for a, b in zip(chain[:-1], chain[1:]):
            ab = b - a
            t = np.clip(((Q - a) @ ab) / float(ab @ ab), 0, 1)
            d = np.minimum(d, np.linalg.norm(Q - (a + t[:, None] * ab), axis=1))
        near = 1 - ramp(d / H, *((0.045, 0.075) if drape else (0.06, 0.10)))
    region = (~prop) & (ax > 0.13) & (f > 0.28) & (f < 0.62) & (near > 0)
    arm = region & (near >= 0.999)
    blend = region & (near < 0.999)          # okraj paže / látka u paže: část ruka, část trup
    head = (~prop) & (~arm) & (f >= 0.60)
    legs = (~prop) & (~arm) & (~head) & (f < 0.32)
    torso = (~prop) & (~arm) & (~head) & (~legs)
    armw = np.where(arm, 1.0, np.where(blend, near, 0.0)).astype(np.float32)

    for s, m in (("L", side_l), ("R", ~side_l)):
        # rekvizity
        pm = prop & m
        add("Hand." + s, pm.astype(np.float32))
        # ruka: rameno -> loket -> dlaň podle výšky, u ramene přechod do hrudníku
        am = armw * m
        hand = ramp(-f, -0.40, -0.36)                 # pod ~0.38 dlaň
        lower = ramp(-f, -0.50, -0.44) * (1 - hand)    # pod ~0.47 předloktí
        upper = 1 - hand - lower
        chest_mix = ramp(f, 0.53, 0.59) * ramp(-ax, -0.21, -0.17)   # u ramene a blízko těla
        add("Hand." + s, am * hand)
        add("LowerArm." + s, am * lower)
        add("UpperArm." + s, am * upper * (1 - chest_mix))
        add("Chest", am * upper * chest_mix)
        # nohy: stehno -> holeň -> chodidlo, u kyčle přechod do pánve
        lm = (legs & m).astype(np.float32) * (1 - armw)
        foot = ramp(-f, -0.06, -0.03)
        shin = ramp(-f, -0.17, -0.12) * (1 - foot)
        thigh = 1 - foot - shin
        hip_mix = ramp(f, 0.24, 0.31)
        if robe:   # róba / sukně: lem jde jen napůl s nohou, látka kolem středu drží pánev
            center = 1 - ramp(ax, 0.02, 0.12)
            hip_mix = np.maximum(hip_mix, center * ramp(f, 0.08, 0.2) * 0.6)
        # látka daleko od nohy (vlečka, široký lem) drží pánev, ne chodidlo
        far = ramp(ax, 0.22, 0.32)
        hip_mix = np.maximum(hip_mix, far)
        add("Hips", lm * foot * far)
        foot = foot * (1 - far)
        add("Foot." + s, lm * foot)
        add("LowerLeg." + s, lm * shin * (1 - hip_mix))
        add("UpperLeg." + s, lm * (thigh * (1 - hip_mix) + shin * hip_mix * 0.5))
        add("Hips", lm * (thigh * hip_mix + shin * hip_mix * 0.5))

    # trup: pánev -> páteř -> hrudník
    tm = torso.astype(np.float32) * (1 - armw)
    chest = ramp(f, 0.44, 0.50)
    spine = ramp(f, 0.34, 0.40) * (1 - chest)
    add("Chest", tm * chest)
    add("Spine", tm * spine)
    add("Hips", tm * (1 - chest - spine))
    # hlava: brada přechází do krku
    hm = head.astype(np.float32) * (1 - armw)
    hw = ramp(f, 0.60, 0.65)
    add("Head", hm * hw)
    add("Neck", hm * (1 - hw))

    # 4 nejsilnější kosti na vrchol, normalizace
    order = np.argsort(-W, axis=1)[:, :4]
    ws = np.take_along_axis(W, order, axis=1)
    s = ws.sum(axis=1, keepdims=True)
    s[s <= 0] = 1
    ws = ws / s
    empty = W.sum(axis=1) <= 0
    order[empty] = idx["Hips"]
    ws[empty] = [1, 0, 0, 0]
    return order.astype(np.uint16), ws.astype(np.float32)


# ------------------------------------------------------------------ animace
def quat_euler(xd, yd, zd):
    """Rotace (stupně) – nejdřív X, pak Y, pak Z; vrací [x, y, z, w]."""
    hx, hy, hz = math.radians(xd) / 2, math.radians(yd) / 2, math.radians(zd) / 2
    qx = np.array([math.sin(hx), 0, 0, math.cos(hx)])
    qy = np.array([0, math.sin(hy), 0, math.cos(hy)])
    qz = np.array([0, 0, math.sin(hz), math.cos(hz)])

    def mul(a, b):
        ax, ay, az, aw = a
        bx, by, bz, bw = b
        return np.array([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx,
                         aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz])
    return mul(qz, mul(qy, qx))


def sm(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def env(t, a, b, c, d):
    """0 -> náběh a..b -> 1 -> doběh c..d -> 0"""
    return sm((t - a) / max(b - a, 1e-6)) * (1 - sm((t - c) / max(d - c, 1e-6)))


# Znaménka (model hledí k +Z): ruka / noha dopředu = záporná rotace kolem X; trup dopředu = kladná;
# levá ruka od těla = kladná kolem Z, pravá záporná.
def clip_pose(name, t, dur, weapon, H):
    """Vrací {kost: (rx, ry, rz)} a posun pánve (dy, dz) v čase t."""
    R, T = {}, [0.0, 0.0]
    W = "L" if weapon == "left" else "R"          # zbraňová ruka
    O = "R" if W == "L" else "L"                  # druhá ruka (štít / tětiva)
    ws = 1.0 if W == "L" else -1.0                # znaménko „od těla“ pro zbraňovou ruku
    p = 2 * math.pi * t / dur
    arms_rest = 6.0   # ruce lehce od těla (chibi paže)

    def arm(s, x=0.0, y=0.0, z=0.0, ex=0.0):
        side = 1.0 if s == "L" else -1.0
        R["UpperArm." + s] = (x, y, z + arms_rest * side)
        R["LowerArm." + s] = (ex, 0, 0)

    if name == "Idle":
        b = math.sin(p)
        R["Chest"] = (1.5 * b, 0, 0)
        R["Spine"] = (0.5 * b, 0, 0)
        R["Head"] = (2.0 * math.sin(p + 1.0), 7.0 * math.sin(p * 0.5), 0)
        arm("L", 2 * b, 0, 2 * b, -6)
        arm("R", 2 * b, 0, -2 * b, -6)
        T[0] = 0.004 * H * b
    elif name in ("Walk", "Run"):
        k = 1.0 if name == "Walk" else 1.7
        s = math.sin(p)
        R["UpperLeg.L"] = (-26 * k * s, 0, 0)
        R["UpperLeg.R"] = (26 * k * s, 0, 0)
        R["LowerLeg.L"] = (32 * k * max(0.0, math.sin(p + 1.2)), 0, 0)
        R["LowerLeg.R"] = (32 * k * max(0.0, math.sin(p + 1.2 + math.pi)), 0, 0)
        R["Foot.L"] = (-8 * k * s, 0, 0)
        R["Foot.R"] = (8 * k * s, 0, 0)
        arm("L", 22 * k * s, 0, 2, -12 * k)
        arm("R", -22 * k * s, 0, -2, -12 * k)
        R["Hips"] = (0, 6 * s, 0)
        R["Spine"] = ((4 if name == "Walk" else 12), -5 * s, 0)
        R["Head"] = (-2 if name == "Walk" else -8, 3 * s, 0)
        T[0] = 0.018 * H * k * abs(math.cos(p)) - 0.01 * H * k
    elif name == "Attack":
        if weapon == "left":      # lučištník: luk vpřed, tětiva k bradě, výstřel
            draw = env(t / dur, 0.0, 0.3, 0.75, 1.0)
            pull = env(t / dur, 0.25, 0.55, 0.6, 0.68)
            arm(W, -85 * draw, 0, 12 * ws * draw, 0)
            arm(O, -80 * draw, -20 * draw * ws, 0, -70 * pull)
            R["Spine"] = (0, 25 * ws * draw, 0)
            R["Head"] = (0, -20 * ws * draw, 0)
        else:                     # nápřah a úder (kopí, hůl, meč)
            u = t / dur
            wind = env(u, 0.0, 0.3, 0.3, 0.45)
            strike = env(u, 0.3, 0.45, 0.65, 1.0)
            arm(W, 45 * wind - 100 * strike, 0, (25 * wind + 5 * strike) * ws, -35 * wind - 10 * strike)
            arm(O, -25 * strike, 0, 8 * (1 if O == "L" else -1), -30 * strike)   # štít vpřed
            R["Spine"] = (10 * strike, (25 * wind - 30 * strike) * ws, 0)
            R["Hips"] = (0, -10 * strike * ws, 0)
            R["UpperLeg." + W] = (-20 * strike, 0, 0)
            R["LowerLeg." + W] = (25 * strike, 0, 0)
            T[1] = 0.05 * H * strike
    elif name == "Block":
        h = 1.0   # držená póza (vrstva se zapne / vypne prolnutím ve hře)
        # štít / volná ruka mírně vpřed a nahoru – chibi paže jsou s tělem z jednoho kusu, větší
        # natočení by štít postavilo bokem a natáhlo látku
        arm(O, -40 * h, 0, 4 * (1 if O == "L" else -1) * h, -35 * h)
        arm(W, -15 * h, 0, 6 * ws * h, -20 * h)
        R["Spine"] = (10 * h, 0, 0)
        R["UpperLeg.L"] = (-18 * h, 0, 0)
        R["UpperLeg.R"] = (-18 * h, 0, 0)
        R["LowerLeg.L"] = (30 * h, 0, 0)
        R["LowerLeg.R"] = (30 * h, 0, 0)
        T[0] = -0.03 * H * h
    elif name == "Cast":
        u = t / dur
        up = env(u, 0.0, 0.35, 0.7, 1.0)
        push = env(u, 0.45, 0.6, 0.7, 1.0)
        arm("L", -95 * up + 25 * push, 0, 12 * up, -20 * up)
        arm("R", -95 * up + 25 * push, 0, -12 * up, -20 * up)
        R["Spine"] = (-10 * up + 14 * push, 0, 0)
        R["Head"] = (-12 * up + 8 * push, 0, 0)
        T[0] = 0.02 * H * up
    elif name == "Hit":
        u = env(t / dur, 0.0, 0.2, 0.35, 1.0)
        R["Spine"] = (-18 * u, 8 * u, 0)
        R["Head"] = (-14 * u, -10 * u, 0)
        arm("L", 10 * u, 0, 25 * u, -20 * u)
        arm("R", 10 * u, 0, -25 * u, -20 * u)
        T[1] = -0.04 * H * u
    elif name == "Cheer":
        u = t / dur
        h = env(u, 0.0, 0.2, 0.8, 1.0)
        jump = math.sin(math.pi * min(1.0, max(0.0, (u - 0.15) / 0.5)))
        arm(W, -125 * h, 0, 10 * ws * h, -10 * h)
        arm(O, -30 * h, 0, 20 * (1 if O == "L" else -1) * h, -30 * h)
        R["Spine"] = (-8 * h, 0, 0)
        R["Head"] = (-15 * h, 0, 0)
        T[0] = 0.12 * H * jump
    elif name == "Death":
        u = sm(t / dur)
        knees = env(t / dur, 0.0, 0.3, 1.1, 1.2)
        R["Root"] = (-85 * u, 0, 0)          # pád na záda
        R["Spine"] = (-10 * u, 0, 0)
        R["Head"] = (-20 * u, 25 * u, 0)
        R["UpperLeg.L"] = (-25 * knees, 0, 0)
        R["UpperLeg.R"] = (-25 * knees, 0, 0)
        R["LowerLeg.L"] = (40 * knees, 0, 0)
        R["LowerLeg.R"] = (40 * knees, 0, 0)
        arm("L", -30 * u, 0, 50 * u, -20 * u)
        arm("R", -30 * u, 0, -50 * u, -20 * u)
        T[0] = 0.08 * H * u
    for s in ("L", "R"):   # chibi paže nikdy úplně u těla
        R.setdefault("UpperArm." + s, (0, 0, arms_rest * (1 if s == "L" else -1)))
    return R, T


CLIPS = [("Idle", 3.0, True), ("Walk", 1.0, True), ("Run", 0.66, True), ("Attack", 0.9, False),
         ("Block", 0.7, True), ("Cast", 1.1, False), ("Hit", 0.45, False), ("Cheer", 1.4, False),
         ("Death", 1.3, False)]


# ------------------------------------------------------------------ zápis GLB
class Bin:
    def __init__(self):
        self.data = bytearray()
        self.views = []
        self.accs = []

    def view(self, raw, target=None, stride=None):
        while len(self.data) % 4:
            self.data += b"\0"
        v = {"buffer": 0, "byteOffset": len(self.data), "byteLength": len(raw)}
        if target:
            v["target"] = target
        if stride:
            v["byteStride"] = stride
        self.data += raw
        self.views.append(v)
        return len(self.views) - 1

    def acc(self, arr, ctype, typ, target=None, minmax=False, normalized=False):
        arr = np.ascontiguousarray(arr)
        vi = self.view(arr.tobytes(), target)
        a = {"bufferView": vi, "componentType": ctype, "count": int(arr.shape[0]), "type": typ}
        if normalized:
            a["normalized"] = True
        if minmax:
            flat = arr.reshape(arr.shape[0], -1)
            a["min"] = [float(v) for v in flat.min(0)]
            a["max"] = [float(v) for v in flat.max(0)]
        self.accs.append(a)
        return len(self.accs) - 1


def rig(src, dst, weapon, robe):
    j, bn = load_glb(src)
    prim = j["meshes"][0]["primitives"][0]
    attrs = prim["attributes"]
    P = read_acc(j, bn, attrs["POSITION"]).astype(np.float32)
    y0, y1 = float(P[:, 1].min()), float(P[:, 1].max())
    H = y1 - y0
    joints = skeleton(robe)
    names = [n for n, _, _ in joints]
    world = {}
    for n, parent, (x, fy, zz) in joints:
        world[n] = np.array([x, y0 + fy * H, zz], np.float32)
    idx_acc = prim.get("indices")
    tris = None
    if idx_acc is not None:   # svařené vrcholy (stejná poloha = stejný bod), ať záplava projde švy UV
        _, weld = np.unique(np.round(P, 4), axis=0, return_inverse=True)
        weld = weld.reshape(-1)
        I = read_acc(j, bn, idx_acc).reshape(-1, 3).astype(np.int64)
        first = np.full(weld.max() + 1, -1, np.int64)
        first[weld[::-1]] = np.arange(len(P))[::-1]
        tris = np.concatenate([I, first[weld[I]]], axis=0)   # trojúhelníky + spojení se svařeným bodem
        tris = np.concatenate([tris, np.stack([np.arange(len(P)), first[weld], first[weld]], 1)], axis=0)
    ji, jw = compute_weights(P, joints, y0, H, robe, tris, quiver=weapon == "left",
                             shield=os.path.basename(src).startswith("hoplit_m"),
                             drape=os.path.basename(src).startswith("vestec"))   # tóga přes paži

    out = Bin()
    # původní atributy (rozbalené, bez prokládání)
    new_attrs = {}
    for key, ai in attrs.items():
        arr = read_acc(j, bn, ai)
        typ = j["accessors"][ai]["type"]
        ctype = j["accessors"][ai]["componentType"]
        if ctype != 5126:   # barvy vrcholů apod. převést na float
            arr = arr.astype(np.float32)
            if j["accessors"][ai].get("normalized"):
                pass
        new_attrs[key] = out.acc(arr.astype(np.float32), 5126, typ, 34962, minmax=(key == "POSITION"))
    new_attrs["JOINTS_0"] = out.acc(ji, 5123, "VEC4", 34962)
    new_attrs["WEIGHTS_0"] = out.acc(jw, 5126, "VEC4", 34962)
    ind = read_acc(j, bn, prim["indices"]).reshape(-1).astype(np.uint32)
    indices = out.acc(ind, 5125, "SCALAR", 34963)
    # obrázky (textura) beze změny
    images = []
    for im in j.get("images", []):
        bv = j["bufferViews"][im["bufferView"]]
        raw = bn[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        images.append({"mimeType": im.get("mimeType", "image/png"), "bufferView": out.view(raw)})
    # inverzní bind matice (kosti bez rotace v klidu -> jen posun)
    ibm = np.zeros((len(names), 16), np.float32)
    for i, n in enumerate(names):
        m = np.eye(4, dtype=np.float32)
        m[:3, 3] = -world[n]
        ibm[i] = m.T.reshape(-1)     # glTF: sloupcové pořadí
    ibm_acc = out.acc(ibm, 5126, "MAT4")
    # uzly: 0 = mesh se skinem, 1.. = kosti
    nodes = [{"name": "Body", "mesh": 0, "skin": 0}]
    for n, parent, _ in joints:
        local = world[n] - (world[parent] if parent else np.zeros(3, np.float32))
        nodes.append({"name": n, "translation": [float(v) for v in local]})
    for i, (n, parent, _) in enumerate(joints):
        if parent:
            pi = names.index(parent) + 1
            nodes[pi].setdefault("children", []).append(i + 1)
    # animace
    animations = []
    fps = 30
    for cname, dur, loop in CLIPS:
        nf = max(2, int(round(dur * fps)) + 1)
        times = np.linspace(0, dur, nf).astype(np.float32)
        tacc = out.acc(times.reshape(-1, 1), 5126, "SCALAR", minmax=True)
        rots = {n: np.zeros((nf, 4), np.float32) for n in names}
        hips_t = np.zeros((nf, 3), np.float32)
        for k, t in enumerate(times):
            tt = float(t) if not loop or k < nf - 1 else 0.0   # smyčka: poslední snímek = první
            R, T = clip_pose(cname, tt, dur, weapon, H)
            for n in names:
                rx, ry, rz = R.get(n, (0, 0, 0))
                rots[n][k] = quat_euler(rx, ry, rz)
            base = world["Hips"] - world["Root"]
            hips_t[k] = [base[0], base[1] + T[0], base[2] + T[1]]
        samplers, channels = [], []
        for i, n in enumerate(names):
            if not np.allclose(rots[n], [0, 0, 0, 1]):
                samplers.append({"input": tacc, "output": out.acc(rots[n], 5126, "VEC4"), "interpolation": "LINEAR"})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": i + 1, "path": "rotation"}})
        samplers.append({"input": tacc, "output": out.acc(hips_t, 5126, "VEC3"), "interpolation": "LINEAR"})
        channels.append({"sampler": len(samplers) - 1, "target": {"node": names.index("Hips") + 1, "path": "translation"}})
        animations.append({"name": cname, "samplers": samplers, "channels": channels})

    gltf = {
        "asset": {"version": "2.0", "generator": "Ashes of Eryon rig_heroes.py"},
        "scene": 0, "scenes": [{"nodes": [0, 1]}], "nodes": nodes,
        "meshes": [{"name": "Body", "primitives": [{"attributes": new_attrs, "indices": indices, "mode": 4,
                                                     "material": prim.get("material", 0)}]}],
        "skins": [{"inverseBindMatrices": ibm_acc, "joints": list(range(1, len(names) + 1)), "skeleton": 1}],
        "animations": animations,
        "materials": j.get("materials", [{}]),
        "accessors": out.accs, "bufferViews": out.views,
        "buffers": [{"byteLength": len(out.data)}],
    }
    if images:
        gltf["images"] = images
        gltf["textures"] = j.get("textures", [])
        gltf["samplers"] = j.get("samplers", [{}])
    js = json.dumps(gltf, separators=(",", ":")).encode()
    while len(js) % 4:
        js += b" "
    while len(out.data) % 4:
        out.data += b"\0"
    total = 12 + 8 + len(js) + 8 + len(out.data)
    with open(dst, "wb") as fo:
        fo.write(struct.pack("<III", 0x46546C67, 2, total))
        fo.write(struct.pack("<I4s", len(js), b"JSON"))
        fo.write(js)
        fo.write(struct.pack("<I4s", len(out.data), b"BIN\0"))
        fo.write(out.data)
    print(f"{os.path.basename(dst)}: {len(P)} vrcholů, {len(names)} kostí, {len(CLIPS)} klipů, {os.path.getsize(dst) // 1024} KB")


def main():
    src_dir = SRC if os.path.isdir(SRC) else UNITY_SRC
    os.makedirs(OUT, exist_ok=True)
    for cls in ("hoplit", "lucistnik", "vestec"):
        for g in ("m", "f"):
            for suffix in ("", "_lo"):
                name = f"{cls}_{g}{suffix}.glb"
                src = os.path.join(src_dir, name)
                if not os.path.exists(src):
                    print("chybí", src)
                    continue
                weapon = "left" if cls == "lucistnik" else "right"
                robe = cls == "vestec" or g == "f"
                rig(src, os.path.join(OUT, name), weapon, robe)


if __name__ == "__main__":
    main()
