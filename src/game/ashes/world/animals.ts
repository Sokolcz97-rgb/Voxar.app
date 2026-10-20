import * as THREE from "three";
import { furTex } from "../three/textures";
import { CAMP, CITY, COVE, WORLD_HALF, heightAt, inCity, roadDistance } from "./map";

/**
 * Zvířata – oživení krajiny (jen kosmetika, s nimi se nebojuje).
 * Stylizovaná podle šablon: kulatá těla, velké lesklé oči, výrazné čenichy,
 * uši a rohy. Plachá zvířata před hráčem utíkají.
 */

type Kind = "sheep" | "goat" | "stag" | "doe" | "dog" | "chicken" | "horse" | "boar" | "cow" | "pig" | "wolf" | "bear" | "squirrel";

type Walker = {
  kind: Kind;
  g: THREE.Group;
  legs: THREE.Object3D[];
  head: THREE.Object3D;
  tail: THREE.Object3D | null;
  pos: THREE.Vector2;
  home: THREE.Vector2;
  target: THREE.Vector2;
  range: number;
  speed: number;
  wait: number;
  phase: number;
  heading: number;
  flee: number;
};

type Bird = { g: THREE.Group; wings: THREE.Object3D[]; cx: number; cz: number; r: number; h: number; a: number; speed: number; phase: number };

type Ears = "floppy" | "pointy" | "round" | "cow" | "pig" | "none";
type Horns = "goat" | "cow" | "antlers" | "none";
type Tail = "tuft" | "curly" | "bushy" | "long" | "stub";

type Spec = {
  r: number;
  len: number;
  legH: number;
  legR: number;
  head: number;
  neck: number;
  color: string;
  belly?: string;
  muzzle: string;
  nose: string;
  hoof: string;
  ears: Ears;
  horns: Horns;
  tail: Tail;
  tailColor?: string;
  speed: number;
  shy: number;
  spots?: string;
  tusks?: boolean;
  beard?: boolean;
  mane?: string;
};

const SPECS: Record<Exclude<Kind, "chicken" | "squirrel">, Spec> = {
  sheep: { r: 0.3, len: 0.42, legH: 0.24, legR: 0.045, head: 0.17, neck: 0.12, color: "#f2ede2", muzzle: "#3a302a", nose: "#1c1612", hoof: "#2a221c", ears: "round", horns: "none", tail: "stub", speed: 2.6, shy: 6 },
  goat: { r: 0.24, len: 0.42, legH: 0.32, legR: 0.04, head: 0.15, neck: 0.22, color: "#8a6a4c", belly: "#e8dccb", muzzle: "#e8d8c8", nose: "#e89a8a", hoof: "#2a221c", ears: "pointy", horns: "goat", tail: "tuft", speed: 3.2, shy: 7, beard: true },
  stag: { r: 0.28, len: 0.55, legH: 0.55, legR: 0.045, head: 0.15, neck: 0.42, color: "#9a5e30", belly: "#e8d0aa", muzzle: "#3a2a20", nose: "#1c1612", hoof: "#2a1e16", ears: "pointy", horns: "antlers", tail: "stub", speed: 6.5, shy: 12 },
  doe: { r: 0.24, len: 0.46, legH: 0.48, legR: 0.038, head: 0.14, neck: 0.36, color: "#c07a40", belly: "#f0dcc0", muzzle: "#4a3226", nose: "#1c1612", hoof: "#2a1e16", ears: "pointy", horns: "none", tail: "stub", speed: 6.5, shy: 12, spots: "#f4e6cc" },
  dog: { r: 0.2, len: 0.36, legH: 0.22, legR: 0.045, head: 0.16, neck: 0.18, color: "#b06a30", belly: "#e8c08a", muzzle: "#e8c08a", nose: "#1c1410", hoof: "#c08a50", ears: "floppy", horns: "none", tail: "long", speed: 5, shy: 0 },
  horse: { r: 0.36, len: 0.85, legH: 0.62, legR: 0.06, head: 0.17, neck: 0.55, color: "#6a3e22", muzzle: "#4a2a18", nose: "#1c1410", hoof: "#2a1e16", ears: "pointy", horns: "none", tail: "long", tailColor: "#1e140e", speed: 4, shy: 0, mane: "#1e140e" },
  boar: { r: 0.3, len: 0.42, legH: 0.18, legR: 0.05, head: 0.19, neck: 0.04, color: "#5a3e2c", muzzle: "#e89a8a", nose: "#d87a72", hoof: "#2a1e16", ears: "pointy", horns: "none", tail: "tuft", speed: 4.5, shy: 8, tusks: true, mane: "#3a281c" },
  cow: { r: 0.4, len: 0.62, legH: 0.32, legR: 0.07, head: 0.22, neck: 0.18, color: "#f2eee6", muzzle: "#f0a09a", nose: "#d8807a", hoof: "#2a221c", ears: "cow", horns: "cow", tail: "long", tailColor: "#f2eee6", speed: 2.2, shy: 0, spots: "#5a4434" },
  pig: { r: 0.32, len: 0.36, legH: 0.13, legR: 0.055, head: 0.2, neck: 0.02, color: "#f3a8a8", muzzle: "#f08c90", nose: "#e07a80", hoof: "#8a5a50", ears: "pig", horns: "none", tail: "curly", speed: 2.4, shy: 4 },
  wolf: { r: 0.2, len: 0.46, legH: 0.3, legR: 0.045, head: 0.16, neck: 0.16, color: "#8a8e96", belly: "#e8e8ec", muzzle: "#e4e4e8", nose: "#1c1c20", hoof: "#e8e8ec", ears: "pointy", horns: "none", tail: "bushy", speed: 6, shy: 10 },
  bear: { r: 0.48, len: 0.5, legH: 0.26, legR: 0.11, head: 0.27, neck: 0.12, color: "#8a5028", muzzle: "#d8a868", nose: "#1c1410", hoof: "#3a2418", ears: "round", horns: "none", tail: "stub", speed: 4, shy: 14 },
};

const SHY = { ...Object.fromEntries(Object.entries(SPECS).map(([k, v]) => [k, v.shy])), chicken: 3.5, squirrel: 5 } as Record<Kind, number>;
const SPEED = { ...Object.fromEntries(Object.entries(SPECS).map(([k, v]) => [k, v.speed])), chicken: 2.4, squirrel: 5.5 } as Record<Kind, number>;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Built = { g: THREE.Group; legs: THREE.Object3D[]; head: THREE.Object3D; tail: THREE.Object3D | null };

export class Wildlife {
  private walkers: Walker[] = [];
  private birds: Bird[] = [];
  private mats = new Map<string, THREE.Material>();
  private geos = new Map<string, THREE.BufferGeometry>();
  private spotTex = new Map<string, THREE.Texture>();

  constructor(private scene: THREE.Scene, density = 1, private blocked: (x: number, z: number) => boolean = () => false) {
    const r = rng(4242);
    const n = (x: number) => Math.max(1, Math.round(x * density));
    // stáda: [druh, střed x, z, poloměr, počet]
    const herds: [Kind, number, number, number, number][] = [
      ["sheep", -30, 44, 10, n(6)],
      ["sheep", 10, 40, 9, n(5)],
      ["cow", 26, 18, 9, n(4)],
      ["pig", -38, 34, 5, n(3)],
      ["goat", -14, -48, 10, n(5)],
      ["goat", 22, -56, 9, n(4)],
      ["stag", -40, 6, 14, n(2)],
      ["doe", -40, 6, 14, n(3)],
      ["doe", -10, -26, 12, n(2)],
      ["stag", -10, -26, 12, 1],
      ["boar", -54, 10, 10, n(3)],
      ["wolf", 4, -70, 10, n(3)],
      ["bear", 34, -74, 8, 1],
      ["squirrel", -34, 14, 9, n(4)],
      ["squirrel", 14, 30, 8, n(3)],
      ["dog", -48, 46, 6, 1],
      ["dog", 70, 22, 8, 1],
      ["chicken", 80, 22, 5, n(5)],
      ["chicken", 64, 22, 4, n(4)],
      ["horse", CAMP.x - 8, CAMP.z + 10, 6, n(4)],
      ["dog", CAMP.x + 6, CAMP.z + 4, 6, 1],
      ["goat", COVE.x + 18, COVE.z + 22, 6, n(3)],
    ];
    for (const [kind, cx, cz, rad, count] of herds) {
      for (let i = 0; i < count; i += 1) {
        const p = new THREE.Vector2(cx + (r() - 0.5) * rad, cz + (r() - 0.5) * rad);
        if (!this.okGround(p.x, p.y, kind)) p.set(cx, cz);
        this.walkers.push(this.makeWalker(kind, p, new THREE.Vector2(cx, cz), rad, r()));
      }
    }
    // ptáci: racci nad pobřežím a Kalidrou, pěvci nad lesíky, vrány nad kopci
    for (let i = 0; i < n(7); i += 1) this.birds.push(this.makeBird("gull", -70 + r() * 30, -30 + r() * 110, 10 + r() * 14, 14 + r() * 8, r()));
    for (let i = 0; i < n(4); i += 1) this.birds.push(this.makeBird("gull", CITY.x1 + 6, CITY.z0 + r() * 50, 8 + r() * 8, 16 + r() * 6, r()));
    for (let i = 0; i < n(6); i += 1) this.birds.push(this.makeBird(i % 2 ? "robin" : "tit", -40 + r() * 70, -20 + r() * 60, 3 + r() * 4, 4 + r() * 3, r()));
    for (let i = 0; i < n(5); i += 1) this.birds.push(this.makeBird("crow", -20 + r() * 50, -70 + r() * 20, 8 + r() * 10, 18 + r() * 8, r()));
  }

  // ---------------------------------------------------------------- materiály a tvary (sdílené)
  private fur(color: string, spots?: string) {
    const key = `fur:${color}:${spots ?? ""}`;
    let m = this.mats.get(key);
    if (!m) {
      const t = furTex(color);
      m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.92, map: spots ? this.spotted(color, spots) : t.map, bumpMap: t.bump, bumpScale: 1.4 });
      this.mats.set(key, m);
    }
    return m;
  }

  private plain(color: string, rough = 0.6) {
    const key = `plain:${color}:${rough}`;
    let m = this.mats.get(key);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: rough });
      this.mats.set(key, m);
    }
    return m;
  }

  private glint() {
    let m = this.mats.get("glint");
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: "#ffffff" });
      this.mats.set("glint", m);
    }
    return m;
  }

  /** Srst se skvrnami (kráva, srnka). */
  private spotted(color: string, spot: string) {
    const key = `${color}:${spot}`;
    const hit = this.spotTex.get(key);
    if (hit) return hit;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.drawImage(furTex(color).map.image as CanvasImageSource, 0, 0, 256, 256);
      const r = rng(color.length * 31 + spot.length);
      ctx.fillStyle = spot;
      const small = spot.startsWith("#f");
      for (let i = 0; i < (small ? 26 : 9); i += 1) {
        const x = r() * 256, y = r() * 256, rad = small ? 4 + r() * 4 : 18 + r() * 26;
        ctx.globalAlpha = small ? 0.85 : 0.92;
        ctx.beginPath();
        ctx.ellipse(x, y, rad, rad * (0.7 + r() * 0.5), r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this.spotTex.set(key, tex);
    return tex;
  }

  private geo(key: string, make: () => THREE.BufferGeometry) {
    let g = this.geos.get(key);
    if (!g) {
      g = make();
      this.geos.set(key, g);
    }
    return g;
  }
  private sphere(r: number) {
    return this.geo(`s${r.toFixed(3)}`, () => new THREE.SphereGeometry(r, 16, 12));
  }
  private capsule(r: number, len: number) {
    return this.geo(`c${r.toFixed(3)}:${len.toFixed(3)}`, () => new THREE.CapsuleGeometry(r, len, 6, 12));
  }
  private cone(r: number, h: number) {
    return this.geo(`k${r.toFixed(3)}:${h.toFixed(3)}`, () => new THREE.ConeGeometry(r, h, 10));
  }
  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = shadow;
    return m;
  }

  /** Velké lesklé oči s obočím (společné všem zvířatům). */
  private eyes(head: THREE.Object3D, r: number, spread: number, y: number, z: number, iris = "#6a4012", brow?: string) {
    for (const s of [-1, 1]) {
      const eye = this.mesh(this.sphere(r), this.plain("#f8f4ec", 0.25), false);
      eye.position.set(s * spread, y, z);
      eye.scale.set(0.85, 1, 0.55);
      head.add(eye);
      const ir = this.mesh(this.sphere(r * 0.66), this.plain(iris, 0.25), false);
      ir.position.set(s * spread * 1.04, y - r * 0.05, z + r * 0.42);
      ir.scale.set(1, 1.08, 0.45);
      head.add(ir);
      const pu = this.mesh(this.sphere(r * 0.36), this.plain("#0c0806", 0.2), false);
      pu.position.set(s * spread * 1.06, y - r * 0.05, z + r * 0.62);
      pu.scale.set(1, 1.1, 0.45);
      head.add(pu);
      const sh = this.mesh(this.sphere(r * 0.16), this.glint(), false);
      sh.position.set(s * spread * 1.06 + r * 0.22, y + r * 0.3, z + r * 0.7);
      head.add(sh);
      if (brow) {
        const b = this.mesh(this.capsule(r * 0.16, r * 0.9), this.plain(brow, 0.8), false);
        b.rotation.z = Math.PI / 2 - 0.25 * s;
        b.position.set(s * spread, y + r * 1.15, z + r * 0.2);
        head.add(b);
      }
    }
  }

  // ---------------------------------------------------------------- stavba zvířat
  private makeWalker(kind: Kind, pos: THREE.Vector2, home: THREE.Vector2, range: number, seed: number): Walker {
    const built = kind === "chicken" ? this.buildChicken() : kind === "squirrel" ? this.buildSquirrel() : this.buildQuadruped(SPECS[kind]);
    const s = 0.9 + seed * 0.2;
    built.g.scale.setScalar(s);
    built.g.position.set(pos.x, heightAt(pos.x, pos.y), pos.y);
    this.scene.add(built.g);
    return { kind, ...built, pos: pos.clone(), home, target: pos.clone(), range, speed: SPEED[kind], wait: seed * 4, phase: seed * 10, heading: seed * 6.28, flee: 0 };
  }

  private buildQuadruped(sp: Spec): Built {
    const g = new THREE.Group();
    const furM = this.fur(sp.color, sp.spots);
    const bodyY = sp.legH + sp.r * 0.85;
    const body = this.mesh(this.capsule(sp.r, sp.len), furM);
    body.rotation.x = Math.PI / 2;
    body.position.y = bodyY;
    g.add(body);
    if (sp.belly) {
      const belly = this.mesh(this.capsule(sp.r * 0.82, sp.len * 0.8), this.fur(sp.belly));
      belly.rotation.x = Math.PI / 2;
      belly.position.set(0, bodyY - sp.r * 0.22, sp.r * 0.08);
      g.add(belly);
    }
    if (sp === SPECS.sheep) {
      // vlna – obláček kuliček
      const wool = this.fur("#f6f2ea");
      for (let i = 0; i < 9; i += 1) {
        const puff = this.mesh(this.sphere(sp.r * 0.55), wool);
        const a = (i / 9) * Math.PI * 2;
        puff.position.set(Math.cos(a) * sp.r * 0.55, bodyY + sp.r * 0.45 + Math.sin(a * 2) * 0.03, Math.sin(a) * sp.len * 0.55);
        g.add(puff);
      }
    }
    if (sp.mane) {
      const boar = sp === SPECS.boar;
      const mane = this.mesh(this.capsule(sp.r * 0.28, sp.len * (boar ? 0.8 : 0.3)), this.fur(sp.mane));
      mane.rotation.x = Math.PI / 2;
      mane.position.set(0, bodyY + sp.r * 0.85, boar ? 0 : sp.len * 0.45);
      g.add(mane);
    }

    // nohy na kyčlích
    const legs: THREE.Object3D[] = [];
    const hoofM = this.plain(sp.hoof, 0.5);
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group();
      const legLen = sp.legH + sp.r * 0.3;
      hip.position.set(x * sp.r * 0.55, legLen, z * sp.len * 0.45);
      const leg = this.mesh(this.capsule(sp.legR, Math.max(0.02, legLen - sp.legR * 2)), furM);
      leg.position.y = -legLen / 2;
      hip.add(leg);
      const hoof = this.mesh(this.sphere(sp.legR * 1.25), hoofM);
      hoof.scale.set(1, 0.6, 1.2);
      hoof.position.set(0, -legLen + sp.legR * 0.5, sp.legR * 0.3);
      hip.add(hoof);
      g.add(hip);
      legs.push(hip);
    }

    // krk a hlava
    const head = new THREE.Group();
    const headY = bodyY + sp.r * 0.4 + sp.neck;
    const headZ = sp.len * 0.5 + sp.r * 0.55 + sp.neck * 0.15;
    head.position.set(0, headY, headZ);
    g.add(head);
    if (sp.neck > 0.1) {
      const neck = this.mesh(this.capsule(sp.r * 0.42, sp.neck), furM);
      neck.position.set(0, (bodyY + headY) / 2, headZ - sp.neck * 0.35);
      neck.rotation.x = 0.45;
      g.add(neck);
    }
    const skull = this.mesh(this.sphere(sp.head), furM);
    skull.scale.set(1, 1, 1.05);
    head.add(skull);
    const long = sp === SPECS.horse || sp === SPECS.stag || sp === SPECS.doe || sp === SPECS.goat;
    const flat = sp === SPECS.pig || sp === SPECS.boar || sp === SPECS.cow;
    const muz = this.mesh(this.sphere(sp.head * (long ? 0.62 : flat ? 0.6 : 0.55)), this.fur(sp.muzzle));
    muz.scale.set(1, 0.85, long ? 1.5 : 1.05);
    muz.position.set(0, -sp.head * 0.32, sp.head * (long ? 0.9 : 0.78));
    head.add(muz);
    if (flat) {
      // plochý rypák s nozdrami
      const snout = this.mesh(this.geo(`snout${sp.head}`, () => new THREE.CylinderGeometry(sp.head * 0.42, sp.head * 0.46, sp.head * 0.3, 18)), this.plain(sp.muzzle, 0.5));
      snout.rotation.x = Math.PI / 2;
      snout.position.set(0, -sp.head * 0.3, sp.head * 1.12);
      head.add(snout);
      for (const s of [-1, 1]) {
        const nostril = this.mesh(this.sphere(sp.head * 0.08), this.plain("#5a2a2a", 0.6), false);
        nostril.scale.set(0.8, 1.2, 0.4);
        nostril.position.set(s * sp.head * 0.15, -sp.head * 0.3, sp.head * 1.27);
        head.add(nostril);
      }
    } else {
      const big = sp === SPECS.dog || sp === SPECS.bear || sp === SPECS.wolf;
      const nose = this.mesh(this.sphere(sp.head * (big ? 0.26 : 0.16)), this.plain(sp.nose, 0.35));
      nose.scale.set(1.2, 0.85, 0.9);
      nose.position.set(0, -sp.head * 0.18, sp.head * (long ? 1.6 : 1.28));
      head.add(nose);
    }
    this.eyes(
      head, sp.head * 0.3, sp.head * 0.42, sp.head * 0.22, sp.head * 0.72,
      sp === SPECS.doe || sp === SPECS.wolf ? "#7a5a20" : "#6a4012",
      sp === SPECS.bear || sp === SPECS.dog || sp === SPECS.goat ? "#4a2c18" : undefined,
    );
    if (sp.beard) {
      const beard = this.mesh(this.cone(sp.head * 0.25, sp.head * 0.7), this.fur("#f0e8dc"));
      beard.rotation.x = Math.PI;
      beard.position.set(0, -sp.head * 0.8, sp.head * 0.75);
      head.add(beard);
    }
    if (sp.tusks) {
      for (const s of [-1, 1]) {
        const tusk = this.mesh(this.cone(sp.head * 0.09, sp.head * 0.55), this.plain("#f4ecd8", 0.4));
        tusk.position.set(s * sp.head * 0.42, -sp.head * 0.15, sp.head * 1.05);
        tusk.rotation.set(-0.3, 0, -s * 0.5);
        head.add(tusk);
      }
    }
    // uši
    const earM = this.fur(sp.color);
    const innerM = this.plain("#f0a8a0", 0.7);
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      head.add(ear);
      if (sp.ears === "floppy") {
        const e = this.mesh(this.capsule(sp.head * 0.22, sp.head * 0.7), this.fur("#8a4c1e"));
        e.scale.set(1, 1, 0.45);
        ear.position.set(s * sp.head * 0.82, sp.head * 0.05, -sp.head * 0.05);
        ear.rotation.z = s * 0.25;
        e.position.y = -sp.head * 0.3;
        ear.add(e);
      } else if (sp.ears === "pointy" || sp.ears === "cow" || sp.ears === "pig") {
        const big = sp.ears === "cow" ? 1.25 : sp.ears === "pig" ? 1.1 : 1;
        const e = this.mesh(this.cone(sp.head * 0.28 * big, sp.head * 0.75 * big), earM);
        e.scale.set(1, 1, 0.35);
        const inner = this.mesh(this.cone(sp.head * 0.18 * big, sp.head * 0.55 * big), innerM, false);
        inner.scale.set(1, 1, 0.2);
        inner.position.set(0, -sp.head * 0.06, sp.head * 0.05);
        e.add(inner);
        ear.add(e);
        if (sp.ears === "cow") {
          ear.position.set(s * sp.head * 1.0, sp.head * 0.15, -sp.head * 0.05);
          ear.rotation.z = -s * 1.4;
        } else if (sp.ears === "pig") {
          ear.position.set(s * sp.head * 0.55, sp.head * 0.8, sp.head * 0.1);
          ear.rotation.set(0.7, 0, -s * 0.4);
        } else {
          ear.position.set(s * sp.head * 0.55, sp.head * 0.85, -sp.head * 0.05);
          ear.rotation.z = -s * 0.45;
        }
      } else if (sp.ears === "round") {
        const e = this.mesh(this.sphere(sp.head * 0.28), sp === SPECS.sheep ? this.fur(sp.muzzle) : earM);
        e.scale.set(1, 1, 0.5);
        ear.position.set(s * sp.head * 0.75, sp.head * 0.7, -sp.head * 0.1);
        ear.add(e);
      }
    }
    // rohy a parohy
    if (sp.horns === "goat") {
      for (const s of [-1, 1]) {
        const horn = this.mesh(this.geo("goathorn", () => new THREE.TorusGeometry(0.11, 0.025, 8, 16, Math.PI * 1.2)), this.plain("#6a5040", 0.5));
        horn.position.set(s * sp.head * 0.35, sp.head * 0.85, -sp.head * 0.2);
        horn.rotation.set(0, Math.PI / 2, Math.PI * 0.15);
        head.add(horn);
      }
    } else if (sp.horns === "cow") {
      for (const s of [-1, 1]) {
        const horn = this.mesh(this.cone(sp.head * 0.12, sp.head * 0.55), this.plain("#e8dcc0", 0.4));
        horn.position.set(s * sp.head * 0.62, sp.head * 0.8, 0);
        horn.rotation.z = -s * 0.7;
        head.add(horn);
      }
    } else if (sp.horns === "antlers") {
      const antM = this.plain("#7a5634", 0.7);
      for (const s of [-1, 1]) {
        const beam = this.mesh(this.capsule(0.022, 0.42), antM);
        beam.position.set(s * 0.12, sp.head + 0.2, -0.04);
        beam.rotation.z = -s * 0.45;
        head.add(beam);
        for (let i = 0; i < 3; i += 1) {
          const tine = this.mesh(this.capsule(0.016, 0.16 - i * 0.02), antM);
          tine.position.set(s * (0.16 + i * 0.07), sp.head + 0.14 + i * 0.11, 0.02);
          tine.rotation.set(0.5, 0, -s * 0.1);
          head.add(tine);
        }
      }
    }
    // ocas
    const tail = new THREE.Group();
    tail.position.set(0, bodyY + sp.r * 0.3, -sp.len * 0.5 - sp.r * 0.8);
    g.add(tail);
    const tailM = this.fur(sp.tailColor ?? sp.color);
    if (sp.tail === "curly") {
      const c = this.mesh(this.geo("curl", () => new THREE.TorusGeometry(0.05, 0.014, 6, 14, Math.PI * 1.6)), this.plain(sp.color, 0.7));
      c.rotation.y = Math.PI / 2;
      tail.add(c);
    } else if (sp.tail === "bushy") {
      const t = this.mesh(this.capsule(sp.r * 0.38, sp.len * 0.7), this.fur("#9a9ea6"));
      t.rotation.x = -1.1;
      t.position.set(0, -0.05, -sp.len * 0.25);
      tail.add(t);
      const tip = this.mesh(this.sphere(sp.r * 0.3), this.fur("#eeeef0"));
      tip.position.set(0, -0.18, -sp.len * 0.55);
      tail.add(tip);
    } else if (sp.tail === "long") {
      const horse = sp === SPECS.horse;
      const t = this.mesh(this.capsule(horse ? 0.07 : 0.04, horse ? 0.55 : 0.32), tailM);
      t.rotation.x = sp === SPECS.dog ? -0.7 : 0.25;
      t.position.set(0, sp === SPECS.dog ? 0.1 : -0.2, -0.08);
      tail.add(t);
      if (sp === SPECS.cow) {
        const tuft = this.mesh(this.sphere(0.06), this.fur("#5a4434"));
        tuft.position.set(0, -0.4, -0.12);
        tail.add(tuft);
      }
    } else if (sp.tail === "tuft") {
      const t = this.mesh(this.cone(0.05, 0.16), tailM);
      t.rotation.x = -0.9;
      tail.add(t);
    } else {
      tail.add(this.mesh(this.sphere(sp.r * 0.25), tailM));
    }
    return { g, legs, head, tail };
  }

  /** Slepice: kulaté tělo, hřebínek, lalok, oranžový zobák a nožky. */
  private buildChicken(): Built {
    const g = new THREE.Group();
    const feather = this.fur("#f8f4ec");
    const body = this.mesh(this.sphere(0.2), feather);
    body.scale.set(1, 0.95, 1.15);
    body.position.y = 0.3;
    g.add(body);
    for (const s of [-1, 1]) {
      const wing = this.mesh(this.sphere(0.11), feather);
      wing.scale.set(0.45, 0.8, 1.2);
      wing.position.set(s * 0.18, 0.3, -0.02);
      g.add(wing);
    }
    const tailF = this.mesh(this.cone(0.1, 0.2), feather);
    tailF.position.set(0, 0.42, -0.2);
    tailF.rotation.x = -0.6;
    g.add(tailF);
    const head = new THREE.Group();
    head.position.set(0, 0.5, 0.1);
    g.add(head);
    head.add(this.mesh(this.sphere(0.12), feather));
    const comb = this.plain("#d8241a", 0.5);
    for (let i = 0; i < 3; i += 1) {
      const c = this.mesh(this.sphere(0.04), comb);
      c.position.set(0, 0.12 + (i === 1 ? 0.02 : 0), -0.03 + i * 0.04);
      head.add(c);
    }
    const beak = this.mesh(this.cone(0.035, 0.08), this.plain("#f0a020", 0.4));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.0, 0.14);
    head.add(beak);
    const wattle = this.mesh(this.sphere(0.03), comb);
    wattle.scale.set(0.8, 1.4, 0.6);
    wattle.position.set(0, -0.06, 0.11);
    head.add(wattle);
    this.eyes(head, 0.038, 0.06, 0.035, 0.07, "#8a5212");
    const legs: THREE.Object3D[] = [];
    const legM = this.plain("#f0a020", 0.5);
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.07, 0.16, 0);
      const leg = this.mesh(this.capsule(0.018, 0.12), legM);
      leg.position.y = -0.08;
      hip.add(leg);
      const foot = this.mesh(this.cone(0.045, 0.08), legM);
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(1, 1, 0.3);
      foot.position.set(0, -0.15, 0.03);
      hip.add(foot);
      g.add(hip);
      legs.push(hip);
    }
    return { g, legs, head, tail: null };
  }

  /** Veverka: sedí, velký chlupatý ocas. */
  private buildSquirrel(): Built {
    const g = new THREE.Group();
    const furM = this.fur("#d0602a");
    const body = this.mesh(this.sphere(0.1), furM);
    body.scale.set(1, 1.3, 1);
    body.position.y = 0.14;
    g.add(body);
    const belly = this.mesh(this.sphere(0.07), this.fur("#f4e2c8"));
    belly.scale.set(1, 1.3, 0.6);
    belly.position.set(0, 0.13, 0.05);
    g.add(belly);
    const head = new THREE.Group();
    head.position.set(0, 0.3, 0.03);
    g.add(head);
    head.add(this.mesh(this.sphere(0.085), furM));
    this.eyes(head, 0.026, 0.04, 0.02, 0.055, "#3a2010");
    const nose = this.mesh(this.sphere(0.012), this.plain("#2a1a10"));
    nose.position.set(0, -0.01, 0.085);
    head.add(nose);
    for (const s of [-1, 1]) {
      const ear = this.mesh(this.cone(0.025, 0.07), furM);
      ear.position.set(s * 0.045, 0.08, -0.01);
      head.add(ear);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.1, -0.1);
    g.add(tail);
    for (let i = 0; i < 4; i += 1) {
      const p = this.mesh(this.sphere(0.07 + i * 0.012), furM);
      p.position.set(0, 0.05 + i * 0.08, -0.03 - Math.sin(i * 0.9) * 0.06);
      tail.add(p);
    }
    const legs: THREE.Object3D[] = [];
    for (const s of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(s * 0.06, 0.06, 0.04);
      const foot = this.mesh(this.sphere(0.035), furM);
      foot.scale.set(0.8, 0.6, 1.3);
      foot.position.y = -0.03;
      hip.add(foot);
      g.add(hip);
      legs.push(hip);
    }
    return { g, legs, head, tail };
  }

  /** Ptáci: racek, sýkorka, červenka, vrána – kulaté tělíčko, velké oči. */
  private makeBird(kind: "gull" | "tit" | "robin" | "crow", cx: number, cz: number, r: number, h: number, seed: number): Bird {
    const g = new THREE.Group();
    const small = kind === "tit" || kind === "robin";
    const k = small ? 0.5 : 1;
    const bodyColor = kind === "gull" ? "#f6f6f2" : kind === "crow" ? "#1c1a1e" : kind === "tit" ? "#f0d040" : "#e8763a";
    const wingColor = kind === "gull" ? "#a8b0b8" : kind === "crow" ? "#24222a" : kind === "tit" ? "#4a7ac8" : "#8a6a4a";
    const body = this.mesh(this.sphere(0.13 * k), this.plain(bodyColor, 0.7), false);
    body.scale.set(1, 0.95, 1.5);
    g.add(body);
    const headM = this.mesh(this.sphere(0.09 * k), this.plain(kind === "tit" ? "#3a6ac0" : kind === "robin" ? "#f08a4a" : bodyColor, 0.7), false);
    headM.position.set(0, 0.07 * k, 0.17 * k);
    g.add(headM);
    const beak = this.mesh(this.cone(0.025 * k, 0.09 * k), this.plain(kind === "crow" ? "#2a2a2e" : "#f0a020", 0.4), false);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.06 * k, 0.28 * k);
    g.add(beak);
    const eyeHolder = new THREE.Group();
    eyeHolder.position.copy(headM.position);
    g.add(eyeHolder);
    this.eyes(eyeHolder, 0.028 * k, 0.05 * k, 0.02 * k, 0.05 * k, "#3a2410");
    const wings: THREE.Object3D[] = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.08 * k, 0.03 * k, 0);
      const wing = this.mesh(this.sphere(0.15 * k), this.plain(wingColor, 0.7), false);
      wing.scale.set(1.9, 0.12, 0.85);
      wing.position.x = sx * 0.22 * k;
      pivot.add(wing);
      g.add(pivot);
      wings.push(pivot);
    }
    const tail = this.mesh(this.cone(0.06 * k, 0.16 * k), this.plain(wingColor, 0.7), false);
    tail.rotation.x = -Math.PI / 2;
    tail.scale.set(1, 1, 0.3);
    tail.position.set(0, 0, -0.24 * k);
    g.add(tail);
    this.scene.add(g);
    const speed = (small ? 0.9 : 0.25) + seed * 0.2;
    return { g, wings, cx, cz, r, h, a: seed * Math.PI * 2, speed: speed * (seed > 0.5 ? 1 : -1), phase: seed * 10 };
  }

  private okGround(x: number, z: number, kind: Kind) {
    if (Math.abs(x) > WORLD_HALF - 4 || Math.abs(z) > WORLD_HALF - 4) return false;
    if (this.blocked(x, z)) return false;
    const h = heightAt(x, z);
    if (h < 0.5) return false;
    if (kind === "chicken" || kind === "dog") return true;
    if (inCity(x, z)) return false;
    return roadDistance(x, z) > 1.5 || kind === "horse";
  }

  update(dt: number, time: number, player: THREE.Vector2) {
    for (const w of this.walkers) {
      const shy = SHY[w.kind];
      const toPlayer = Math.hypot(player.x - w.pos.x, player.y - w.pos.y);
      // plaché zvíře uteče od hráče
      if (shy > 0 && toPlayer < shy && w.flee <= 0) {
        const away = w.pos.clone().sub(player).normalize().multiplyScalar(shy * 1.6);
        const t = w.pos.clone().add(away);
        if (this.okGround(t.x, t.y, w.kind)) {
          w.target.copy(t);
          w.flee = 2.2;
          w.wait = 0;
        }
      }
      let speed = 0;
      const d = w.target.clone().sub(w.pos);
      if (w.flee > 0) {
        w.flee -= dt;
        speed = w.speed;
      } else if (d.length() < 0.3) {
        w.wait -= dt;
        if (w.wait <= 0) {
          for (let i = 0; i < 4; i += 1) {
            const t = new THREE.Vector2(w.home.x + (Math.random() - 0.5) * w.range * 2, w.home.y + (Math.random() - 0.5) * w.range * 2);
            if (this.okGround(t.x, t.y, w.kind)) {
              w.target.copy(t);
              break;
            }
          }
          w.wait = 2 + Math.random() * 6;
        }
      } else {
        speed = w.speed * (w.kind === "dog" || w.kind === "squirrel" ? 0.7 : 0.35);
      }
      if (speed > 0 && d.length() > 0.2) {
        d.normalize();
        const nx = w.pos.x + d.x * speed * dt, nz = w.pos.y + d.y * speed * dt;
        if (this.okGround(nx, nz, w.kind)) w.pos.set(nx, nz);
        else w.target.copy(w.pos);
        const want = Math.atan2(d.x, d.y);
        let diff = want - w.heading;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        w.heading += diff * Math.min(1, dt * 8);
      }
      // veverka při běhu poskakuje
      const hop = w.kind === "squirrel" && speed > 0 ? Math.abs(Math.sin(w.phase)) * 0.12 : 0;
      w.g.position.set(w.pos.x, heightAt(w.pos.x, w.pos.y) + hop, w.pos.y);
      w.g.rotation.y = w.heading;
      w.phase += dt * (speed > 0 ? 4 + speed * 2.2 : 0);
      const swing = speed > 0 ? Math.min(0.7, 0.25 + speed * 0.08) : 0;
      w.legs.forEach((leg, i) => {
        const side = w.legs.length === 2 ? (i === 0 ? 1 : -1) : i === 0 || i === 3 ? 1 : -1;
        leg.rotation.x = Math.sin(w.phase) * swing * side;
      });
      const grazer = w.kind === "sheep" || w.kind === "goat" || w.kind === "cow" || w.kind === "stag" || w.kind === "doe" || w.kind === "horse";
      const graze = speed === 0 && grazer ? (Math.sin(time * 0.6 + w.home.x) > 0.2 ? 0.6 : 0) : 0;
      w.head.rotation.x += (graze - w.head.rotation.x) * Math.min(1, dt * 3);
      if (w.kind === "chicken" && speed === 0) w.head.rotation.x = Math.max(0, Math.sin(time * 6 + w.home.y)) * 0.8;
      if (w.tail) w.tail.rotation.y = w.kind === "dog" ? Math.sin(time * 12 + w.phase) * 0.5 : Math.sin(time * 2 + w.home.x) * 0.15;
    }
    for (const b of this.birds) {
      b.a += (b.speed * dt) / Math.max(1, b.r * 0.1);
      const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r;
      const y = Math.max(heightAt(x, z), 0) + b.h + Math.sin(time * 0.7 + b.phase) * 1.2;
      b.g.position.set(x, y, z);
      // směr letu = tečna ke kružnici
      b.g.rotation.y = Math.atan2(-Math.sin(b.a) * Math.sign(b.speed), Math.cos(b.a) * Math.sign(b.speed));
      const flap = Math.sin(time * 9 + b.phase) * 0.6;
      b.wings[0].rotation.z = flap;
      b.wings[1].rotation.z = -flap;
    }
  }

  dispose() {
    for (const w of this.walkers) this.scene.remove(w.g);
    for (const b of this.birds) this.scene.remove(b.g);
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.spotTex.forEach((t) => t.dispose());
  }
}
