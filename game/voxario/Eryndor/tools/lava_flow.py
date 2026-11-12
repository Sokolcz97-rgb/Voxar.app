#!/usr/bin/env python3
"""Mapa toku lávy pro Aethelgard (engine ≥ 1.19, world.terrain{flowmap}).

  python3 tools/lava_flow.py

Vstup:  Assets/Terrain/aethelgard_height.png (16 bit), aethelgard_splat1.png (G = láva), sopky z world_data.lua
Výstup: Assets/Terrain/aethelgard_lava_flow.png – RGB přes celý svět (stejně jako splat textury):
        R, G = směr a rychlost toku (0,5 = stojí, 1 = 2,4 m/s na východ / na jih), B = žár (střed proudu 1,
        chladnoucí okraj 0).

Směr podél koryta: orientace lávové masky (strukturní tenzor) – proud sleduje meandry řeky, ne spád kužele;
láva teče od kráteru (vzdálenost měřená korytem), rychlost podle spádu ve směru toku. V kráterech pomalu
víří lávové jezero.
"""
from __future__ import annotations

import pathlib
import re

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
TERRAIN = ROOT / "Assets" / "Terrain"
WORLD_DATA = ROOT / "Assets" / "Scripts" / "eryndor" / "world_data.lua"
SIZE = 8192.0
BASE, RANGE = -80.0, 760.0
MAX_SPEED = 2.4   # m/s – musí odpovídat shaderu enginu


def gaussian(a: np.ndarray, sigma: float) -> np.ndarray:
    """Gaussovské rozmazání přes FFT (svět je větší než láva, okraje nevadí)."""
    n, m = a.shape
    fy = np.fft.fftfreq(n)[:, None]
    fx = np.fft.rfftfreq(m)[None, :]
    kernel = np.exp(-2.0 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.fft.irfft2(np.fft.rfft2(a) * kernel, s=a.shape).astype(np.float32)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def channel_distance(mask: np.ndarray, cell: float) -> np.ndarray:
    """Vzdálenost (m) od kráterů sopek po pixelech masky (8-okolí); nedosažitelné = inf."""
    import heapq
    n = mask.shape[0]
    dist = np.full(mask.shape, np.inf, np.float32)
    xs = (np.arange(n, dtype=np.float32) + 0.5) * cell - SIZE / 2
    heap = []
    for vx, vz, radius in volcanoes():
        c0, r0 = int((vx + SIZE / 2) / cell), int((vz + SIZE / 2) / cell)
        rad = int(0.19 * radius / cell) + 1
        for r in range(r0 - rad, r0 + rad + 1):
            for c in range(c0 - rad, c0 + rad + 1):
                if 0 <= r < n and 0 <= c < n and mask[r, c] and np.hypot(xs[c] - vx, xs[r] - vz) < 0.19 * radius:
                    dist[r, c] = 0.0
                    heap.append((0.0, r, c))
    heapq.heapify(heap)
    steps = [(-1, 0, 1.0), (1, 0, 1.0), (0, -1, 1.0), (0, 1, 1.0),
             (-1, -1, 1.4142), (-1, 1, 1.4142), (1, -1, 1.4142), (1, 1, 1.4142)]
    while heap:
        d, r, c = heapq.heappop(heap)
        if d > dist[r, c]:
            continue
        for dr, dc, w in steps:
            rr, cc = r + dr, c + dc
            if 0 <= rr < n and 0 <= cc < n and mask[rr, cc]:
                nd = d + w * cell
                if nd < dist[rr, cc]:
                    dist[rr, cc] = nd
                    heapq.heappush(heap, (nd, rr, cc))
    return dist


def volcanoes() -> list[tuple[float, float, float]]:
    text = WORLD_DATA.read_text(encoding="utf-8")
    block = text[text.index("D.Volcanoes"):]
    block = block[:block.index("}\n}") + 3] if "}\n}" in block else block[:400]
    out = []
    for x, z, r in re.findall(r"x = ([-\d.]+), z = ([-\d.]+), height = [-\d.]+, radius = ([-\d.]+)", block):
        out.append((float(x), float(z), float(r)))
    return out


def build() -> np.ndarray:
    splat1 = np.asarray(Image.open(TERRAIN / "aethelgard_splat1.png").convert("RGBA"), np.float32) / 255.0
    n = splat1.shape[0]
    cell = SIZE / n
    height = np.asarray(Image.open(TERRAIN / "aethelgard_height.png"), np.float32) / 65535.0 * RANGE + BASE
    height = np.asarray(Image.fromarray(height, "F").resize((n, n), Image.BILINEAR), np.float32)
    lava = splat1[..., 1]

    # spád vyhlazeného terénu (koryto, šum detailu a hrany se ztratí, zůstane svah sopky)
    hs = gaussian(height, 7.0)
    gz, gx = np.gradient(hs, cell)
    slope = np.hypot(gx, gz)
    down = np.stack([-gx, -gz], -1) / np.maximum(slope, 1e-5)[..., None]

    # osa koryta ze strukturního tenzoru masky lávy
    m = gaussian(lava, 1.2)
    mz, mx = np.gradient(m)
    jxx, jxz, jzz = gaussian(mx * mx, 3.5), gaussian(mx * mz, 3.5), gaussian(mz * mz, 3.5)
    theta = 0.5 * np.arctan2(2.0 * jxz, jxx - jzz)      # napříč korytem
    along = np.stack([-np.sin(theta), np.cos(theta)], -1)
    lam = np.sqrt((jxx - jzz) ** 2 + 4.0 * jxz * jxz)
    coherence = lam / np.maximum(jxx + jzz, 1e-8)
    # znaménko: láva teče od kráteru – vzdálenost měřená korytem (Dijkstra po masce lávy); místní spád
    # v ohybech meandrů míří napříč korytem, proto se na něj spoléhá jen tam, kam se z kráteru nedojde
    dist = channel_distance(lava > 0.25, cell)
    reached = np.isfinite(dist)
    dfill = np.where(reached, dist, 0.0).astype(np.float32)
    wgt = gaussian(reached.astype(np.float32), 2.0)
    dsm = gaussian(dfill, 2.0) / np.maximum(wgt, 1e-4)
    dz_, dx_ = np.gradient(dsm, cell)
    away = np.stack([dx_, dz_], -1)
    ref = np.where(reached[..., None], away, down)
    sign = np.where((along * ref).sum(-1) < 0.0, -1.0, 1.0)
    along *= sign[..., None]
    down = np.where(reached[..., None], away / np.maximum(np.linalg.norm(away, axis=-1), 1e-5)[..., None], down)
    k = smoothstep(0.35, 0.75, coherence)[..., None]
    direction = along * k + down * (1.0 - k)
    direction /= np.maximum(np.linalg.norm(direction, axis=-1), 1e-5)[..., None]
    # rychlost podle spádu ve směru toku: z kopce rychle, po rovině a v mírném stoupání koryta líně
    hz2, hx2 = np.gradient(gaussian(height, 4.0), cell)
    fall = -(direction[..., 0] * hx2 + direction[..., 1] * hz2)
    speed = np.clip(0.4 + fall * 5.0, 0.2, 1.0)

    # žár: střed proudu (dál od okraje masky) je žhavý, okraje chladnou
    core = smoothstep(0.35, 0.95, gaussian(lava, 2.0))
    speed *= 0.45 + 0.55 * core   # u břehů láva brzdí

    vel = direction * speed[..., None]

    # krátery: lávové jezero pomalu víří a přetéká ven
    xs = (np.arange(n, dtype=np.float32) + 0.5) * cell - SIZE / 2
    X, Z = np.meshgrid(xs, xs)
    for vx, vz, radius in volcanoes():
        dx, dz = X - vx, Z - vz
        d = np.hypot(dx, dz)
        crater = 1.0 - smoothstep(0.12 * radius, 0.2 * radius, d)
        radial = np.stack([dx, dz], -1) / np.maximum(d, 1e-3)[..., None]
        tangent = np.stack([-radial[..., 1], radial[..., 0]], -1)
        lake = radial * 0.12 + tangent * 0.2
        vel = vel * (1.0 - crater[..., None]) + lake * crater[..., None]
        core = np.maximum(core, crater * 0.95)

    # hladké pole rychlosti (shader posouvá kůru až o 16 s toku – zlomy by byly vidět)
    vel = np.stack([gaussian(vel[..., 0], 1.5), gaussian(vel[..., 1], 1.5)], -1)
    active = smoothstep(0.02, 0.15, gaussian(lava, 1.5))
    vel *= active[..., None]
    core *= active
    rgb = np.dstack([vel[..., 0] * 0.5 + 0.5, vel[..., 1] * 0.5 + 0.5, core])
    return (np.clip(rgb, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8)


def main() -> None:
    rgb = build()
    out = TERRAIN / "aethelgard_lava_flow.png"
    Image.fromarray(rgb, "RGB").save(out, optimize=True)
    moving = (np.abs(rgb[..., :2].astype(np.int16) - 128) > 8).any(-1).mean() * 100
    print(f"{out.relative_to(ROOT)}: {rgb.shape[1]} x {rgb.shape[0]}, tok na {moving:.2f} % světa")


if __name__ == "__main__":
    main()
