import * as THREE from "three";
import { Figure, type FigureOptions } from "../three/figure";

/**
 * Grafika připravená na vylepšení.
 *
 * 1) Kvalita (nízká / střední / vysoká): rozlišení, stíny, hustota vegetace, záře.
 * 2) Registr modelů: hra kreslí vše procedurálně, ale pokud v `public/game/models/manifest.json`
 *    existuje záznam pro daný slot, načte se místo toho glTF/GLB model (např. z Blenderu).
 *    Postavy z glTF dostanou stejné rozhraní jako procedurální `Figure` (chůze, útok, zásah, smrt).
 *
 * Příklad manifestu:
 * {
 *   "figure.hoplit": { "url": "/game/models/hoplit.glb", "scale": 1, "clips": { "idle": "Idle", "walk": "Walk", "attack": "Attack", "hit": "Hit", "death": "Death" } },
 *   "building.house": { "url": "/game/models/house.glb", "scale": 1.2 }
 * }
 */

export type Quality = "low" | "medium" | "high";

export type QualitySettings = {
  pixelRatio: number;
  shadows: boolean;
  shadowSize: number;
  treeDensity: number;
  grass: number;
  bloom: boolean;
  viewDistance: number;
};

const QUALITY_KEY = "ashes.quality";

export const QUALITY: Record<Quality, QualitySettings> = {
  low: { pixelRatio: 1, shadows: false, shadowSize: 512, treeDensity: 0.45, grass: 0, bloom: false, viewDistance: 110 },
  medium: { pixelRatio: 1.25, shadows: true, shadowSize: 1024, treeDensity: 0.75, grass: 1800, bloom: false, viewDistance: 150 },
  high: { pixelRatio: 1.75, shadows: true, shadowSize: 2048, treeDensity: 1, grass: 4000, bloom: true, viewDistance: 190 },
};

export function getQuality(): Quality {
  try {
    const q = localStorage.getItem(QUALITY_KEY);
    if (q === "low" || q === "medium" || q === "high") return q;
  } catch {
    /* bez úložiště */
  }
  // výchozí podle zařízení: mobil střední, desktop vysoká
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches ? "medium" : "high";
}

export function setQuality(q: Quality) {
  try {
    localStorage.setItem(QUALITY_KEY, q);
  } catch {
    /* bez úložiště */
  }
}

// ---------------------------------------------------------------- registr modelů
export type ModelSlot =
  | "figure.hoplit" | "figure.lucistnik" | "figure.vestec" | "figure.eryon" | "figure.azkar"
  | "figure.legie.hoplit" | "figure.legie.lucistnik" | "figure.legie.vestec"
  | "building.house" | "building.tavern" | "building.smithy" | "building.temple" | "building.tent" | "building.hut"
  | `animal.${"sheep" | "goat" | "stag" | "doe" | "dog" | "chicken" | "horse" | "boar" | "cow" | "pig" | "wolf" | "bear" | "squirrel" | "gull" | "tit" | "robin" | "crow"}`;

export type ModelEntry = { url: string; scale?: number; rotationY?: number; clips?: Partial<Record<"idle" | "walk" | "run" | "attack" | "hit" | "death" | "block" | "eat" | "fly", string>> };

type LoadedModel = { scene: THREE.Group; animations: THREE.AnimationClip[]; entry: ModelEntry };

class AssetRegistry {
  private manifest: Partial<Record<ModelSlot, ModelEntry>> = {};
  private cache = new Map<string, Promise<LoadedModel | null>>();
  ready: Promise<void>;

  constructor() {
    this.ready = fetch("/game/models/manifest.json", { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((m) => {
        this.manifest = m && typeof m === "object" ? m : {};
      })
      .catch(() => {
        this.manifest = {};
      });
  }

  has(slot: ModelSlot) {
    return !!this.manifest[slot];
  }

  /** Načte glTF pro slot (jednou, pak z mezipaměti). Když model není, vrací null. */
  async load(slot: ModelSlot): Promise<LoadedModel | null> {
    await this.ready;
    const entry = this.manifest[slot];
    if (!entry) return null;
    if (!this.cache.has(entry.url)) {
      this.cache.set(
        entry.url,
        import("three/examples/jsm/loaders/GLTFLoader.js")
          .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(entry.url))
          .then((gltf) => ({ scene: gltf.scene as THREE.Group, animations: gltf.animations, entry }))
          .catch(() => null),
      );
    }
    return this.cache.get(entry.url)!;
  }

  /**
   * Vloží model slotu do `parent`: hned procedurální náhradu, a když existuje glTF,
   * po načtení ji vymění. Vrací skupinu, do které se kreslí.
   */
  place(slot: ModelSlot, parent: THREE.Object3D, fallback: () => THREE.Object3D) {
    const holder = new THREE.Group();
    const proc = fallback();
    holder.add(proc);
    parent.add(holder);
    if (this.has(slot) || !this.manifestLoaded) {
      void this.load(slot).then(async (m) => {
        if (!m) return;
        const { clone } = await import("three/examples/jsm/utils/SkeletonUtils.js");
        const model = clone(m.scene);
        model.scale.setScalar(m.entry.scale ?? 1);
        model.rotation.y = m.entry.rotationY ?? 0;
        model.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });
        holder.remove(proc);
        holder.add(model);
      });
    }
    return holder;
  }

  private get manifestLoaded() {
    return Object.keys(this.manifest).length > 0;
  }
}

export const assets = new AssetRegistry();

// ---------------------------------------------------------------- postavy
/** Společné rozhraní postavy – procedurální i z glTF. */
export type HeroFigure = {
  readonly group: THREE.Group;
  readonly opts: FigureOptions;
  dead: boolean;
  face(angle: number): void;
  setMoving(speed: number): void;
  attack(kind?: "melee" | "ranged" | "magic"): void;
  hit(crit?: boolean): void;
  evade(): void;
  block(): void;
  die(): void;
  cheer(): void;
  reset(): void;
  update(dt: number, time: number): void;
  dispose(): void;
};

function slotFor(opts: FigureOptions): ModelSlot {
  if (opts.eryon) return "figure.eryon";
  if (opts.azkar) return "figure.azkar";
  // voják Legie může mít vlastní model; když není, použije se model povolání
  if ((opts.legion || opts.enemy) && assets.has(`figure.legie.${opts.cls}` as ModelSlot)) return `figure.legie.${opts.cls}` as ModelSlot;
  return `figure.${opts.cls}` as ModelSlot;
}

/**
 * Model zvířete z manifestu (glTF) s animacemi. Vrací skupinu, do které se model
 * vloží po načtení, a funkci pro přepínání idle/walk/run podle rychlosti.
 */
export function attachAnimalModel(slot: ModelSlot, holder: THREE.Group, replace: THREE.Object3D) {
  const state: { mixer: THREE.AnimationMixer | null; actions: Record<string, THREE.AnimationAction>; current: string; ready: boolean } = { mixer: null, actions: {}, current: "", ready: false };
  void assets.load(slot).then(async (m) => {
    if (!m) return;
    const { clone } = await import("three/examples/jsm/utils/SkeletonUtils.js");
    const model = clone(m.scene);
    model.scale.setScalar(m.entry.scale ?? 1);
    model.rotation.y = m.entry.rotationY ?? 0;
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    state.mixer = new THREE.AnimationMixer(model);
    for (const [key, name] of Object.entries(m.entry.clips ?? {})) {
      const clip = m.animations.find((a) => a.name === name);
      if (clip) state.actions[key] = state.mixer.clipAction(clip);
    }
    holder.remove(replace);
    holder.add(model);
    state.ready = true;
  });
  return {
    get ready() {
      return state.ready;
    },
    update(dt: number, speed: number, fast: number, force?: string) {
      if (!state.mixer) return;
      const want = force && state.actions[force] ? force : speed <= 0.05 ? "idle" : speed > fast && state.actions.run ? "run" : "walk";
      const key = state.actions[want] ? want : state.actions.walk ? "walk" : "idle";
      if (key !== state.current && state.actions[key]) {
        state.actions[state.current]?.fadeOut(0.2);
        state.actions[key].reset().fadeIn(0.2).play();
        state.current = key;
      }
      state.mixer.update(dt);
    },
  };
}

/**
 * Postava z glTF modelu s animacemi (AnimationMixer). Názvy klipů určuje manifest.
 * Dokud se model nenačte, zobrazuje se procedurální postava.
 */
class GltfFigure implements HeroFigure {
  readonly group = new THREE.Group();
  readonly opts: FigureOptions;
  dead = false;
  private fallback: Figure;
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Partial<Record<string, THREE.AnimationAction>> = {};
  private current: THREE.AnimationAction | null = null;
  private speed = 0;
  private baseRot = 0;

  constructor(opts: FigureOptions, slot: ModelSlot) {
    this.opts = opts;
    this.fallback = new Figure(opts);
    this.group.add(this.fallback.group);
    void assets.load(slot).then(async (m) => {
      if (!m) return;
      const { clone } = await import("three/examples/jsm/utils/SkeletonUtils.js");
      const model = clone(m.scene);
      model.scale.setScalar(m.entry.scale ?? 1);
      model.rotation.y = this.baseRot + (m.entry.rotationY ?? 0);
      model.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      this.mixer = new THREE.AnimationMixer(model);
      const clips = m.entry.clips ?? {};
      for (const [key, name] of Object.entries(clips)) {
        const clip = m.animations.find((a) => a.name === name);
        if (clip) this.actions[key] = this.mixer.clipAction(clip);
      }
      for (const key of ["attack", "hit", "death", "block"]) {
        const a = this.actions[key];
        if (a) {
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = key === "death";
        }
      }
      this.group.remove(this.fallback.group);
      this.fallback.dispose();
      this.model = model;
      this.group.add(model);
      this.play(this.speed > 0.3 ? "walk" : "idle");
    });
  }

  private play(key: string, once = false) {
    const next = this.actions[key];
    if (!next) return;
    if (once) {
      next.reset().fadeIn(0.1).play();
      return;
    }
    if (this.current === next) return;
    this.current?.fadeOut(0.2);
    next.reset().fadeIn(0.2).play();
    this.current = next;
  }

  face(angle: number) {
    this.baseRot = angle;
    if (this.model) this.model.rotation.y = angle;
    else this.fallback.face(angle);
  }
  setMoving(speed: number) {
    this.speed = speed;
    if (!this.model) this.fallback.setMoving(speed);
    else if (!this.dead) this.play(speed > 0.3 ? "walk" : "idle");
  }
  attack(kind?: "melee" | "ranged" | "magic") {
    if (!this.model) return this.fallback.attack(kind);
    this.play("attack", true);
  }
  hit(crit?: boolean) {
    if (!this.model) return this.fallback.hit(crit);
    this.play("hit", true);
  }
  evade() {
    if (!this.model) return this.fallback.evade();
  }
  block() {
    if (!this.model) return this.fallback.block();
    this.play("block", true);
  }
  die() {
    this.dead = true;
    if (!this.model) return this.fallback.die();
    this.current?.fadeOut(0.1);
    this.play("death", true);
  }
  cheer() {
    if (!this.model) return this.fallback.cheer();
  }
  reset() {
    this.dead = false;
    if (!this.model) return this.fallback.reset();
    this.mixer?.stopAllAction();
    this.current = null;
    this.play("idle");
  }
  update(dt: number, time: number) {
    if (this.model) this.mixer?.update(dt);
    else this.fallback.update(dt, time);
  }
  dispose() {
    this.fallback.dispose();
    this.mixer?.stopAllAction();
  }
}

/** Vytvoří postavu: glTF, pokud je v manifestu, jinak procedurální. */
export function createFigure(opts: FigureOptions): HeroFigure {
  const slot = slotFor(opts);
  if (assets.has(slot)) return new GltfFigure(opts, slot);
  return new Figure(opts);
}
