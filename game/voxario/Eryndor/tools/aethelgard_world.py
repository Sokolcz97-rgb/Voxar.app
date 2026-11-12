#!/usr/bin/env python3
"""Svět Aethelgard (Eryndor, kanál Fantasy) – generátor podle „Herní dokumentace: Svět Aethelgard“.

  python3 tools/aethelgard_world.py

Kontinent 8 x 8 km (64 km², rozlohou jako zóny World of Warcraft) obklopený Azure Ocean:
  * Verdant Canopy (západ)   – prastaré lesy, meandrující přítoky Serpentine River, elfí ruiny
  * Frostfang Peaks (sever)  – ostré zasněžené štíty, zamrzlé tyrkysové jezero v údolí
  * Ignis Scar (jih)         – čedičová pustina, sopky s krátery, řeky žhnoucí lávy
  * Crystalarium (východ)    – plošiny s obřími krystaly, ametystová půda
  * Serpentine River         – široká klidná řeka na úrovni moře mezi biomy (voda = hladina oceánu,
                               takže nikde „nevisí ve vzduchu“)

Výstup (Assets):
  Terrain/aethelgard_height.png   16bit výšková mapa 2049 x 2049 (4 m / px), base -80 m, rozsah 760 m
  Terrain/aethelgard_splat0.png   RGBA váhy povrchů 1–4 (tráva, lesní půda, písek, skála)
  Terrain/aethelgard_splat1.png   RGBA váhy povrchů 5–8 (sníh a led, láva, čedič, ametyst)
  UI/aethelgard_map.jpg           velká mapa (klávesa M) – malovaná mapa s reliéfem
  Scripts/eryndor/world_data.lua  regiony (mřížka 256 x 256), body zájmu, řeky, sopky
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import valoria_terrain

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "Assets")

N = 2049                 # body výškové mapy
SIZE = 8192.0            # m
BASE, RANGE = -80.0, 760.0
SEED = 1337
rng = np.random.default_rng(SEED)

u = np.linspace(0.0, 1.0, N, dtype=np.float32)
U, V = np.meshgrid(u, u)          # U = východ (+x), V = jih (+z); sever je nahoře mapy


# ------------------------------------------------------------------ šum
def value_noise(freq, seed):
    """Hladký hodnotový šum na mřížce N x N, `freq` buněk přes celý svět."""
    g = np.random.default_rng(seed).random((freq + 2, freq + 2)).astype(np.float32)
    x = U * freq
    y = V * freq
    ix, iy = np.floor(x).astype(np.int32), np.floor(y).astype(np.int32)
    fx, fy = x - ix, y - iy
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b = g[iy, ix], g[iy, ix + 1]
    c, d = g[iy + 1, ix], g[iy + 1, ix + 1]
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy


def fbm(freq, octaves, seed, gain=0.5):
    s, amp, tot = np.zeros_like(U), 1.0, 0.0
    for o in range(octaves):
        s += value_noise(freq * 2 ** o, seed + o * 101) * amp
        tot += amp
        amp *= gain
    return s / tot


def fbmn(freq, octaves, seed):
    """fBm roztažené na 0..1 (průměrování oktáv jinak drží hodnoty kolem 0.5 = ploché kopce)."""
    n = fbm(freq, octaves, seed)
    lo, hi = np.percentile(n, 2), np.percentile(n, 98)
    return np.clip((n - lo) / (hi - lo), 0, 1)


def ridged(freq, octaves, seed):
    s, amp, tot = np.zeros_like(U), 1.0, 0.0
    for o in range(octaves):
        n = 1.0 - np.abs(value_noise(freq * 2 ** o, seed + o * 57) * 2 - 1)
        s += n * n * amp
        tot += amp
        amp *= 0.5
    return s / tot


def smooth(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def blur(img, r):
    """Krabicové rozmazání (3 průchody ~ Gauss), r v pixelech."""
    out = img.astype(np.float32)
    for _ in range(3):
        for axis in (0, 1):
            c = np.cumsum(np.pad(out, [(r + 1, r) if a == axis else (0, 0) for a in range(out.ndim)], mode="edge"), axis=axis)
            hi = np.take(c, np.arange(2 * r + 1, c.shape[axis]), axis=axis)
            lo = np.take(c, np.arange(0, c.shape[axis] - 2 * r - 1), axis=axis)
            out = (hi - lo) / (2 * r + 1)
    return out


# deformace souřadnic (organické pobřeží a hranice regionů)
WU = U + (fbm(5, 4, 11) - 0.5) * 0.09
WV = V + (fbm(5, 4, 23) - 0.5) * 0.09


def blob(cx, cy, rx, ry):
    """0 vně .. 1 uprostřed elipsy (na deformovaných souřadnicích)."""
    d = np.sqrt(((WU - cx) / rx) ** 2 + ((WV - cy) / ry) ** 2)
    return np.clip(1.0 - d, 0, 1)


# ------------------------------------------------------------------ regiony a pevnina
REGIONS = {
    "verdant": (0.27, 0.54, 0.19, 0.26),
    "frost":   (0.54, 0.22, 0.24, 0.16),
    "ignis":   (0.56, 0.75, 0.19, 0.18),
    "crystal": (0.82, 0.47, 0.13, 0.17),
}
infl = {k: blob(*v) for k, v in REGIONS.items()}
# spojovací pevnina mezi regiony (údolí řeky, louky)
bridge = np.maximum(blob(0.46, 0.50, 0.17, 0.21), blob(0.68, 0.47, 0.10, 0.09))
land_raw = np.maximum.reduce([infl[k] for k in infl] + [bridge * 0.9])
# členité pobřeží jen u pevniny (šum v otevřeném moři by dělal písečné ostrůvky)
land = land_raw + (fbm(14, 4, 77) - 0.5) * 0.12 * smooth(0.0, 0.08, land_raw)
islands = np.maximum(blob(0.91, 0.14, 0.05, 0.035), blob(0.07, 0.20, 0.035, 0.05))
land = np.maximum(land, islands + (fbm(20, 3, 79) - 0.5) * 0.05 * (islands > 0))
is_land = land > 0.03
# vnitrozemí: 0 na pobřeží .. 1 daleko od moře (rozmazaná maska pevniny = pozvolné pobřeží)
inland = smooth(0.5, 0.85, blur(is_land.astype(np.float32), 16))

# váhy regionů (softmax z vlivu) + „louky“ (kde žádný region nepřevládá) – plynulé přechody biomů
MEADOW = 0.10
stack = np.stack([infl[k] for k in REGIONS] + [np.full_like(U, MEADOW)]) * 9.0
stack = np.exp(stack - stack.max(0))
weights = stack / stack.sum(0)
WR = {k: weights[i] for i, k in enumerate(REGIONS)}
WR["meadow"] = weights[len(REGIONS)]

# ------------------------------------------------------------------ výšky po regionech (nad pobřežní nížinou)
# členitá krajina (inspirace WoW / 4Story): zvlněné kopce, hřebeny, údolí a sedla místo rovin
hills = fbmn(5, 5, 91)                    # velké kopce (~1.6 km)
mid = fbmn(14, 4, 95)                     # pahorky (~600 m)
small = fbmn(36, 3, 96)                   # hrboly (~230 m)
ridge_l = ridged(8, 4, 97)                # hřbety a údolí mezi nimi
h_meadow = 12 + 130 * hills ** 1.5 + 55 * mid ** 1.3 + 40 * ridge_l ** 1.5 + 9 * small
h_verdant = 16 + 150 * fbmn(5, 5, 101) ** 1.4 + 60 * fbmn(13, 4, 102) ** 1.3 + 45 * ridged(9, 4, 104) ** 1.4 + 10 * small
h_frost = 90 + 760 * ridged(5, 6, 201) ** 2.0 * smooth(0.04, 0.45, infl["frost"]) + 60 * ridged(16, 3, 202) + 30 * fbm(20, 3, 203)
rough = fbmn(9, 5, 301)
h_ignis = 20 + 160 * rough ** 1.4 + 90 * ridged(12, 4, 303) ** 1.6 + 14 * small
terr = fbmn(6, 5, 401)
step_ = np.floor(terr * 6) / 6
# Crystalarium: vysoké terasy se srázy (zhmotnělá krystalická magie)
h_crystal = 30 + 210 * (step_ + smooth(0.0, 1.0, (terr * 6 - np.floor(terr * 6)) * 4) / 6 * 0.9) * 0.85 + 10 * fbm(30, 3, 403)
inner = (h_meadow * WR["meadow"] + h_verdant * WR["verdant"] + h_frost * WR["frost"] + h_ignis * WR["ignis"] +
         h_crystal * WR["crystal"])
# pobřežní nížina: pláž 0–3 m, pak plynule do vnitrozemí
height = 1.0 + 3.0 * smooth(0.0, 0.25, inland) + (inner - 4.0).clip(0) * inland ** 1.1
# sopky (Ignis Scar): kužely s krátery, láva v kráterech
VOLCANOES = [(0.535, 0.74, 330.0, 0.055), (0.645, 0.81, 250.0, 0.045), (0.47, 0.82, 190.0, 0.04)]
crater_mask = np.zeros_like(U)
for cx, cy, hv, r in VOLCANOES:
    d = np.sqrt((U - cx) ** 2 + (V - cy) ** 2) / r
    cone = hv * np.clip(1 - d, 0, 1) ** 1.25
    rim = d < 0.2
    crater_floor = hv * 0.72
    cone = np.where(rim, np.minimum(cone, crater_floor + (d / 0.2) ** 2 * (hv * (0.8 ** 1.25) - crater_floor)), cone)
    height = np.maximum(height, cone + height * (1 - np.clip(1 - d, 0, 1)) * 0.0)
    crater_mask = np.maximum(crater_mask, 1 - smooth(0.12, 0.19, d))

# zamrzlé jezero (Frostfang): plochá ledová pláň v údolí obklopená štíty
LAKE = (0.55, 0.205, 0.042, 0.03)
ld = np.sqrt(((U - LAKE[0]) / LAKE[2]) ** 2 + ((V - LAKE[1]) / LAKE[3]) ** 2)
lake_y = 150.0
lake_mask = 1 - smooth(0.85, 1.0, ld)
valley = 1 - smooth(1.0, 2.6, ld)
height = height * (1 - valley) + np.minimum(height, lake_y + (ld - 1).clip(0) * 140) * valley
height = np.where(ld < 1.0, lake_y, height)

# moře: hloubka podle vzdálenosti od pobřeží (šelf, pak hlubina)
sea_far = 1.0 - blur(is_land.astype(np.float32), 40)
ocean_depth = -3.0 - 70.0 * smooth(0.5, 1.0, sea_far) ** 1.5 - 6 * fbm(12, 3, 88)
height = np.where(is_land, height, ocean_depth)
height = blur(height, 1)

# ------------------------------------------------------------------ řeky (na úrovni moře – voda = oceán)
def spline(points, samples=40):
    """Catmull-Rom přes body + meandry (sinus kolmo ke směru)."""
    pts = np.array(points, np.float64)
    pts = np.vstack([pts[0] * 2 - pts[1], pts, pts[-1] * 2 - pts[-2]])
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1], pts[i], pts[i + 1], pts[i + 2]
        for t in np.linspace(0, 1, samples, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-2])
    return np.array(out)


def meander(line, amp, waves, seed):
    d = np.gradient(line, axis=0)
    n = np.stack([-d[:, 1], d[:, 0]], 1)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
    t = np.linspace(0, 1, len(line))
    off = amp * (np.sin(t * waves * 2 * math.pi + seed) + 0.4 * np.sin(t * waves * 5.3 + seed * 2))
    off *= np.clip(t * 6, 0, 1) * np.clip((1 - t) * 6, 0, 1) + 0.25
    return line + n * off[:, None]


def distance_to(line):
    """Vzdálenost (m) každého bodu mřížky k lomené čáře (po blocích kvůli paměti)."""
    P = line * SIZE
    out = np.full(U.shape, 1e9, np.float32)
    X, Z = U * SIZE, V * SIZE
    for i in range(len(P) - 1):
        a, b = P[i], P[i + 1]
        x0, x1 = min(a[0], b[0]) - 700, max(a[0], b[0]) + 700
        z0, z1 = min(a[1], b[1]) - 700, max(a[1], b[1]) + 700
        c0, c1 = max(0, int(x0 / SIZE * (N - 1))), min(N, int(x1 / SIZE * (N - 1)) + 2)
        r0, r1 = max(0, int(z0 / SIZE * (N - 1))), min(N, int(z1 / SIZE * (N - 1)) + 2)
        if c0 >= c1 or r0 >= r1:
            continue
        px, pz = X[r0:r1, c0:c1], Z[r0:r1, c0:c1]
        ab = b - a
        L2 = max(ab @ ab, 1e-9)
        t = np.clip(((px - a[0]) * ab[0] + (pz - a[1]) * ab[1]) / L2, 0, 1)
        d = np.sqrt((px - a[0] - ab[0] * t) ** 2 + (pz - a[1] - ab[1] * t) ** 2)
        out[r0:r1, c0:c1] = np.minimum(out[r0:r1, c0:c1], d)
    return out


SERPENTINE = meander(spline([(0.53, 0.33), (0.49, 0.40), (0.45, 0.47), (0.43, 0.55), (0.37, 0.63), (0.30, 0.71),
                             (0.22, 0.79), (0.13, 0.86), (0.04, 0.92)]), 0.010, 7, 1.3)
TRIBS = [meander(spline([(0.15, 0.36), (0.22, 0.44), (0.30, 0.50), (0.38, 0.56), (0.43, 0.55)]), 0.008, 4, 2.1),
         meander(spline([(0.20, 0.62), (0.26, 0.66), (0.33, 0.67), (0.37, 0.64)]), 0.006, 3, 0.7)]
river_d = distance_to(SERPENTINE)
width = 55 + 25 * fbm(9, 2, 501)                                   # polovina šířky (m)
for tline in TRIBS:
    td = distance_to(tline)
    river_d = np.minimum(river_d, td + 30)                           # přítoky užší
river_bed = -4.0 - 3.0 * (1 - smooth(0, 1, river_d / np.maximum(width, 1)))
bank = smooth(width * 0.6, width + 320, river_d)                     # mírné břehy (údolí řeky)
bank = bank ** 0.8
height = np.where(is_land, np.minimum(height, river_bed * (1 - bank) + height * bank), height)
river_mask = 1 - smooth(width, width + 25, river_d)

# lávové řeky z kráterů dolů po svahu (mělké koryto, nad mořem)
LAVA = [spline([(0.535, 0.74), (0.55, 0.78), (0.57, 0.84), (0.60, 0.90)]),
        spline([(0.535, 0.74), (0.50, 0.77), (0.46, 0.76), (0.42, 0.79)]),
        spline([(0.645, 0.81), (0.67, 0.76), (0.70, 0.72), (0.73, 0.70)]),
        spline([(0.645, 0.81), (0.63, 0.86), (0.66, 0.90)])]
lava_d = np.full(U.shape, 1e9, np.float32)
for line in LAVA:
    lava_d = np.minimum(lava_d, distance_to(meander(line, 0.006, 3, 0.4)))
lava_w = 10 + 8 * fbm(16, 2, 601)
lava_mask = np.maximum(1 - smooth(lava_w, lava_w + 6, lava_d), crater_mask) * smooth(4, 8, height)
height = height - 2.5 * (1 - smooth(lava_w * 0.6, lava_w + 4, lava_d)) * smooth(4, 8, height)

# Valoria is isolated from the existing continent and only changes its island footprint.
height, valoria_mask = valoria_terrain.apply(height, (U - 0.5) * SIZE, (V - 0.5) * SIZE)

# ------------------------------------------------------------------ sklon a povrchy
cell = SIZE / (N - 1)
gy, gx = np.gradient(height, cell)
slope = np.sqrt(gx * gx + gy * gy)                                   # m / m
rock = smooth(0.55, 1.0, slope)
beach = (1 - smooth(2.0, 4.5, height)) * (height > -1.5)
river_bank = (1 - smooth(width + 5, width + 40, river_d)) * (height > -1.0)
snow = np.maximum(smooth(40, 120, height + 40 * (fbm(18, 3, 701) - 0.5)) * smooth(0.25, 0.6, WR["frost"]),
                  smooth(330, 430, height))
n1 = fbm(32, 3, 801)

layers = np.zeros((8,) + U.shape, np.float32)
layers[0] = (WR["verdant"] * (0.55 + 0.6 * n1) + WR["frost"] * 0.6 + WR["meadow"] * 1.6 + 0.1) * (1 - snow)   # tráva
layers[1] = WR["verdant"] * smooth(0.45, 0.7, fbm(20, 3, 811)) * 1.2 + WR["ignis"] * 0.25 + WR["meadow"] * smooth(0.6, 0.8, fbm(16, 3, 813)) * 0.8   # lesní půda / hlína
layers[2] = np.maximum(beach, river_bank * 0.9) * 2.5                                             # písek
layers[3] = rock * 1.6 + WR["frost"] * smooth(250, 450, height) * 0.4                            # skála
layers[4] = snow * 2.0 + lake_mask * 4.0                                                          # sníh a led
layers[5] = lava_mask * 6.0                                                                       # láva
layers[6] = WR["ignis"] * (1.3 + 0.5 * n1) * (1 - lava_mask)                                      # čedič a popel
layers[3] += WR["ignis"] * (0.35 + 0.8 * smooth(0.55, 0.8, fbm(22, 3, 905))) * (1 - lava_mask)   # skalní výchozy v Ignis
layers[7] = WR["crystal"] * (1.3 + 0.4 * n1)                                                      # ametystová půda
for i in (0, 1, 3, 6, 7):
    layers[i] *= 1 - np.clip(beach * 0.9 + lake_mask, 0, 1)
layers[0] *= 1 - np.clip(rock, 0, 1) * 0.8
layers = np.maximum(layers, 0)
layers = np.stack([blur(l, 1) for l in layers])
layers /= np.maximum(layers.sum(0), 1e-6)
for i in range(8):
    layers[i] *= 1 - valoria_mask
for i, weight in enumerate(valoria_terrain.surface_weights(height, slope, n1)):
    layers[i] += valoria_mask * weight


# ------------------------------------------------------------------ zápis
def save_splat(idx, name):
    rgba = np.stack([layers[i] for i in idx], -1)[:2048, :2048]
    Image.fromarray((rgba * 255 + 0.5).clip(0, 255).astype(np.uint8), "RGBA").save(os.path.join(ASSETS, "Terrain", name), optimize=True)


os.makedirs(os.path.join(ASSETS, "Terrain"), exist_ok=True)
h16 = ((height - BASE) / RANGE * 65535).clip(0, 65535).astype(np.uint16)
Image.fromarray(h16).save(os.path.join(ASSETS, "Terrain", "aethelgard_height.png"), optimize=True)
save_splat((0, 1, 2, 3), "aethelgard_splat0.png")
save_splat((4, 5, 6, 7), "aethelgard_splat1.png")

# ------------------------------------------------------------------ velká mapa (M): malovaný reliéf
PAL = np.array([[86, 128, 52], [92, 76, 50], [222, 200, 150], [128, 120, 110], [236, 242, 250], [240, 110, 30],
                [52, 44, 44], [150, 90, 190]], np.float32) / 255
col = np.tensordot(layers.transpose(1, 2, 0), PAL, axes=([2], [0]))
col = col * (1 - WR["verdant"][..., None] * 0.3) + np.array([34, 90, 36]) / 255 * WR["verdant"][..., None] * 0.3
hs = np.clip(0.8 + (-gx * 0.7 + gy * 0.7) * 0.9, 0.45, 1.3)        # stínování svahů (světlo od SZ)
col *= hs[..., None]
sea = np.clip(-height / 60, 0, 1)[..., None]
water = (height < 0.2)[..., None]
deep, shallow = np.array([24, 60, 110]) / 255, np.array([70, 150, 175]) / 255
col = np.where(water, shallow * (1 - sea) + deep * sea, col)
img = Image.fromarray((col.clip(0, 1) * 255).astype(np.uint8)[:2048, :2048]).resize((1536, 1536), Image.LANCZOS)
# pergamen: teplý nádech, vlnky oceánu, okraj
parch = Image.new("RGB", img.size, (226, 205, 160))
img = Image.blend(img, parch, 0.16)
dr = ImageDraw.Draw(img)
coast_px = np.array(Image.fromarray(((height[:2048, :2048] > 0.2) * 255).astype(np.uint8)).resize((1536, 1536)))
edge = np.array(Image.fromarray(coast_px).filter(ImageFilter.FIND_EDGES))
arr = np.array(img)
arr[edge > 0] = (arr[edge > 0] * 0.45).astype(np.uint8)
img = Image.fromarray(arr)
vign = np.ones((1536, 1536), np.float32)
yy, xx = np.mgrid[0:1536, 0:1536] / 1535.0
vign = np.clip(1.15 - 0.55 * ((xx - 0.5) ** 2 + (yy - 0.5) ** 2) * 2.2, 0.5, 1)
img = Image.fromarray((np.array(img) * vign[..., None]).astype(np.uint8))
dr = ImageDraw.Draw(img)
for k in range(4):
    dr.rectangle([6 + k * 3, 6 + k * 3, 1529 - k * 3, 1529 - k * 3], outline=(92, 66, 36) if k % 2 == 0 else (190, 160, 110))
os.makedirs(os.path.join(ASSETS, "UI"), exist_ok=True)
img.save(os.path.join(ASSETS, "UI", "aethelgard_map.jpg"), quality=88)


# ------------------------------------------------------------------ data pro Lua
def world_xy(uu, vv):
    return round((uu - 0.5) * SIZE, 1), round((vv - 0.5) * SIZE, 1)


def h_at(uu, vv):
    c, r = int(round(uu * (N - 1))), int(round(vv * (N - 1)))
    return float(height[min(r, N - 1), min(c, N - 1)])


G = 256
codes = np.full((G, G), "o", dtype="<U1")
small = lambda a: a[::8, ::8][:G, :G]
hs_, wr = small(height), {k: small(WR[k]) for k in WR}
best = np.argmax(np.stack([wr[k] for k in REGIONS]), 0)
letters = np.array(["v", "f", "i", "c"])
best = np.where(small(WR["meadow"]) > np.max(np.stack([wr[k] for k in REGIONS]), 0), 4, best)
letters = np.array(["v", "f", "i", "c", "m"])
codes = np.where(hs_ > 0.4, letters[best], "o")
codes = np.where((small(river_mask) > 0.5) & (hs_ <= 0.4), "r", codes)
codes = np.where(small(lava_mask) > 0.5, "l", codes)
codes = np.where(small(lake_mask) > 0.5, "k", codes)
codes = np.where((hs_ > 0.4) & (small(beach) > 0.5), "b", codes)
codes = np.where((small(valoria_mask) > 0.5) & (hs_ > 0.4), "a", codes)
rows = ["".join(r) for r in codes]


def poi(name, uu, vv, extra=""):
    x, z = world_xy(uu, vv)
    return '    %s = { x = %s, z = %s%s },\n' % (name, x, z, extra)


lua = ["-- Vygenerováno: tools/aethelgard_world.py (neupravovat ručně)\n", "local D = {}\n",
       "D.Size = %d\nD.SeaY = 0\nD.HeightBase = %s\nD.HeightRange = %s\n" % (SIZE, BASE, RANGE),
       "-- mřížka regionů %d x %d (%.0f m na buňku), řádek 1 = sever (z = -%d):\n" % (G, G, SIZE / G, SIZE / 2),
       "-- o oceán, r řeka, b pláž, a Valoria, m louky, v Verdant Canopy, f Frostfang Peaks, i Ignis Scar, c Crystalarium, l láva, k jezero\n",
       "D.Grid = %d\nD.Rows = {\n" % G]
lua += ['"%s",\n' % r for r in rows]
lua.append("}\n")
lua.append("D.Volcanoes = {\n")
for cx, cy, hv, r in VOLCANOES:
    x, z = world_xy(cx, cy)
    lua.append("    { x = %s, z = %s, height = %.0f, radius = %.0f },\n" % (x, z, hv, r * SIZE))
lua.append("}\n")
lx, lz = world_xy(LAKE[0], LAKE[1])
lua.append("D.FrozenLake = { x = %s, z = %s, rx = %.0f, rz = %.0f, y = %.0f }\n" % (lx, lz, LAKE[2] * SIZE, LAKE[3] * SIZE, lake_y))
lua.append("D.River = {\n")
for p in SERPENTINE[::6]:
    x, z = world_xy(p[0], p[1])
    lua.append("    { %s, %s },\n" % (x, z))
lua.append("}\n")


def find_spot(uu, vv, region=None, hmin=3.0, hmax=200.0, max_slope=0.25, radius=0.06, avoid=()):
    """Nejbližší místo k (uu, vv) na souši v daném regionu s mírným sklonem (spirála)."""
    for k in range(0, 4000):
        a = k * 2.399963
        rr = radius * math.sqrt(k / 4000.0)
        cu, cv = uu + math.cos(a) * rr, vv + math.sin(a) * rr
        c, r = int(cu * (N - 1)), int(cv * (N - 1))
        if not (0 <= c < N and 0 <= r < N):
            continue
        hh = height[r, c]
        if not (hmin <= hh <= hmax) or slope[r, c] > max_slope or river_d[r, c] < width[r, c] + 25 or lava_d[r, c] < 30:
            continue
        if region and max(WR, key=lambda k_: WR[k_][r, c]) != region:
            continue
        if any((cu - au) ** 2 + (cv - av) ** 2 < 0.0009 ** 2 for au, av in avoid):
            continue
        return cu, cv
    return uu, vv


def bridge_over(t):
    """Most přes Serpentine River v místě t (0..1 podél řeky): střed, směr a délka (m)."""
    i = int(t * (len(SERPENTINE) - 1))
    a, b = SERPENTINE[max(0, i - 2)], SERPENTINE[min(len(SERPENTINE) - 1, i + 2)]
    d = (b - a) / max(np.linalg.norm(b - a), 1e-9)
    nrm = np.array([-d[1], d[0]])
    c = SERPENTINE[i]
    # délka: kde po obou stranách stoupne terén nad 2.5 m
    def side(sign):
        for step in range(1, 400):
            q = c + nrm * sign * step * 2.0 / SIZE
            cc, rr = int(q[0] * (N - 1)), int(q[1] * (N - 1))
            if height[rr, cc] > 2.5:
                return step * 2.0 + 6
        return 300.0
    l1, l2 = side(1), side(-1)
    mid = c + nrm * (l1 - l2) * 0.5 / SIZE
    return mid, math.degrees(math.atan2(nrm[0], nrm[1])), l1 + l2


POIS = {}
POIS["Start"] = find_spot(0.535, 0.535, "meadow" if (WR["meadow"] > 0).any() else None, 4, 60, 0.12)
POIS["Lyrise"] = find_spot(POIS["Start"][0] + 0.0012, POIS["Start"][1] - 0.0010, None, 4, 60, 0.15, 0.01)
POIS["Tower"] = find_spot(POIS["Start"][0] + 0.004, POIS["Start"][1] - 0.006, None, 4, 60, 0.15, 0.02)
POIS["Giant"] = find_spot(0.25, 0.52, "verdant", 8, 120, 0.2)
POIS["Shrine"] = find_spot(0.29, 0.60, "verdant", 8, 120, 0.15)
POIS["Rift"] = find_spot(0.80, 0.49, "crystal", 10, 300, 0.12)
POIS["DragonLair"] = find_spot(0.55, 0.255, "frost", 140, 330, 0.35)
POIS["SpiderNest"] = find_spot(0.60, 0.70, "ignis", 10, 260, 0.3)
spawns = []
def group(kind, uu, vv, region, n, spread, hmin=3, hmax=300, ms=0.3):
    for i in range(n):
        a = i * 2.399963 + 0.7
        cu, cv = find_spot(uu + math.cos(a) * spread * math.sqrt((i + 1) / n), vv + math.sin(a) * spread * math.sqrt((i + 1) / n),
                           region, hmin, hmax, ms, 0.01)
        spawns.append((kind, cu, cv))
sx, sz = POIS["Start"]
group("wolf", sx + 0.012, sz + 0.012, None, 8, 0.008)
group("wolf", 0.31, 0.47, "verdant", 6, 0.012)
group("cultist", POIS["Rift"][0], POIS["Rift"][1], "crystal", 5, 0.006)
group("crusher", POIS["Rift"][0] + 0.002, POIS["Rift"][1] + 0.004, "crystal", 1, 0.001)
group("spider", POIS["SpiderNest"][0], POIS["SpiderNest"][1], "ignis", 4, 0.006)
group("dragon", POIS["DragonLair"][0], POIS["DragonLair"][1], "frost", 1, 0.001, 140, 330, 0.35)
BRIDGES = [bridge_over(0.30), bridge_over(0.47), bridge_over(0.66)]

lua.append("D.POI = {\n")
for k, (pu, pv) in POIS.items():
    x, z = world_xy(pu, pv)
    lua.append("    %s = { x = %s, z = %s },\n" % (k, x, z))
lua.append("}\n")
lua.append("D.Spawns = {\n")
for kind, pu, pv in spawns:
    x, z = world_xy(pu, pv)
    lua.append('    { "%s", %s, %s },\n' % (kind, x, z))
lua.append("}\n")
lua.append("-- mosty přes Serpentine River: střed, natočení (stupně), délka (m)\nD.Bridges = {\n")
for mid, yaw, length in BRIDGES:
    x, z = world_xy(mid[0], mid[1])
    lua.append("    { x = %s, z = %s, yaw = %.1f, length = %.0f },\n" % (x, z, yaw, length))
lua.append("}\n")
lua.append("D.Regions = {\n")
names = {"verdant": "Verdant Canopy", "frost": "Frostfang Peaks", "ignis": "Ignis Scar", "crystal": "Crystalarium"}
for k, (cx, cy, rx, ry) in REGIONS.items():
    x, z = world_xy(cx, cy)
    lua.append('    %s = { name = "%s", x = %s, z = %s },\n' % (k, names[k], x, z))
lua.append("}\n")
open(os.path.join(ASSETS, "Scripts", "eryndor", "world_data.lua"), "w").write("".join(lua) + "return D\n")

print("výšky %.1f .. %.1f m, souš %.0f %%" % (height.min(), height.max(), (height > 0.2).mean() * 100))
for k in REGIONS:
    print(k, "%.0f %%" % ((codes == k[0]).mean() * 100))
