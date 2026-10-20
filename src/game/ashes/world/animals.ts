import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { furTex } from "../three/textures";
import { CAMP, CITY, COVE, WORLD_HALF, heightAt, inCity, roadDistance } from "./map";

/**
 * Zvířata – oživení krajiny (jen kosmetika, s nimi se nebojuje).
 * Ovce a kozy se pasou, jeleni a psi pobíhají, slepice běhají po Kalidře,
 * koně stojí u tábora Legie, nad pobřežím krouží racci a nad kopci vrány.
 * Zvířata se plaší: když k nim hráč přijde blízko, utečou.
 */

type Kind = "sheep" | "goat" | "deer" | "dog" | "chicken" | "horse" | "boar";

type Walker = {
  kind: Kind;
  g: THREE.Group;
  legs: THREE.Object3D[];
  head: THREE.Object3D;
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

const SPECS: Record<Kind, { body: [number, number, number]; legH: number; color: string; head: string; speed: number; shy: number }> = {
  sheep: { body: [0.55, 0.45, 0.9], legH: 0.35, color: "#e9e2d2", head: "#2b2622", speed: 2.6, shy: 6 },
  goat: { body: [0.4, 0.4, 0.8], legH: 0.4, color: "#8a7a64", head: "#6a5a46", speed: 3.2, shy: 7 },
  deer: { body: [0.45, 0.5, 1.15], legH: 0.75, color: "#9a6a3a", head: "#8a5a2e", speed: 6.5, shy: 12 },
  dog: { body: [0.3, 0.32, 0.75], legH: 0.32, color: "#5a4632", head: "#4a3826", speed: 5, shy: 0 },
  chicken: { body: [0.22, 0.24, 0.3], legH: 0.14, color: "#f0e6d4", head: "#c0281a", speed: 2.4, shy: 3.5 },
  horse: { body: [0.55, 0.65, 1.6], legH: 0.95, color: "#4a3022", head: "#3a2418", speed: 4, shy: 0 },
  boar: { body: [0.45, 0.5, 0.95], legH: 0.3, color: "#3a2e26", head: "#2a2019", speed: 4.5, shy: 8 },
};

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Wildlife {
  private walkers: Walker[] = [];
  private birds: Bird[] = [];
  private mats = new Map<string, THREE.MeshStandardMaterial>();
  private geos: THREE.BufferGeometry[] = [];

  constructor(private scene: THREE.Scene, density = 1, private blocked: (x: number, z: number) => boolean = () => false) {
    const r = rng(4242);
    const n = (x: number) => Math.max(1, Math.round(x * density));
    // stáda: [druh, střed x, z, poloměr, počet]
    const herds: [Kind, number, number, number, number][] = [
      ["sheep", -30, 44, 10, n(7)],
      ["sheep", 10, 40, 9, n(6)],
      ["sheep", 26, 18, 8, n(5)],
      ["goat", -14, -48, 10, n(5)],
      ["goat", 22, -56, 9, n(4)],
      ["deer", -40, 6, 14, n(4)],
      ["deer", -10, -26, 12, n(3)],
      ["boar", -54, 10, 10, n(3)],
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
    // ptáci: racci nad pobřežím, vrány nad kopci
    for (let i = 0; i < n(7); i += 1) this.birds.push(this.makeBird("#f2f2ee", -70 + r() * 30, -30 + r() * 110, 10 + r() * 14, 14 + r() * 8, r()));
    for (let i = 0; i < n(4); i += 1) this.birds.push(this.makeBird("#f2f2ee", CITY.x1 + 6, CITY.z0 + r() * 50, 8 + r() * 8, 16 + r() * 6, r()));
    for (let i = 0; i < n(5); i += 1) this.birds.push(this.makeBird("#1c1a1a", -20 + r() * 50, -70 + r() * 20, 8 + r() * 10, 18 + r() * 8, r()));
  }

  private mat(color: string) {
    let m = this.mats.get(color);
    if (!m) {
      const fur = furTex(color);
      m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.95, map: fur.map, bumpMap: fur.bump, bumpScale: 1.2 });
      this.mats.set(color, m);
    }
    return m;
  }

  private box(w: number, h: number, d: number, color: string) {
    // zaoblené hrany – zvířata nepůsobí jako krabice
    const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.35);
    this.geos.push(geo);
    const m = new THREE.Mesh(geo, this.mat(color));
    m.castShadow = true;
    return m;
  }

  private makeWalker(kind: Kind, pos: THREE.Vector2, home: THREE.Vector2, range: number, seed: number): Walker {
    const spec = SPECS[kind];
    const [bw, bh, bd] = spec.body;
    const g = new THREE.Group();
    const body = this.box(bw, bh, bd, spec.color);
    body.position.y = spec.legH + bh / 2;
    g.add(body);
    // hlava na krku
    const head = new THREE.Group();
    const hs = kind === "chicken" ? 0.14 : kind === "horse" ? 0.32 : bw * 0.6;
    const skull = this.box(hs, hs, hs * (kind === "horse" || kind === "deer" ? 1.9 : 1.3), spec.head);
    skull.position.z = hs * 0.5;
    head.add(skull);
    if (kind === "goat" || kind === "deer") {
      for (const sx of [-1, 1]) {
        const horn = this.box(0.04, kind === "deer" ? 0.5 : 0.22, 0.04, kind === "deer" ? "#d8c8a8" : "#3a3028");
        horn.position.set(sx * hs * 0.3, hs * 0.5 + (kind === "deer" ? 0.25 : 0.1), 0);
        horn.rotation.z = sx * 0.3;
        head.add(horn);
      }
    }
    if (kind === "chicken") {
      const comb = this.box(0.04, 0.08, 0.1, "#c0281a");
      comb.position.set(0, hs * 0.6, 0.02);
      head.add(comb);
      const beak = this.box(0.05, 0.04, 0.08, "#e0a030");
      beak.position.set(0, 0, hs + 0.04);
      head.add(beak);
    }
    if (kind === "boar") {
      for (const sx of [-1, 1]) {
        const tusk = this.box(0.03, 0.1, 0.03, "#eae0c8");
        tusk.position.set(sx * 0.1, -0.05, hs * 1.2);
        head.add(tusk);
      }
    }
    head.position.set(0, spec.legH + bh * (kind === "horse" || kind === "deer" ? 1.25 : 0.95), bd / 2 + hs * 0.2);
    g.add(head);
    if (kind === "horse") {
      const neck = this.box(0.25, 0.6, 0.3, spec.color);
      neck.position.set(0, spec.legH + bh + 0.1, bd / 2 - 0.1);
      neck.rotation.x = -0.5;
      g.add(neck);
      const mane = this.box(0.08, 0.5, 0.35, "#1a120c");
      mane.position.set(0, spec.legH + bh + 0.25, bd / 2 - 0.25);
      mane.rotation.x = -0.5;
      g.add(mane);
    }
    // ocas
    const tail = this.box(kind === "horse" ? 0.12 : 0.07, kind === "horse" ? 0.6 : 0.15, 0.07, kind === "horse" ? "#1a120c" : spec.color);
    tail.position.set(0, spec.legH + bh * 0.7, -bd / 2 - 0.03);
    tail.rotation.x = 0.4;
    g.add(tail);
    // nohy (2 u slepice, 4 u ostatních), otočné v kyčli
    const legs: THREE.Object3D[] = [];
    const legW = kind === "chicken" ? 0.03 : kind === "horse" ? 0.12 : 0.08;
    const legPos: [number, number][] = kind === "chicken" ? [[-0.06, 0], [0.06, 0]] : [[-bw * 0.32, bd * 0.36], [bw * 0.32, bd * 0.36], [-bw * 0.32, -bd * 0.36], [bw * 0.32, -bd * 0.36]];
    for (const [x, z] of legPos) {
      const hip = new THREE.Group();
      hip.position.set(x, spec.legH, z);
      const leg = this.box(legW, spec.legH, legW, kind === "chicken" ? "#e0a030" : kind === "sheep" ? "#2b2622" : spec.head);
      leg.position.y = -spec.legH / 2;
      hip.add(leg);
      g.add(hip);
      legs.push(hip);
    }
    const s = 0.85 + seed * 0.3;
    g.scale.setScalar(s);
    g.position.set(pos.x, heightAt(pos.x, pos.y), pos.y);
    this.scene.add(g);
    return { kind, g, legs, head, pos: pos.clone(), home, target: pos.clone(), range, speed: spec.speed, wait: seed * 4, phase: seed * 10, heading: seed * 6.28, flee: 0 };
  }

  private makeBird(color: string, cx: number, cz: number, r: number, h: number, seed: number): Bird {
    const g = new THREE.Group();
    const body = this.box(0.12, 0.1, 0.4, color);
    g.add(body);
    const wings: THREE.Object3D[] = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      const wing = this.box(0.55, 0.02, 0.2, color);
      wing.position.x = sx * 0.3;
      pivot.add(wing);
      g.add(pivot);
      wings.push(pivot);
    }
    g.traverse((o) => {
      o.castShadow = false;
    });
    this.scene.add(g);
    return { g, wings, cx, cz, r, h, a: seed * Math.PI * 2, speed: (0.25 + seed * 0.2) * (seed > 0.5 ? 1 : -1), phase: seed * 10 };
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
      const spec = SPECS[w.kind];
      const toPlayer = Math.hypot(player.x - w.pos.x, player.y - w.pos.y);
      // plaché zvíře uteče od hráče
      if (spec.shy > 0 && toPlayer < spec.shy && w.flee <= 0) {
        const away = w.pos.clone().sub(player).normalize().multiplyScalar(spec.shy * 1.6);
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
        speed = spec.speed;
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
        speed = spec.speed * (w.kind === "dog" ? 0.7 : 0.35);
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
      w.g.position.set(w.pos.x, heightAt(w.pos.x, w.pos.y), w.pos.y);
      w.g.rotation.y = w.heading;
      // chůze: kmitání nohou; při stání se hlava sklání k trávě
      w.phase += dt * (speed > 0 ? 4 + speed * 2.2 : 0);
      const swing = speed > 0 ? Math.min(0.7, 0.25 + speed * 0.08) : 0;
      w.legs.forEach((leg, i) => {
        const side = w.kind === "chicken" ? (i === 0 ? 1 : -1) : i === 0 || i === 3 ? 1 : -1;
        leg.rotation.x = Math.sin(w.phase) * swing * side;
      });
      const graze = speed === 0 && w.kind !== "dog" && w.kind !== "horse" ? (Math.sin(time * 0.6 + w.home.x) > 0.2 ? 0.7 : 0) : 0;
      w.head.rotation.x += (graze - w.head.rotation.x) * Math.min(1, dt * 3);
      if (w.kind === "chicken" && speed === 0) w.head.rotation.x = Math.max(0, Math.sin(time * 6 + w.home.y)) * 0.8;
    }
    for (const b of this.birds) {
      b.a += b.speed * dt;
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
  }
}
