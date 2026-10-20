import * as THREE from "three";

/**
 * 3D zvířata z GLB modelů (`public/game/models/animals`).
 * Modely bez kostry se rozpohybují ve vertex shaderu: nohy se kývají v diagonálním
 * kroku (čtyřnožci), střídavě (ptáci), hmyz mává křídly. Modely s animacemi
 * (vlk, ryba, had) používají své klipy.
 */

export type GlbKind =
  | "cow" | "sheep" | "goat" | "horse" | "dog" | "chicken" | "wolf" | "bear" | "fox" | "badger" | "wildcat"
  | "duck" | "turtle" | "crow" | "vulture" | "fish" | "dolphin" | "seal" | "crab" | "butterfly" | "bee"
  | "dragonfly" | "snake" | "salamander" | "frog" | "cat";

type Motion = "quad" | "biped" | "flutter" | "static" | "clip" | "hop";

type Cfg = {
  /** cílová velikost v metrech: výška (h) nebo délka (l) */
  size: number;
  axis: "h" | "l";
  /** natočení, aby model mířil po +Z */
  rotY: number;
  motion: Motion;
  /** výška nohou jako podíl výšky modelu */
  leg?: number;
  clips?: { idle?: string; walk?: string; run?: string; swim?: string };
};

const P = Math.PI;
export const GLB_ANIMALS: Record<GlbKind, Cfg> = {
  cow: { size: 1.45, axis: "h", rotY: 0, motion: "quad", leg: 0.42 },
  sheep: { size: 0.95, axis: "h", rotY: 0, motion: "quad", leg: 0.38 },
  goat: { size: 1.05, axis: "h", rotY: 0, motion: "quad", leg: 0.45 },
  horse: { size: 1.75, axis: "h", rotY: 0, motion: "quad", leg: 0.5 },
  dog: { size: 0.65, axis: "h", rotY: 0, motion: "quad", leg: 0.45 },
  chicken: { size: 0.45, axis: "h", rotY: P / 2, motion: "biped", leg: 0.25 },
  wolf: { size: 0.85, axis: "h", rotY: 0, motion: "clip", clips: { idle: "Idle", walk: "Walk", run: "Gallop" } },
  bear: { size: 1.2, axis: "h", rotY: 0, motion: "quad", leg: 0.4 },
  fox: { size: 0.5, axis: "h", rotY: 0, motion: "quad", leg: 0.45 },
  badger: { size: 0.32, axis: "h", rotY: 0, motion: "quad", leg: 0.35 },
  wildcat: { size: 0.42, axis: "h", rotY: 0, motion: "quad", leg: 0.5 },
  duck: { size: 0.55, axis: "h", rotY: 0, motion: "biped", leg: 0.3 },
  turtle: { size: 0.45, axis: "l", rotY: 0, motion: "quad", leg: 0.35 },
  crow: { size: 0.55, axis: "l", rotY: -P / 2, motion: "static" },
  vulture: { size: 0.75, axis: "h", rotY: 0, motion: "static" },
  fish: { size: 0.45, axis: "l", rotY: 0, motion: "clip", clips: { swim: "Armature|Swim" } },
  dolphin: { size: 2.2, axis: "l", rotY: 0, motion: "static" },
  seal: { size: 1.3, axis: "l", rotY: -P / 2, motion: "static" },
  crab: { size: 0.3, axis: "l", rotY: 0, motion: "quad", leg: 0.6 },
  butterfly: { size: 0.16, axis: "l", rotY: P, motion: "flutter" },
  bee: { size: 0.07, axis: "l", rotY: P, motion: "flutter" },
  dragonfly: { size: 0.16, axis: "l", rotY: 0, motion: "flutter" },
  snake: { size: 1.1, axis: "l", rotY: 0, motion: "clip", clips: { idle: "SnakeArmature|Snake_Idle", walk: "SnakeArmature|Snake_Walk" } },
  salamander: { size: 0.22, axis: "l", rotY: 0, motion: "quad", leg: 0.6 },
  frog: { size: 0.16, axis: "h", rotY: -P / 2, motion: "hop" },
  cat: { size: 0.32, axis: "h", rotY: 0, motion: "quad", leg: 0.5 },
};

export const hasGlb = (k: string): k is GlbKind => k in GLB_ANIMALS;

type Source = { scene: THREE.Group; animations: THREE.AnimationClip[] };
const cache = new Map<GlbKind, Promise<Source | null>>();
let loaderPromise: Promise<{ load: (url: string) => Promise<Source> }> | null = null;

function loadModel(kind: GlbKind) {
  let p = cache.get(kind);
  if (!p) {
    if (!loaderPromise) {
      loaderPromise = import("three/examples/jsm/loaders/GLTFLoader.js").then(({ GLTFLoader }) => {
        const l = new GLTFLoader();
        return { load: (url: string) => l.loadAsync(url).then((g) => ({ scene: g.scene as THREE.Group, animations: g.animations })) };
      });
    }
    p = loaderPromise.then((l) => l.load(`/game/models/animals/${kind}.glb`)).catch(() => null);
    cache.set(kind, p);
  }
  return p;
}

let cloneFn: ((o: THREE.Object3D) => THREE.Object3D) | null = null;
const clonePromise = import("three/examples/jsm/utils/SkeletonUtils.js").then((m) => {
  cloneFn = m.clone;
});

/** Uniformy pohybu jednoho zvířete (sdílené všemi jeho materiály). */
type MoveUniforms = {
  uPhase: { value: number };
  uAmt: { value: number };
};

const MODE: Record<Motion, number> = { quad: 0, biped: 1, flutter: 2, hop: 3, static: 3, clip: 3 };

function patchMaterial(mat: THREE.Material, u: MoveUniforms, mesh: { toModel: THREE.Matrix4; fromModel: THREE.Matrix3 }, mode: number, leg: number, zc: number, amp: number, body: number) {
  const m = mat as THREE.MeshStandardMaterial;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPhase = u.uPhase;
    shader.uniforms.uAmt = u.uAmt;
    shader.uniforms.uToModel = { value: mesh.toModel };
    shader.uniforms.uFromModel = { value: mesh.fromModel };
    shader.uniforms.uLeg = { value: leg };
    shader.uniforms.uZc = { value: zc };
    shader.uniforms.uAmp = { value: amp };
    shader.uniforms.uBody = { value: body };
    shader.uniforms.uMode = { value: mode };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uPhase, uAmt, uLeg, uZc, uAmp, uBody, uMode;\nuniform mat4 uToModel;\nuniform mat3 uFromModel;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec3 mp = (uToModel * vec4(transformed, 1.0)).xyz;
          vec3 dm = vec3(0.0);
          if (uMode < 1.5) {
            if (mp.y < uLeg) {
              float k = (uLeg - mp.y) / uLeg;
              // čtyřnožci: diagonální páry nohou; ptáci: levá a pravá noha
              float off = uMode < 0.5 ? (((mp.z - uZc) * mp.x) > 0.0 ? 0.0 : 3.14159) : (mp.x > 0.0 ? 0.0 : 3.14159);
              dm.z = sin(uPhase + off) * uAmp * k * uAmt;
              dm.y = max(0.0, cos(uPhase + off)) * uAmp * 0.35 * k * uAmt;
            }
          } else if (uMode < 2.5) {
            // hmyz: křídla mávají kolem osy těla
            float side = abs(mp.x) - uBody;
            if (side > 0.0) dm.y = sin(uPhase) * side * 1.1;
          }
          transformed += uFromModel * dm;
        }`,
      );
  };
  m.customProgramCacheKey = () => `ashes-glb-anim-${mode}`;
}

export class GlbAnimal {
  readonly group = new THREE.Group();
  readonly cfg: Cfg;
  ready = false;
  private u: MoveUniforms = { uPhase: { value: Math.random() * 10 }, uAmt: { value: 0 } };
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Record<string, THREE.AnimationAction> = {};
  private current = "";
  private materials: THREE.Material[] = [];
  private bob = 0;
  height = 1;

  constructor(readonly kind: GlbKind, scale = 1) {
    this.cfg = GLB_ANIMALS[kind];
    void Promise.all([loadModel(kind), clonePromise]).then(([src]) => {
      if (!src || !cloneFn) return;
      this.build(src, scale);
    });
  }

  private build(src: Source, scale: number) {
    const cfg = this.cfg;
    const model = cloneFn!(src.scene);
    const inner = new THREE.Group();
    inner.add(model);
    inner.rotation.y = cfg.rotY;
    const fit = new THREE.Group();
    fit.add(inner);
    fit.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(fit);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    inner.position.set(-center.x, -box.min.y, -center.z);
    fit.updateMatrixWorld(true);
    const ref = cfg.axis === "h" ? size.y : Math.max(size.x, size.z);
    const s = (cfg.size * scale) / (ref || 1);
    this.height = size.y * s;
    const animated = cfg.motion === "clip" && src.animations.length > 0;
    const mode = MODE[cfg.motion];
    const leg = (cfg.leg ?? 0.4) * size.y;
    const amp = size.y * (cfg.motion === "biped" ? 0.18 : 0.14);
    const body = Math.min(size.x, size.z) * 0.12;
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const cloned = mats.map((mm) => mm.clone());
      mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
      this.materials.push(...cloned);
      if (!animated && mode < 3) {
        const toModel = mesh.matrixWorld.clone();
        const fromModel = new THREE.Matrix3().setFromMatrix4(toModel.clone().invert());
        for (const mm of cloned) patchMaterial(mm, this.u, { toModel, fromModel }, mode, leg, 0, amp, body);
      }
    });
    fit.scale.setScalar(s);
    this.group.add(fit);
    if (animated) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const [key, name] of Object.entries(cfg.clips ?? {})) {
        const clip = src.animations.find((a) => a.name === name);
        if (clip) this.actions[key] = this.mixer.clipAction(clip);
      }
      const first = this.actions.swim ? "swim" : "idle";
      this.actions[first]?.play();
      this.current = first;
      this.mixer.update(Math.random() * 2);
    }
    this.ready = true;
  }

  /** speed = rychlost (m/s), fast = od jaké rychlosti běh. */
  update(dt: number, speed: number, fast = 3) {
    if (!this.ready) return;
    const moving = speed > 0.05;
    if (this.mixer) {
      const want = this.actions.swim ? "swim" : !moving ? "idle" : speed > fast && this.actions.run ? "run" : "walk";
      if (want !== this.current && this.actions[want]) {
        this.actions[this.current]?.fadeOut(0.25);
        this.actions[want].reset().fadeIn(0.25).play();
        this.current = want;
      }
      this.mixer.update(dt);
      return;
    }
    const m = this.cfg.motion;
    if (m === "flutter") {
      this.u.uPhase.value += dt * (this.kind === "butterfly" ? 9 : 40);
      this.u.uAmt.value = 1;
      return;
    }
    const target = moving ? Math.min(1, 0.5 + speed * 0.15) : 0;
    this.u.uAmt.value += (target - this.u.uAmt.value) * Math.min(1, dt * 6);
    this.u.uPhase.value += dt * (moving ? 5 + speed * 2.2 : 0);
    // lehké pohupování těla při chůzi, žába poskakuje
    if (m === "hop") {
      this.bob = moving ? (this.bob + dt * 6) % P : 0;
      this.group.children[0].position.y = Math.sin(this.bob) * 0.25;
    } else if (this.group.children[0]) {
      this.group.children[0].position.y = Math.abs(Math.sin(this.u.uPhase.value)) * 0.025 * this.u.uAmt.value * this.height;
    }
  }

  dispose() {
    this.mixer?.stopAllAction();
    this.materials.forEach((m) => m.dispose());
  }
}
