# Kontrola rigu hrdinů: kosterní deformace na CPU (stejně jako engine) a počet natažených trojúhelníků
# v každém klipu. Spouštět ze složky projektu:
#   python3 tools/rig_check.py hoplit_m,vestec_f              -> čísla
#   python3 tools/rig_check.py vestec_m /tmp/nahled Cast,Cheer -> + náhled (červeně natažené)
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig_heroes as r
from PIL import Image, ImageDraw

def qmat(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                     [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]], np.float32)

def setup(name):
    src = f'Assets/Models/heroes/{name}.glb'
    j, bn = r.load_glb(src); prim = j['meshes'][0]['primitives'][0]
    P = r.read_acc(j, bn, prim['attributes']['POSITION']).astype(np.float32)
    I = r.read_acc(j, bn, prim['indices']).reshape(-1, 3).astype(np.int64)
    o = r.model_opts(name)
    return j, bn, prim, P, I, o['weapon'], o['robe']

def weights(name, P, I, weapon, robe, j, bn, prim):
    y0 = float(P[:, 1].min()); H = float(P[:, 1].max()) - y0
    joints = r.skeleton(robe) if not hasattr(r, 'fit_skeleton') else r.fit_skeleton(P, y0, H, robe, weapon)
    tris = r.welded_tris(P, I) if hasattr(r, 'welded_tris') else None
    o = r.model_opts(name)
    ji, jw = r.compute_weights(P, joints, y0, H, robe, tris, quiver=o['quiver'], shield=o['shield'], drape=o['drape'])
    return joints, ji, jw, y0, H

def pose(joints, y0, H, weapon, clip, t, dur, calm=None):
    names = [n for n, _, _ in joints]
    world = {n: np.array([x, y0 + fy * H, zz], np.float32) for n, _, (x, fy, zz) in joints}
    R, T = r.clip_pose(clip, t, dur, weapon, H, calm)
    G = {}
    for n, parent, _ in joints:
        local_t = world[n] - (world[parent] if parent else 0)
        if n == 'Hips':
            local_t = local_t + np.array([0, T[0], T[1]], np.float32)
        M = np.eye(4, dtype=np.float32)
        M[:3, :3] = qmat(r.quat_euler(*R.get(n, (0, 0, 0))))
        M[:3, 3] = local_t
        G[n] = (G[parent] @ M) if parent else M
    S = np.zeros((len(names), 4, 4), np.float32)
    for i, n in enumerate(names):
        ib = np.eye(4, dtype=np.float32); ib[:3, 3] = -world[n]
        S[i] = G[n] @ ib
    return S

def skin(P, ji, jw, S):
    Ph = np.concatenate([P, np.ones((len(P), 1), np.float32)], 1)
    out = np.zeros_like(P)
    for c in range(4):
        M = S[ji[:, c].astype(int)]
        out += jw[:, c:c+1] * np.einsum('nij,nj->ni', M, Ph)[:, :3]
    return out

def stretch(P, Q, I):
    def el(X):
        a, b, c = X[I[:, 0]], X[I[:, 1]], X[I[:, 2]]
        return np.stack([np.linalg.norm(a-b, axis=1), np.linalg.norm(b-c, axis=1), np.linalg.norm(c-a, axis=1)], 1)
    e0, e1 = el(P), el(Q)
    ratio = (e1 / np.maximum(e0, 1e-5)).max(1)
    # absolutní prodloužení (krátké hrany se smí natáhnout, když je to málo vidět)
    grow = (e1 - e0).max(1)
    return ratio, grow

CLIPS = {c: d for c, d, _ in r.CLIPS}
def evaluate(name, tag='', render=None):
    j, bn, prim, P, I, weapon, robe = setup(name)
    joints, ji, jw, y0, H = weights(name, P, I, weapon, robe, j, bn, prim)
    total = []
    rows = []
    for clip, fr in [('Walk', .25), ('Run', .25), ('Attack', .45), ('Block', .5), ('Cast', .5), ('Hit', .3), ('Cheer', .5), ('Death', 1.0)]:
        d = CLIPS[clip]
        Q = skin(P, ji, jw, pose(joints, y0, H, weapon, clip, fr * d, d, r.model_opts(name)['calm']))
        ratio, grow = stretch(P, Q, I)
        bad = (grow > 0.04 * H) & (ratio > 1.6)
        rows.append(f'{clip}:{bad.sum()}')
        total.append(bad.sum())
        if render is not None and clip in render:
            render[clip] = (Q, I, bad)
    print(f'{name}{tag}: celkem {sum(total)}  ' + ' '.join(rows))
    return sum(total)

def draw(Q, I, bad, path, H, y0, views=('front', 'side')):
    S = 200; W = 260 * len(views); img = Image.new('RGB', (W, 420), 'white'); d = ImageDraw.Draw(img)
    for v, view in enumerate(views):
        ax = 0 if view == 'front' else 2
        depth = Q[:, 2] if view == 'front' else -Q[:, 0]
        order = np.argsort(depth[I].mean(1))
        for t in order:
            pts = [(v * 260 + 130 + Q[k, ax] * S, 410 - (Q[k, 1] - y0) * S) for k in I[t]]
            # jednoduché stínování podle normály
            a, b, c = Q[I[t]]
            nrm = np.cross(b - a, c - a); nl = np.linalg.norm(nrm) + 1e-9
            s = abs(nrm[2 if view == 'front' else 0]) / nl
            col = (230, 40, 40) if bad[t] else tuple(int(80 + 150 * s) for _ in range(3))
            d.polygon(pts, fill=col)
    img.save(path)

if __name__ == '__main__':
    names = sys.argv[1].split(',')
    out = sys.argv[2] if len(sys.argv) > 2 else None
    clips = sys.argv[3].split(',') if len(sys.argv) > 3 else []
    imgs = []
    for n in names:
        rd = {c: None for c in clips}
        evaluate(n, render=rd if out else None)
        if out:
            j, bn, prim, P, I, weapon, robe = setup(n)
            y0 = P[:, 1].min(); H = P[:, 1].max() - y0
            for c in clips:
                Q, I2, bad = rd[c]
                p = f'{out}_{n}_{c}.png'; draw(Q, I2, bad, p, H, y0); imgs.append(p)
    if out and imgs:
        ims = [Image.open(p) for p in imgs]
        cols = len(clips); rows = len(names)
        g = Image.new('RGB', (cols * ims[0].width, rows * ims[0].height), 'white')
        for k, im in enumerate(ims):
            g.paste(im, ((k % cols) * im.width, (k // cols) * im.height))
        g.save(out + '_grid.png')
        for p in imgs: os.remove(p)
