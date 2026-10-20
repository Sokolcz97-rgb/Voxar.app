import * as THREE from "three";
import { Figure, type FigureOptions } from "./figure";
import type { HeroClass } from "../types";

/**
 * Hráčská postava z 3D modelu podle povolání a pohlaví
 * (štítonoš, lučištník, věštec – muž i žena).
 * Modely nemají kostru, proto se nohy a lem šatů hýbou ve vertex shaderu
 * a útok, zásah, úhyb nebo pád dělá celé tělo. Dokud se model nenačte,
 * je vidět procedurální postava.
 */

export type Gender = "m" | "f";

/** Úsporná grafika: jednoduché modely postav (~7 000 místo až 35 000 trojúhelníků). */
let liteHeroes = false;
export function setLiteHeroes(on: boolean) {
  liteHeroes = on;
}
export const heroModelUrl = (cls: HeroClass, g: Gender) => `/game/models/heroes/${cls}_${g}${liteHeroes ? "_lo" : ""}.glb`;
export const heroPortraitUrl = (cls: HeroClass, g: Gender) => `/game/models/heroes/${cls}_${g}.webp`;
/** výška postavy v metrech (stejně vysoká jako procedurální postavy) */
const HEIGHT: Record<Gender, number> = { m: 1.62, f: 1.55 };
/** do jaké výšky (podíl) sahají nohy / lem šatů */
const LEG = 0.3;

const cache = new Map<string, Promise<THREE.Group | null>>();

function load(cls: HeroClass, g: Gender) {
  const key = `${cls}_${g}${liteHeroes ? "_lo" : ""}`;
  let p = cache.get(key);
  if (!p) {
    p = import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(heroModelUrl(cls, g)))
      .then((gltf) => gltf.scene as THREE.Group)
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

const grown = new WeakSet<THREE.BufferGeometry>();

type Anim = { t: number; dur: number; fn: (k: number) => void; done?: () => void };

export class MeshyFigure {
  readonly group = new THREE.Group();
  readonly opts: FigureOptions;
  dead = false;
  private root = new THREE.Group();
  private body = new THREE.Group();
  private fallback: Figure | null;
  private model: THREE.Object3D | null = null;
  private mats: THREE.MeshStandardMaterial[] = [];
  private u = { uPhase: { value: 0 }, uAmt: { value: 0 } };
  private baseRot = 0;
  private speed = 0;
  private anims: Anim[] = [];
  private breath = Math.random() * 10;

  constructor(opts: FigureOptions, readonly gender: Gender) {
    this.opts = opts;
    this.group.add(this.root);
    this.root.add(this.body);
    this.fallback = new Figure(opts);
    this.group.add(this.fallback.group);
    void load(opts.cls, gender).then((src) => {
      if (src) this.build(src);
    });
  }

  private build(src: THREE.Group) {
    const model = src.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = (HEIGHT[this.gender] * (this.opts.scale ?? 1)) / (size.y || 1);
    model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    model.scale.setScalar(s);
    model.updateMatrixWorld(true);
    // souřadnice modelu v metrech od chodidel (nezávisle na uzlech v GLB)
    const leg = HEIGHT[this.gender] * LEG;
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (!grown.has(mesh.geometry)) {
        grown.add(mesh.geometry);
        if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
        if (mesh.geometry.boundingSphere) mesh.geometry.boundingSphere.radius *= 1.3;
      }
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mesh.material = mat;
      this.mats.push(mat);
      const toModel = mesh.matrixWorld.clone();
      const fromModel = new THREE.Matrix3().setFromMatrix4(toModel.clone().invert());
      const u = this.u;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uPhase = u.uPhase;
        shader.uniforms.uAmt = u.uAmt;
        shader.uniforms.uToModel = { value: toModel };
        shader.uniforms.uFromModel = { value: fromModel };
        shader.uniforms.uLeg = { value: leg };
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uPhase, uAmt, uLeg;\nuniform mat4 uToModel;\nuniform mat3 uFromModel;")
          .replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            {
              vec3 mp = (uToModel * vec4(transformed, 1.0)).xyz;
              if (mp.y < uLeg) {
                // levá a pravá noha (lem šatů) se střídají, uprostřed plynulý přechod
                float k = (uLeg - mp.y) / uLeg;
                float side = smoothstep(-0.07, 0.07, mp.x) * 2.0 - 1.0;
                vec3 dm = vec3(0.0);
                dm.z = sin(uPhase) * side * 0.2 * k * uAmt;
                dm.y = max(0.0, cos(uPhase) * side) * 0.07 * k * uAmt;
                transformed += uFromModel * dm;
              }
            }`,
          );
      };
      mat.customProgramCacheKey = () => "ashes-hero-walk";
    });
    this.body.add(model);
    this.model = model;
    if (this.fallback) {
      this.group.remove(this.fallback.group);
      this.fallback.dispose();
      this.fallback = null;
    }
    this.root.rotation.y = this.baseRot;
    if (this.dead) this.root.rotation.x = -1.45;
  }

  private push(dur: number, fn: (k: number) => void, done?: () => void) {
    this.anims.push({ t: 0, dur, fn, done });
  }

  private fwd() {
    return new THREE.Vector3(Math.sin(this.baseRot), 0, Math.cos(this.baseRot));
  }

  face(angle: number) {
    this.baseRot = angle;
    this.root.rotation.y = angle;
    this.fallback?.face(angle);
  }

  setMoving(speed: number) {
    this.speed = speed;
    this.fallback?.setMoving(speed);
  }

  attack(kind: "melee" | "ranged" | "magic" = "melee") {
    if (this.fallback) return this.fallback.attack(kind);
    const d = this.fwd();
    if (kind === "melee") {
      this.push(0.42, (k) => {
        const l = Math.sin(k * Math.PI);
        this.root.position.set(d.x * l * 0.55, 0, d.z * l * 0.55);
        this.body.rotation.x = l * 0.22;
      });
    } else {
      this.push(0.5, (k) => {
        const l = Math.sin(k * Math.PI);
        this.body.rotation.x = -l * 0.12;
        this.body.position.y = l * 0.06;
      });
    }
  }

  hit(crit = false) {
    if (this.fallback) return this.fallback.hit(crit);
    const mats = this.mats;
    this.push(0.32, (k) => {
      const s = Math.sin(k * Math.PI);
      this.body.rotation.x = -s * (crit ? 0.3 : 0.16);
      mats.forEach((m) => m.emissive.setRGB(s * (crit ? 0.9 : 0.5), s * 0.08, 0));
    }, () => mats.forEach((m) => m.emissive.setRGB(0, 0, 0)));
  }

  evade() {
    if (this.fallback) return this.fallback.evade();
    const d = this.fwd();
    this.push(0.36, (k) => {
      const s = Math.sin(k * Math.PI);
      this.root.position.set(d.z * s * 0.45, 0, -d.x * s * 0.45);
      this.body.rotation.z = -s * 0.25;
    });
  }

  block() {
    if (this.fallback) return this.fallback.block();
    this.push(0.34, (k) => {
      const s = Math.sin(k * Math.PI);
      this.body.rotation.x = -s * 0.1;
      this.body.position.y = -s * 0.05;
    });
  }

  die() {
    this.dead = true;
    if (this.fallback) return this.fallback.die();
    this.push(0.9, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      this.body.rotation.x = -e * 1.45;
      this.body.position.y = -e * 0.05;
    });
  }

  cheer() {
    if (this.fallback) return this.fallback.cheer();
    this.push(0.8, (k) => {
      const s = Math.sin(k * Math.PI);
      this.body.position.y = s * 0.25;
    });
  }

  reset() {
    this.dead = false;
    this.anims = [];
    this.fallback?.reset();
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, this.baseRot, 0);
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.mats.forEach((m) => m.emissive.setRGB(0, 0, 0));
  }

  update(dt: number, time: number) {
    if (this.fallback) {
      this.fallback.update(dt, time);
      return;
    }
    // chůze: nohy v shaderu, tělo se lehce pohupuje a naklání
    const moving = !this.dead && this.speed > 0.05;
    const target = moving ? Math.min(1, 0.45 + this.speed * 0.12) : 0;
    this.u.uAmt.value += (target - this.u.uAmt.value) * Math.min(1, dt * 8);
    if (moving) this.u.uPhase.value += dt * (4 + this.speed * 1.6);
    this.breath += dt;
    if (this.anims.length) {
      for (const a of this.anims) {
        a.t += dt;
        a.fn(Math.min(1, a.t / a.dur));
      }
      const done = this.anims.filter((a) => a.t >= a.dur);
      this.anims = this.anims.filter((a) => a.t < a.dur);
      done.forEach((a) => a.done?.());
    } else if (!this.dead) {
      const amt = this.u.uAmt.value;
      this.body.position.y = Math.abs(Math.sin(this.u.uPhase.value)) * 0.045 * amt + Math.sin(this.breath * 1.8) * 0.006;
      this.body.rotation.x = 0.08 * amt;
      this.body.rotation.z = Math.sin(this.u.uPhase.value) * 0.035 * amt;
    }
  }

  dispose() {
    this.fallback?.dispose();
    this.mats.forEach((m) => m.dispose());
  }
}
