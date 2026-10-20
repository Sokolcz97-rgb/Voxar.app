import * as THREE from "three";
import { Fire } from "../three/fx";
import type { Appearance, Faction, Fight, Fighter, HeroClass, HeroId, PresenceHero } from "../types";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Wildlife } from "./animals";
import { clothTex, dirtTex, dryGrassTex, grassTex, pavingTex, plasterTex, rockTex, roofTex, sandTex, stoneBlockTex, woodTex, worldMapped } from "../three/textures";
import { assets, createFigure, QUALITY, type HeroFigure, type ModelSlot, type QualitySettings } from "./assets";
import {
  AQUEDUCT, BEACONS, BUILDINGS, CITY, CAMP, ENEMY_CAMPS, MEMORIAL, NPCS, REGION_ENEMIES, RESPAWN, SAFE, SHIPS, SPAWN, WORLD_HALF, WRECKS,
  cityWalls, fbm, heightAt, inCity, inSafeZone, regionAt, roadDistance, SAFE_ZONES, type Box, type EnemyDef, type NpcDef, type NpcId, type RegionId,
} from "./map";

/**
 * Otevřený 3D svět 1. aktu (pobřeží Kalidry) ve stylu Vampire's Fall:
 * hráč chodí po mapě (WASD nebo kliknutím), kamera ho sleduje shora šikmo,
 * nepřátelé se toulají svými oblastmi a dotyk spustí souboj na místě.
 */

export type ScreenPoint = { x: number; y: number; visible: boolean };
export type Interactable =
  | { kind: "npc"; id: NpcId; dist: number }
  | { kind: "beacon"; id: "b1" | "b2" | "b3"; dist: number }
  | { kind: "memorial"; dist: number };

export type WorldFrame = {
  player: { x: number; z: number; ry: number; region: RegionId };
  npcs: Record<string, ScreenPoint>;
  enemies: { key: string; name: string; level: string; p: ScreenPoint }[];
  others: Record<string, ScreenPoint>;
  near: Interactable | null;
  /** Hráč stojí v bezpečné zóně (u místa zrození). */
  safe: boolean;
};

export type EnemyInfo = { key: string; region: RegionId; def: EnemyDef };

export type BattleEvent =
  | { type: "start"; f1: Fighter; f2: Fighter; hp1: number; hp2: number }
  | { type: "round"; index: number; hp1: number; hp2: number; attacker: 1 | 2; damage: number; crit: boolean; evaded: boolean; blocked: boolean; at: ScreenPoint }
  | { type: "end"; winner: 1 | 2 };

type Mode = "explore" | "battle" | "create" | "portrait" | "talk";
export type CameraMode = "top" | "third";

const CAMERA_KEY = "ashes.camera";
export function getCameraMode(): CameraMode {
  try {
    return localStorage.getItem(CAMERA_KEY) === "third" ? "third" : "top";
  } catch {
    return "top";
  }
}
function saveCameraMode(mode: CameraMode) {
  try {
    localStorage.setItem(CAMERA_KEY, mode);
  } catch {
    /* bez úložiště */
  }
}
type AABB = { x0: number; x1: number; z0: number; z1: number };

type Enemy = {
  key: string;
  def: EnemyDef;
  region: RegionId;
  home: THREE.Vector2;
  pos: THREE.Vector2;
  target: THREE.Vector2;
  fig: HeroFigure;
  wait: number;
  alive: boolean;
  respawnAt: number;
  calmUntil: number;
};

type Other = { fig: HeroFigure; pos: THREE.Vector2; target: THREE.Vector2; ry: number };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function std(color: string, rough = 0.9, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
}

export class OpenWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 600);
  private container: HTMLElement;
  private q: QualitySettings;
  private faction: Faction;
  private clock = new THREE.Clock();
  private raf = 0;
  private resizeObserver: ResizeObserver;
  private sun!: THREE.DirectionalLight;
  private water!: THREE.Mesh;
  private waterNormal!: THREE.Texture;
  private terrain!: THREE.Mesh;
  private fires: Fire[] = [];
  private beaconFires = new Map<string, Fire>();
  private colliders: AABB[] = [];
  private figures: HeroFigure[] = [];
  private wildlife: Wildlife | null = null;
  private composer: { render: () => void; setSize: (w: number, h: number) => void } | null = null;

  // hráč
  private player: HeroFigure | null = null;
  readonly pos = new THREE.Vector2();
  private moveTarget: THREE.Vector2 | null = null;
  private facing = 0;
  private keys = new Set<string>();
  private speed = 6;
  private yaw = 0;
  private zoom = 17;
  /** Kamera: "top" = pohled shora (Vampire's Fall), "third" = třetí osoba za hrdinou. */
  private camMode: CameraMode = getCameraMode();
  private tpDist = 6.5;
  private tpPitch = 0.3;
  private dragY = 0;
  private camInit = false;
  private sYaw = 0;
  private sPitch = 0.8;
  private sDist = 17;
  private mode: Mode = "explore";
  private inputEnabled = true;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();
  private focus: THREE.Vector3 | null = null;
  private dragging = false;
  private dragX = 0;
  private clickMarker: THREE.Mesh;

  // obyvatelé
  private npcs = new Map<NpcId, { def: NpcDef; fig: HeroFigure }>();
  private npcHits: THREE.Mesh[] = [];
  private enemies: Enemy[] = [];
  private others = new Map<string, Other>();
  private battleFigures: HeroFigure[] = [];
  private battleCenter = new THREE.Vector3();
  private battleSpeed = 1;
  private battleAbort = false;
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private lastRegion: RegionId | null = null;
  private pendingInteractNpc: NpcId | null = null;

  onEncounter: ((enemy: EnemyInfo) => void) | null = null;
  onFrame: ((frame: WorldFrame) => void) | null = null;
  onRegion: ((region: RegionId) => void) | null = null;
  onInteract: ((target: Interactable) => void) | null = null;
  onMove: ((x: number, z: number, ry: number) => void) | null = null;
  onCameraMode: ((mode: CameraMode) => void) | null = null;

  constructor(container: HTMLElement, faction: Faction, quality: QualitySettings = QUALITY.high) {
    this.container = container;
    this.q = quality;
    this.faction = faction;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
    this.renderer.shadowMap.enabled = quality.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog("#9a8a8a", 70, quality.viewDistance);
    this.buildSky();
    this.buildLights();
    this.buildTerrain();
    this.buildWater();
    this.buildCity();
    this.buildCountryside();
    this.buildVegetation();
    this.buildSafeZones();
    this.wildlife = new Wildlife(this.scene, quality.treeDensity, (x, z) => this.blocked(x, z));

    const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24), new THREE.MeshBasicMaterial({ color: "#f0d39a", transparent: true, opacity: 0.8, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    this.clickMarker = ring;
    this.scene.add(ring);

    const start = SPAWN[faction];
    this.pos.set(start[0], start[1]);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.bindInput();
    if (quality.bloom) void this.setupBloom();
    this.loop();
  }

  // ================================================================ stavba světa
  private buildSky() {
    const geo = new THREE.SphereGeometry(450, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { sunDir: { value: new THREE.Vector3(-1, 0.12, 0.25).normalize() } },
      vertexShader: "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `varying vec3 vDir; uniform vec3 sunDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 top = vec3(0.10, 0.12, 0.24);
          vec3 mid = vec3(0.42, 0.30, 0.40);
          vec3 hor = vec3(0.92, 0.48, 0.28);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h));
          c = mix(c, top, smoothstep(0.18, 0.75, h));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          c += vec3(1.0, 0.45, 0.18) * pow(s, 18.0) * 0.9 + vec3(1.0, 0.8, 0.5) * pow(s, 900.0) * 2.0;
          c = mix(c, vec3(0.24, 0.20, 0.24), smoothstep(0.0, -0.2, h));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -10;
    this.scene.add(sky);
    // osvětlení z okolí (environment map) – kovy (bronz) odrážejí oblohu a zem
    try {
      const envScene = new THREE.Scene();
      envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), mat));
      const ground = new THREE.Mesh(new THREE.CircleGeometry(9.5, 32), new THREE.MeshBasicMaterial({ color: "#5a4a32" }));
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.6;
      envScene.add(ground);
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(envScene, 0.02).texture;
      this.scene.environmentIntensity = 0.75;
      pmrem.dispose();
    } catch {
      /* bez environment mapy */
    }
    // hory na obzoru (siluety)
    const mtn = std("#3a3238", 1, { flatShading: true });
    const r = rng(7);
    for (let i = 0; i < 26; i += 1) {
      const a = Math.PI * 0.55 + (i / 26) * Math.PI * 0.9;
      const d = 210 + r() * 40;
      const h = 30 + r() * 45;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(28 + r() * 30, h, 5), mtn);
      cone.position.set(Math.cos(a) * d * 0.9, h / 2 - 8, -Math.abs(Math.sin(a) * d));
      this.scene.add(cone);
    }
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight("#b8c4e0", "#5a5032", 0.8));
    const sun = new THREE.DirectionalLight("#ffc890", 2.6);
    sun.castShadow = this.q.shadows;
    sun.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
    const s = 34;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    const fill = new THREE.DirectionalLight("#8090c0", 0.5);
    fill.position.set(40, 60, 60);
    this.scene.add(fill);
  }

  private buildTerrain() {
    const size = WORLD_HALF * 2 + 20;
    const seg = 220;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal as THREE.BufferAttribute;
    // váhy povrchů: A = tráva, suchá tráva, písek, skála; B = cesta, dlažba
    const splatA = new Float32Array(pos.count * 4);
    const splatB = new Float32Array(pos.count * 2);
    const tint = new Float32Array(pos.count * 3);
    const smooth = (a: number, b: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
      const n = fbm(x * 0.08, z * 0.08);
      const patch = fbm(x * 0.025 + 7, z * 0.025 - 3);
      const slope = 1 - nrm.getY(i);
      let g = 0, d = 0, sa = 0, r = 0, road = 0, pave = 0;
      let tr = 1, tg = 1, tb = 1;
      if (inCity(x, z) && h > 2) {
        pave = 1;
      } else if (h < 0.95) {
        sa = 1 - smooth(0.55, 0.95, h) * 0.6;
        g = 1 - sa;
        if (h < 0.1) {
          // mořské dno pod hladinou – tmavší a zelenavé
          const k = smooth(0.1, -2, h);
          tr = 1 - k * 0.55;
          tg = 1 - k * 0.45;
          tb = 1 - k * 0.4;
        }
      } else {
        const dry = smooth(0.35, 0.7, n);
        g = 1 - dry;
        d = dry;
        const lush = smooth(0.45, 0.75, patch);
        tr -= lush * 0.18;
        tb -= lush * 0.15;
      }
      r = Math.max(smooth(5, 11, h), smooth(0.18, 0.42, slope)) * (pave ? 0 : 1);
      const rd = roadDistance(x, z);
      if (rd < 2.8 && h > 0.3 && !pave) road = 1 - smooth(1.4, 2.8, rd);
      // normalizace
      const keep = 1 - r;
      g *= keep;
      d *= keep;
      sa *= keep;
      const sum = g + d + sa + r || 1;
      splatA.set([g / sum, d / sum, sa / sum, r / sum], i * 4);
      splatB.set([road, pave], i * 2);
      const v = 0.92 + n * 0.16;
      tint.set([tr * v, tg * v, tb * v], i * 3);
    }
    geo.setAttribute("splatA", new THREE.BufferAttribute(splatA, 4));
    geo.setAttribute("splatB", new THREE.BufferAttribute(splatB, 2));
    geo.setAttribute("color", new THREE.BufferAttribute(tint, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const tex = [grassTex(), dryGrassTex(), sandTex(), rockTex(), dirtTex(), pavingTex()];
    mat.onBeforeCompile = (shader) => {
      ["tG", "tD", "tS", "tR", "tDi", "tP"].forEach((name, i) => {
        shader.uniforms[name] = { value: tex[i].map };
        shader.uniforms[`${name}h`] = { value: tex[i].bump };
      });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 splatA;\nattribute vec2 splatB;\nvarying vec4 vSA;\nvarying vec2 vSB;\nvarying vec3 vWP;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvSA = splatA;\nvSB = splatB;\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec4 vSA; varying vec2 vSB; varying vec3 vWP;
          uniform sampler2D tG, tD, tS, tR, tDi, tP, tGh, tDh, tSh, tRh, tDih, tPh;
          vec3 tri(sampler2D t, vec2 a, vec2 b) { return mix(texture2D(t, a).rgb, texture2D(t, b).rgb, 0.35); }
          float trih(sampler2D t, vec2 a, vec2 b) { return mix(texture2D(t, a).r, texture2D(t, b).r, 0.35); }`,
        )
        .replace(
          "#include <map_fragment>",
          `#include <map_fragment>
          vec2 uvA = vWP.xz * 0.25;
          vec2 uvB = vWP.xz * 0.057 + vec2(0.31, 0.77);
          vec3 col = tri(tG, uvA, uvB) * vSA.x + tri(tD, uvA, uvB) * vSA.y + tri(tS, uvA * 0.8, uvB) * vSA.z + tri(tR, uvA * 0.6, uvB) * vSA.w;
          float hh = trih(tGh, uvA, uvB) * vSA.x + trih(tDh, uvA, uvB) * vSA.y + trih(tSh, uvA * 0.8, uvB) * vSA.z + trih(tRh, uvA * 0.6, uvB) * vSA.w;
          col = mix(col, tri(tDi, uvA, uvB), vSB.x);
          hh = mix(hh, trih(tDih, uvA, uvB), vSB.x);
          col = mix(col, texture2D(tP, vWP.xz * 0.22).rgb, vSB.y);
          hh = mix(hh, texture2D(tPh, vWP.xz * 0.22).r, vSB.y);
          diffuseColor.rgb *= col * (0.78 + hh * 0.42) * 1.15;`,
        );
    };
    mat.customProgramCacheKey = () => "ashes-terrain-v2";
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  private buildWater() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const img = ctx.createImageData(128, 128);
      for (let y = 0; y < 128; y += 1) {
        for (let x = 0; x < 128; x += 1) {
          const nx = Math.sin((x / 128) * Math.PI * 6 + Math.sin((y / 128) * Math.PI * 4) * 1.4);
          const ny = Math.sin((y / 128) * Math.PI * 8 + Math.cos((x / 128) * Math.PI * 2) * 1.2);
          const k = (y * 128 + x) * 4;
          img.data[k] = 128 + nx * 40;
          img.data[k + 1] = 128 + ny * 40;
          img.data[k + 2] = 255;
          img.data[k + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    this.waterNormal = new THREE.CanvasTexture(canvas);
    this.waterNormal.wrapS = this.waterNormal.wrapT = THREE.RepeatWrapping;
    this.waterNormal.repeat.set(60, 60);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: "#1b3d4c", roughness: 0.12, metalness: 0.35, transparent: true, opacity: 0.9, normalMap: this.waterNormal, normalScale: new THREE.Vector2(0.35, 0.35) }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.02;
    this.water = water;
    this.scene.add(water);
  }

  private addBox(b: Box, mat: THREE.Material, y0?: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
    const base = y0 ?? heightAt(b.x, b.z);
    m.position.set(b.x, base + b.h / 2, b.z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    this.colliders.push({ x0: b.x - b.w / 2 - 0.4, x1: b.x + b.w / 2 + 0.4, z0: b.z - b.d / 2 - 0.4, z1: b.z + b.d / 2 + 0.4 });
    return m;
  }

  private buildCity() {
    const stone = worldMapped(std("#f2ece0", 0.92), stoneBlockTex(), 4.5);
    const stoneDark = worldMapped(std("#d2cabb", 0.95), stoneBlockTex(), 3.2);
    const plaster = worldMapped(std("#ffffff", 0.9), plasterTex(), 3);
    const roof = worldMapped(std("#ffffff", 0.85, { flatShading: true }), roofTex(), 2.2, 0.8);
    const wood = worldMapped(std("#ffffff", 0.85), woodTex(), 2);
    const bronze = new THREE.MeshStandardMaterial({ color: "#b07a3a", metalness: 0.8, roughness: 0.35 });
    const cityY = CITY.height;

    for (const w of cityWalls()) {
      if (w.kind === "tower") {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(w.w / 2, w.w / 2 + 0.3, w.h, 10), stone);
        t.position.set(w.x, cityY + w.h / 2 - 0.5, w.z);
        t.castShadow = true;
        t.receiveShadow = true;
        this.scene.add(t);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(w.w / 2 + 0.35, w.w / 2 + 0.35, 0.6, 10), stoneDark);
        cap.position.set(w.x, cityY + w.h - 0.2, w.z);
        this.scene.add(cap);
        this.colliders.push({ x0: w.x - w.w / 2 - 0.4, x1: w.x + w.w / 2 + 0.4, z0: w.z - w.d / 2 - 0.4, z1: w.z + w.d / 2 + 0.4 });
      } else {
        this.addBox(w, stone, cityY - 0.6);
        // cimbuří
        const along = w.w > w.d ? "x" : "z";
        const len = along === "x" ? w.w : w.d;
        const n = Math.floor(len / 1.6);
        const merlon = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), stoneDark, n);
        const m = new THREE.Matrix4();
        for (let i = 0; i < n; i += 1) {
          const o = -len / 2 + 0.8 + i * 1.6;
          m.makeTranslation(along === "x" ? w.x + o : w.x, cityY - 0.6 + w.h + 0.35, along === "x" ? w.z : w.z + o);
          merlon.setMatrixAt(i, m);
        }
        merlon.castShadow = true;
        this.scene.add(merlon);
      }
    }
    // otevřená cedrová vrata
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.2, 3.6), wood);
      const z = side < 0 ? CITY.gateZ0 + 0.3 : CITY.gateZ1 - 0.3;
      door.position.set(CITY.x0 + 1.6, cityY + 1.6, z);
      door.rotation.y = side * 1.1;
      this.scene.add(door);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, CITY.gateZ1 - CITY.gateZ0 + 2), stone);
    lintel.position.set(CITY.x0, cityY + 5.4, (CITY.gateZ0 + CITY.gateZ1) / 2);
    this.scene.add(lintel);

    for (const b of BUILDINGS) {
      const y = heightAt(b.x, b.z);
      // vlastní model z manifestu (glTF) má přednost před procedurální stavbou
      const slot = `building.${b.kind === "bigtent" ? "tent" : b.kind}` as ModelSlot;
      if (assets.has(slot)) {
        const holder = new THREE.Group();
        holder.position.set(b.x, y, b.z);
        this.scene.add(holder);
        assets.place(slot, holder, () => new THREE.Group());
        this.colliders.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
        continue;
      }
      if (b.kind === "temple") {
        const base = new THREE.Mesh(new THREE.BoxGeometry(b.w + 2, 0.8, b.d + 2), stone);
        base.position.set(b.x, y + 0.4, b.z);
        base.receiveShadow = true;
        this.scene.add(base);
        for (let i = 0; i < 6; i += 1) {
          for (const side of [-1, 1]) {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, b.h, 12), plaster);
            col.position.set(b.x - b.w / 2 + 0.8 + i * ((b.w - 1.6) / 5), y + 0.8 + b.h / 2, b.z + side * (b.d / 2 - 0.6));
            col.castShadow = true;
            this.scene.add(col);
          }
        }
        const cella = new THREE.Mesh(new THREE.BoxGeometry(b.w - 4, b.h - 0.6, b.d - 4), plaster);
        cella.position.set(b.x, y + 0.8 + (b.h - 0.6) / 2, b.z);
        this.scene.add(cella);
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(b.d / 2 + 0.6, b.d / 2 + 0.6, b.w + 1, 3, 1), roof);
        ped.rotation.z = Math.PI / 2;
        ped.scale.set(1, 1, 0.45);
        ped.position.set(b.x, y + 0.8 + b.h + 0.9, b.z);
        ped.castShadow = true;
        this.scene.add(ped);
        this.colliders.push({ x0: b.x - b.w / 2 - 1, x1: b.x + b.w / 2 + 1, z0: b.z - b.d / 2 - 1, z1: b.z + b.d / 2 + 1 });
        continue;
      }
      if (b.kind === "tent" || b.kind === "bigtent") {
        const cloth = std("#ffffff", 0.95, { flatShading: true, side: THREE.DoubleSide, map: clothTex(b.kind === "bigtent" ? "#6e120c" : "#4b382c").map });
        const tent = new THREE.Mesh(new THREE.ConeGeometry(b.w / 1.4, b.h, b.kind === "bigtent" ? 8 : 4, 1, true), cloth);
        tent.position.set(b.x, y + b.h / 2, b.z);
        tent.castShadow = true;
        this.scene.add(tent);
        if (b.kind === "bigtent") this.addBanner(b.x + 4.5, b.z + 3, "#140806", true);
        this.colliders.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 });
        continue;
      }
      const hutMat = worldMapped(std("#c8b498", 0.95), woodTex(), 1.8);
      this.addBox(b, b.kind === "hut" ? hutMat : plaster, y - 0.2);
      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.75, 1.6, 4), b.kind === "hut" ? worldMapped(std("#b8a070", 1, { flatShading: true }), woodTex(), 1.5) : roof);
      roofMesh.rotation.y = Math.PI / 4;
      roofMesh.scale.set(b.w / Math.max(b.w, b.d), 1, b.d / Math.max(b.w, b.d));
      roofMesh.position.set(b.x, y - 0.2 + b.h + 0.8, b.z);
      roofMesh.castShadow = true;
      this.scene.add(roofMesh);
      if (b.kind === "tavern") {
        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.08), wood);
        sign.position.set(b.x + 2, y + 2.8, b.z + b.d / 2 + 0.6);
        this.scene.add(sign);
        const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), wood);
        oar.rotation.z = Math.PI / 2.4;
        oar.position.set(b.x - 1.5, y + 3.2, b.z + b.d / 2 + 0.15);
        this.scene.add(oar);
        this.addFire(b.x + 3.4, y + 2.2, b.z + b.d / 2 + 0.5, 0.35);
      }
      if (b.kind === "smithy") {
        const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.35), new THREE.MeshStandardMaterial({ color: "#3a3a3c", metalness: 0.8, roughness: 0.4 }));
        anvil.position.set(b.x - 1.5, y + 0.45, b.z + b.d / 2 + 1.5);
        this.scene.add(anvil);
        this.addFire(b.x + 2, y + 1, b.z + b.d / 2 + 1.2, 0.6);
      }
      if (b.kind === "hut") this.addFire(b.x + 2.5, y + 0.1, b.z + 4, 0.8);
    }

    // agora: kašna, bronzová socha a korouhve
    const fy = heightAt(74, 15);
    // kašna: nízké dno + obruba (prstenec) + hladina mezi nimi – žádné dvě plochy
    // ve stejné výšce, takže voda už neproblikává (z-fighting)
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.4, 28), stone);
    basin.position.set(74, fy + 0.2, 15);
    basin.receiveShadow = true;
    this.scene.add(basin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.2, 8, 36), stone);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(74, fy + 0.62, 15);
    rim.castShadow = true;
    this.scene.add(rim);
    const rimWall = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.26, 28, 1, true), stone);
    rimWall.position.set(74, fy + 0.52, 15);
    this.scene.add(rimWall);
    const poolMat = new THREE.MeshStandardMaterial({ color: "#2a5a6a", roughness: 0.08, metalness: 0.3, normalMap: this.waterNormal, normalScale: new THREE.Vector2(0.25, 0.25), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.18, 28), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(74, fy + 0.5, 15);
    this.scene.add(pool);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.4, 10), stone);
    plinth.position.set(74, fy + 1.4, 15);
    this.scene.add(plinth);
    const statue = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.12, 24), bronze);
    statue.rotation.x = Math.PI / 2;
    statue.position.set(74, fy + 2.9, 15);
    this.scene.add(statue);
    this.colliders.push({ x0: 71.2, x1: 76.8, z0: 12.2, z1: 17.8 });
    this.addBanner(CITY.x0 - 1.5, CITY.gateZ0 - 3.2, "#6a1610");
    this.addBanner(CITY.x0 - 1.5, CITY.gateZ1 + 3.2, "#6a1610");

    // aréna – kruh kamenů ve městě
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), stoneDark);
      st.scale.set(0.9, 2.2, 0.7);
      const x = 66 + Math.cos(a) * 4.2, z = 34 + Math.sin(a) * 3.2;
      st.position.set(x, heightAt(x, z) + 0.9, z);
      st.castShadow = true;
      this.scene.add(st);
    }
  }

  private addBanner(x: number, z: number, color: string, sun = false) {
    const y = heightAt(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), std("#2a1d14", 0.8));
    pole.position.set(x, y + 3, z);
    pole.castShadow = true;
    this.scene.add(pole);
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.4, 3, 8), std(color, 0.95, { side: THREE.DoubleSide }));
    cloth.position.set(x + 0.6, y + 4.6, z);
    this.scene.add(cloth);
    if (sun) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshStandardMaterial({ color: "#d2492b", emissive: "#5a1006", side: THREE.DoubleSide }));
      disc.position.set(x + 0.6, y + 4.9, z + 0.04);
      this.scene.add(disc);
    }
  }

  private addFire(x: number, y: number, z: number, size: number, light = true) {
    const f = new Fire(size, light);
    f.group.position.set(x, y, z);
    this.scene.add(f.group);
    this.fires.push(f);
    return f;
  }

  private buildCountryside() {
    const stone = worldMapped(std("#c8bfae", 0.92), stoneBlockTex(), 3.5);
    const wood = worldMapped(std("#d8c8b8", 0.9), woodTex(), 2);
    // akvadukt
    const [a, b] = AQUEDUCT;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(len / 5);
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const broken = Math.sin(i * 12.9898) > 0.55;
      const h = broken ? 3 + Math.abs(Math.sin(i * 7)) * 3 : 8;
      const y = heightAt(x, z);
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.4), stone);
      pier.position.set(x, y + h / 2 - 0.3, z);
      pier.castShadow = true;
      pier.receiveShadow = true;
      this.scene.add(pier);
      this.colliders.push({ x0: x - 1.1, x1: x + 1.1, z0: z - 1.1, z1: z + 1.1 });
      if (!broken && i < n) {
        const span = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 1.6), stone);
        span.position.set(x + Math.cos(ang) * 2.5, y + h - 0.2, z + Math.sin(ang) * 2.5);
        span.rotation.y = -ang;
        span.castShadow = true;
        this.scene.add(span);
        const arch = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.35, 4, 10, Math.PI), stone);
        arch.position.set(x + Math.cos(ang) * 2.5, y + h - 2.6, z + Math.sin(ang) * 2.5);
        arch.rotation.y = -ang;
        this.scene.add(arch);
      }
    }
    // vraky na Bezejmenném břehu
    const hullMat = worldMapped(std("#9a7a5c", 0.95, { side: THREE.DoubleSide }), woodTex(), 1.6);
    for (const w of WRECKS) {
      const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 7, 12, 1, true, 0, Math.PI), hullMat);
      hull.rotation.set(Math.PI / 2, w.r, Math.PI);
      hull.position.set(w.x, heightAt(w.x, w.z) + 0.6, w.z);
      hull.castShadow = true;
      this.scene.add(hull);
    }
    // černé lodě v zátoce
    const black = std("#151214", 0.8);
    const sail = std("#1a1414", 0.95, { side: THREE.DoubleSide });
    for (const s of SHIPS) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.2, 10), black);
      hull.position.y = 0.4;
      g.add(hull);
      const prow = new THREE.Mesh(new THREE.ConeGeometry(1.3, 2.8, 4), black);
      prow.rotation.x = Math.PI / 2;
      prow.position.set(0, 0.5, 6.2);
      g.add(prow);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 8, 6), wood);
      mast.position.y = 4.5;
      g.add(mast);
      const sl = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.6, 4, 4), sail);
      sl.position.set(0, 5.3, 0.2);
      g.add(sl);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(0.8, 16), new THREE.MeshStandardMaterial({ color: "#a8261a", side: THREE.DoubleSide }));
      disc.position.set(0, 5.4, 0.3);
      g.add(disc);
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.r;
      this.scene.add(g);
    }
    // strážní vatry
    for (const b of BEACONS) {
      const y = heightAt(b.x, b.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 1.2, 8), stone);
      base.position.set(b.x, y + 0.5, b.z);
      base.castShadow = true;
      this.scene.add(base);
      for (let i = 0; i < 6; i += 1) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.8, 5), wood);
        log.position.set(b.x, y + 1.6, b.z);
        log.rotation.set(0.5, (i / 6) * Math.PI * 2, 0);
        this.scene.add(log);
      }
      const fire = this.addFire(b.x, y + 1.3, b.z, 1.6);
      fire.lit = this.faction === "legie";
      this.beaconFires.set(b.id, fire);
      this.colliders.push({ x0: b.x - 1.4, x1: b.x + 1.4, z0: b.z - 1.4, z1: b.z + 1.4 });
    }
    // pamětní kámen
    const my = heightAt(MEMORIAL.x, MEMORIAL.z);
    const stele = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.6, 0.5), std("#d8d0c0", 0.85));
    stele.position.set(MEMORIAL.x, my + 1.3, MEMORIAL.z);
    stele.castShadow = true;
    this.scene.add(stele);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3, 0), stone);
      st.position.set(MEMORIAL.x + Math.cos(a) * 2.2, my + 0.15, MEMORIAL.z + Math.sin(a) * 2.2);
      this.scene.add(st);
    }
    this.addFire(MEMORIAL.x + 0.9, my + 0.2, MEMORIAL.z + 0.8, 0.3, false);
    // tábor Legie – ohně
    this.addFire(CAMP.x - 2, heightAt(CAMP.x - 2, CAMP.z + 2) + 0.1, CAMP.z + 2, 1.1);
    this.addFire(-46, heightAt(-46, -52) + 0.1, -52, 0.9);
    this.addBanner(-40, -50, "#140806", true);
    this.addBanner(48, -58, "#140806", true);
  }

  /** Hranice bezpečných zón: řada nízkých bílých kamenů s modravou září. */
  private buildSafeZones() {
    const mat = new THREE.MeshStandardMaterial({ color: "#e8e2d4", emissive: "#3a5a7a", emissiveIntensity: 0.35, roughness: 0.8, flatShading: true });
    const geo = new THREE.DodecahedronGeometry(0.28, 0);
    const mats: THREE.Matrix4[] = [];
    for (const z of SAFE_ZONES) {
      if (inCity(z.x, z.z)) continue;
      const n = Math.round((2 * Math.PI * z.r) / 3.2);
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        const x = z.x + Math.cos(a) * z.r, zz = z.z + Math.sin(a) * z.r;
        const h = heightAt(x, zz);
        if (h < 0.3) continue;
        mats.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h + 0.1, zz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, 0)), new THREE.Vector3(1, 1.6, 1)));
      }
    }
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((m, i) => im.setMatrixAt(i, m));
    im.castShadow = true;
    this.scene.add(im);
  }

  private buildVegetation() {
    const r = rng(1234);
    const cypressN = Math.floor(520 * this.q.treeDensity);
    const oliveN = Math.floor(380 * this.q.treeDensity);
    const ok = (x: number, z: number) => {
      const h = heightAt(x, z);
      if (h < 1 || h > 14) return false;
      if (roadDistance(x, z) < 4) return false;
      if (x > CITY.x0 - 6 && x < CITY.x1 + 4 && z > CITY.z0 - 6 && z < CITY.z1 + 6) return false;
      if (Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r - 4) return false;
      for (const npc of NPCS) if (Math.hypot(x - npc.x, z - npc.z) < 9) return false;
      for (const sp of Object.values(SPAWN)) if (Math.hypot(x - sp[0], z - sp[1]) < 12) return false;
      for (const b of BEACONS) if (Math.hypot(x - b.x, z - b.z) < 5) return false;
      return true;
    };
    const place = (count: number, build: (m: THREE.Matrix4[]) => void) => {
      const mats: THREE.Matrix4[] = [];
      let tries = 0;
      while (mats.length < count && tries < count * 20) {
        tries += 1;
        const x = (r() - 0.5) * WORLD_HALF * 2;
        const z = (r() - 0.5) * WORLD_HALF * 2;
        if (!ok(x, z)) continue;
        const s = 0.7 + r() * 0.45;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x, heightAt(x, z) - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3(s, s * (0.9 + r() * 0.4), s));
        mats.push(m);
      }
      build(mats);
    };
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[]) => {
      const im = new THREE.InstancedMesh(geo, mat, mats.length);
      const tint = new THREE.Color();
      mats.forEach((m, i) => {
        im.setMatrixAt(i, m);
        // každý strom/kámen trochu jiný odstín
        const k = 0.82 + ((i * 2654435761) % 1000) / 1000 * 0.3;
        im.setColorAt(i, tint.setRGB(k, k * (0.97 + ((i * 7) % 5) * 0.012), k * 0.95));
      });
      im.castShadow = true;
      im.receiveShadow = true;
      this.scene.add(im);
    };
    // organický tvar koruny: vrcholy posunuté šumem + tmavší spodek (vertex colors)
    const organic = (geo: THREE.BufferGeometry, amount: number, seed: number, dark: number) => {
      const g = geo.index ? geo.toNonIndexed() : geo;
      const p = g.attributes.position as THREE.BufferAttribute;
      const col = new Float32Array(p.count * 3);
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < p.count; i += 1) {
        minY = Math.min(minY, p.getY(i));
        maxY = Math.max(maxY, p.getY(i));
      }
      const key = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      const moved = new Map<string, [number, number, number]>();
      for (let i = 0; i < p.count; i += 1) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const k = key(x, y, z);
        let m = moved.get(k);
        if (!m) {
          const n = fbm(x * 1.7 + seed, z * 1.7 + y * 1.3) - 0.5;
          const len = Math.hypot(x, z) || 1;
          m = [x + (x / len) * n * amount, y + n * amount * 0.4, z + (z / len) * n * amount];
          moved.set(k, m);
        }
        p.setXYZ(i, m[0], m[1], m[2]);
        const t = (y - minY) / (maxY - minY || 1);
        const c = dark + (1 - dark) * Math.min(1, t * 1.3);
        col.set([c, c, c], i * 3);
      }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      return g;
    };
    place(cypressN, (mats) => {
      const trunk = new THREE.CylinderGeometry(0.1, 0.16, 1.2, 6);
      trunk.translate(0, 0.6, 0);
      const crown = organic(new THREE.ConeGeometry(0.72, 4.6, 9, 6), 0.32, 1, 0.55);
      crown.translate(0, 3.2, 0);
      inst(trunk, worldMapped(std("#a08a70"), woodTex(), 0.8), mats);
      inst(crown, std("#3c4a2c", 0.95, { flatShading: true, vertexColors: true }), mats);
    });
    place(oliveN, (mats) => {
      const trunk = new THREE.CylinderGeometry(0.16, 0.3, 1.9, 7);
      trunk.translate(0, 0.95, 0);
      const blobs = [
        [0, 2.7, 0, 1.25],
        [0.8, 2.4, 0.3, 0.9],
        [-0.7, 2.5, -0.4, 0.95],
        [0.1, 3.2, -0.6, 0.85],
        [-0.3, 2.3, 0.8, 0.8],
      ].map(([x, y, z, r], i) => {
        const b = new THREE.IcosahedronGeometry(r, 1);
        b.scale(1.15, 0.75, 1.15);
        b.translate(x, y, z);
        return organic(b, 0.35, i * 3.1, 0.6);
      });
      const crown = mergeGeometries(blobs);
      inst(trunk, worldMapped(std("#b8a088"), woodTex(), 0.8), mats);
      inst(crown, std("#6c7650", 0.95, { flatShading: true, vertexColors: true }), mats);
    });
    // kameny
    const rocks: THREE.Matrix4[] = [];
    for (let i = 0; i < 420; i += 1) {
      const x = (r() - 0.5) * WORLD_HALF * 2, z = (r() - 0.5) * WORLD_HALF * 2;
      const h = heightAt(x, z);
      if (h < 0.2 || inCity(x, z) || roadDistance(x, z) < 3) continue;
      const s = 0.3 + r() * (h > 6 ? 1.6 : 0.8);
      rocks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h + s * 0.2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3)), new THREE.Vector3(s, s * 0.7, s)));
    }
    inst(new THREE.DodecahedronGeometry(1, 1), worldMapped(std("#d8d0c0", 0.95, { flatShading: true }), rockTex(), 1.6), rocks);
    // tráva
    if (this.q.grass > 0) {
      const grass: THREE.Matrix4[] = [];
      for (let i = 0; i < this.q.grass * 3 && grass.length < this.q.grass; i += 1) {
        const x = (r() - 0.5) * 200, z = (r() - 0.5) * 200;
        const h = heightAt(x, z);
        if (h < 0.9 || h > 9 || inCity(x, z) || roadDistance(x, z) < 2.4) continue;
        grass.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4)), new THREE.Vector3(1, 0.7 + r() * 0.8, 1)));
      }
      // trs trávy = tři zkřížené ploché čepele
      const tuft = new THREE.BufferGeometry();
      const v: number[] = [];
      for (let k = 0; k < 6; k += 1) {
        const a = (k / 6) * Math.PI * 2;
        const ox = Math.cos(a) * 0.12, oz = Math.sin(a) * 0.12;
        const px = -Math.sin(a) * 0.035, pz = Math.cos(a) * 0.035;
        const h = 0.35 + (k % 3) * 0.12;
        v.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, ox * 2.2, h, oz * 2.2);
      }
      tuft.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      tuft.computeVertexNormals();
      const im = new THREE.InstancedMesh(tuft, new THREE.MeshLambertMaterial({ color: "#a39a5c", side: THREE.DoubleSide }), grass.length);
      grass.forEach((m, i) => im.setMatrixAt(i, m));
      this.scene.add(im);
    }
  }

  private async setupBloom() {
    try {
      const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
        import("three/examples/jsm/postprocessing/EffectComposer.js"),
        import("three/examples/jsm/postprocessing/RenderPass.js"),
        import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
        import("three/examples/jsm/postprocessing/OutputPass.js"),
      ]);
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(this.container.clientWidth, this.container.clientHeight), 0.45, 0.6, 0.86));
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.resize();
    } catch {
      this.composer = null;
    }
  }

  // ================================================================ obyvatelé
  setPlayer(cls: HeroClass, appearance: Appearance, hero: HeroId | null, shield: boolean, legion: boolean) {
    if (this.player) {
      this.scene.remove(this.player.group);
      this.player.dispose();
      this.figures = this.figures.filter((f) => f !== this.player);
    }
    this.player = createFigure({ cls, appearance, eryon: hero === "eryon", azkar: hero === "azkar", legion: legion && !hero, shield });
    this.player.face(this.facing);
    this.player.group.visible = this.mode !== "battle";
    this.scene.add(this.player.group);
    this.figures.push(this.player);
    this.syncPlayer();
  }

  /** NPC a nepřátelé podle strany hráče. Volá se po vytvoření postavy. */
  populate(faction: Faction) {
    this.faction = faction;
    for (const { fig } of this.npcs.values()) {
      this.scene.remove(fig.group);
      fig.dispose();
    }
    this.npcs.clear();
    this.npcHits.forEach((h) => this.scene.remove(h));
    this.npcHits = [];
    for (const def of NPCS) {
      if (def.faction !== faction) continue;
      const fig = createFigure({
        cls: def.cls,
        appearance: { cloak: def.look?.cloak, crest: def.look?.crest, skin: def.look?.skin },
        eryon: def.hero === "eryon",
        azkar: def.hero === "azkar",
        legion: faction === "legie" && !def.hero,
        shield: def.cls === "hoplit",
      });
      fig.group.position.set(def.x, heightAt(def.x, def.z), def.z);
      fig.face(def.face);
      this.scene.add(fig.group);
      this.figures.push(fig);
      this.npcs.set(def.id, { def, fig });
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.4, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(def.x, heightAt(def.x, def.z) + 1.2, def.z);
      hit.userData.npc = def.id;
      this.scene.add(hit);
      this.npcHits.push(hit);
      this.colliders.push({ x0: def.x - 0.5, x1: def.x + 0.5, z0: def.z - 0.5, z1: def.z + 0.5 });
    }
    // nepřátelé
    for (const e of this.enemies) {
      this.scene.remove(e.fig.group);
      e.fig.dispose();
    }
    this.enemies = [];
    const r = rng(99);
    let k = 0;
    for (const camp of ENEMY_CAMPS) {
      if (SAFE[faction].includes(camp.region)) continue;
      const defs = REGION_ENEMIES[faction][camp.region];
      if (!defs?.length) continue;
      const count = camp.region === "kalidra" || camp.region === "camp" ? 1 : 2;
      for (let i = 0; i < count; i += 1) {
        const def = defs[Math.floor(r() * defs.length)];
        const home = new THREE.Vector2(camp.x + (r() - 0.5) * 6, camp.z + (r() - 0.5) * 6);
        const fig = createFigure({
          cls: def.c,
          appearance: faction === "legie" ? { cloak: ["#2c3e5a", "#7a1f16", "#3d4a2a"][i % 3] } : { tint: ["#7a1f1a", "#5b2a12", "#3a2f2a"][i % 3] },
          enemy: faction === "kalidra",
          legion: false,
          shield: def.c === "hoplit",
        });
        const enemy: Enemy = { key: `e${k++}`, def, region: camp.region, home, pos: home.clone(), target: home.clone(), fig, wait: r() * 3, alive: true, respawnAt: 0, calmUntil: 0 };
        fig.group.position.set(home.x, heightAt(home.x, home.y), home.y);
        this.scene.add(fig.group);
        this.figures.push(fig);
        this.enemies.push(enemy);
      }
    }
  }

  setBeacons(lit: Record<string, boolean>) {
    for (const [id, fire] of this.beaconFires) if (id in lit) fire.lit = lit[id];
  }

  setOthers(list: (PresenceHero & { x?: number; z?: number; ry?: number })[]) {
    const keep = new Set(list.map((o) => o.key));
    for (const [key, o] of this.others) {
      if (!keep.has(key)) {
        this.scene.remove(o.fig.group);
        o.fig.dispose();
        this.figures = this.figures.filter((f) => f !== o.fig);
        this.others.delete(key);
      }
    }
    for (const h of list) {
      if (typeof h.x !== "number" || typeof h.z !== "number") continue;
      let o = this.others.get(h.key);
      if (!o) {
        const fig = createFigure({ cls: h.cls, appearance: h.appearance, eryon: h.eryon, azkar: h.azkar, legion: h.faction === "legie" && !h.azkar });
        o = { fig, pos: new THREE.Vector2(h.x, h.z), target: new THREE.Vector2(h.x, h.z), ry: h.ry ?? 0 };
        this.others.set(h.key, o);
        this.figures.push(fig);
        this.scene.add(fig.group);
      }
      o.target.set(h.x, h.z);
      o.ry = h.ry ?? o.ry;
    }
  }

  teleport(x: number, z: number) {
    this.pos.set(x, z);
    this.moveTarget = null;
    this.syncPlayer();
  }

  respawn() {
    const p = RESPAWN[this.faction];
    this.teleport(p[0], p[1]);
    for (const e of this.enemies) e.calmUntil = performance.now() + 5000;
  }

  /** Zastaví pohyb (otevřený panel, rozhovor). */
  setInputEnabled(on: boolean) {
    this.inputEnabled = on;
    if (!on) {
      this.keys.clear();
      this.moveTarget = null;
    }
  }

  setMode(mode: Mode, focus?: { x: number; z: number }) {
    this.mode = mode;
    this.focus = focus ? new THREE.Vector3(focus.x, heightAt(focus.x, focus.z), focus.z) : null;
    const hub = mode !== "battle";
    if (this.player) this.player.group.visible = hub;
    for (const e of this.enemies) e.fig.group.visible = hub && e.alive;
    if (mode !== "battle") this.clearBattle();
  }

  // ================================================================ vstup
  private bindInput() {
    const el = this.renderer.domElement;
    const down = (e: KeyboardEvent) => {
      if (!this.inputEnabled || this.mode !== "explore") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
        this.keys.add(k);
        this.moveTarget = null;
        e.preventDefault();
      }
      if (k === "q") this.yaw += 0.15;
      if (k === "v" && !e.repeat) this.setCameraMode(this.camMode === "top" ? "third" : "top");
      if (k === "e" && !e.repeat) {
        const near = this.nearest();
        if (near) this.onInteract?.(near);
      }
    };
    const up = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", (e) => {
      if (e.button === 2) {
        this.dragging = true;
        this.dragX = e.clientX;
        this.dragY = e.clientY;
        return;
      }
      if (!this.inputEnabled || this.mode !== "explore") return;
      const rect = el.getBoundingClientRect();
      this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const npcHit = this.raycaster.intersectObjects(this.npcHits, false)[0];
      if (npcHit) {
        const id = npcHit.object.userData.npc as NpcId;
        const n = this.npcs.get(id);
        if (n) {
          this.moveTarget = new THREE.Vector2(n.def.x, n.def.z);
          this.pendingInteractNpc = id;
          return;
        }
      }
      const hit = this.raycaster.intersectObject(this.terrain, false)[0];
      if (hit) {
        this.moveTarget = new THREE.Vector2(hit.point.x, hit.point.z);
        this.pendingInteractNpc = null;
        this.clickMarker.position.set(hit.point.x, hit.point.y + 0.08, hit.point.z);
        this.clickMarker.visible = true;
      }
    });
    window.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      this.yaw -= (e.clientX - this.dragX) * 0.006;
      if (this.camMode === "third") this.tpPitch = Math.max(0.04, Math.min(1.1, this.tpPitch + (e.clientY - this.dragY) * 0.004));
      this.dragX = e.clientX;
      this.dragY = e.clientY;
    });
    window.addEventListener("pointerup", () => {
      this.dragging = false;
    });
    el.addEventListener("wheel", (e) => {
      if (this.camMode === "third") this.tpDist = Math.max(3, Math.min(14, this.tpDist + e.deltaY * 0.006));
      else this.zoom = Math.max(9, Math.min(34, this.zoom + e.deltaY * 0.012));
      e.preventDefault();
    }, { passive: false });
    this.unbind = () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }
  private unbind: () => void = () => {};

  /** Ovládání na dotyk/myš z UI (joystick). */
  nudge(dx: number, dz: number) {
    if (!this.inputEnabled || this.mode !== "explore") return;
    const fwd = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    const right = new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
    const dir = fwd.multiplyScalar(-dz).add(right.multiplyScalar(dx));
    this.moveTarget = this.pos.clone().add(dir.multiplyScalar(3));
  }

  // ================================================================ pohyb a kolize
  private blocked(x: number, z: number) {
    if (Math.abs(x) > WORLD_HALF - 2 || Math.abs(z) > WORLD_HALF - 2) return true;
    if (heightAt(x, z) < 0.25) return true;
    for (const c of this.colliders) if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1) return true;
    return false;
  }

  private moveBy(p: THREE.Vector2, dx: number, dz: number) {
    if (!this.blocked(p.x + dx, p.y)) p.x += dx;
    if (!this.blocked(p.x, p.y + dz)) p.y += dz;
  }

  private syncPlayer() {
    if (!this.player) return;
    this.player.group.position.set(this.pos.x, heightAt(this.pos.x, this.pos.y), this.pos.y);
  }

  private nearest(): Interactable | null {
    let best: Interactable | null = null;
    for (const { def } of this.npcs.values()) {
      const d = Math.hypot(def.x - this.pos.x, def.z - this.pos.y);
      if (d < 3.6 && (!best || d < best.dist)) best = { kind: "npc", id: def.id, dist: d };
    }
    for (const b of BEACONS) {
      const d = Math.hypot(b.x - this.pos.x, b.z - this.pos.y);
      if (d < 3.8 && (!best || d < best.dist)) best = { kind: "beacon", id: b.id, dist: d };
    }
    const dm = Math.hypot(MEMORIAL.x - this.pos.x, MEMORIAL.z - this.pos.y);
    if (dm < 4 && (!best || dm < best.dist)) best = { kind: "memorial", dist: dm };
    return best;
  }

  private updatePlayer(dt: number) {
    if (!this.player || this.mode !== "explore") {
      this.player?.setMoving(0);
      return;
    }
    const v = new THREE.Vector2();
    if (this.inputEnabled) {
      const fwd = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
      const right = new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
      if (this.keys.has("w") || this.keys.has("arrowup")) v.add(fwd);
      if (this.keys.has("s") || this.keys.has("arrowdown")) v.sub(fwd);
      if (this.keys.has("d") || this.keys.has("arrowright")) v.add(right);
      if (this.keys.has("a") || this.keys.has("arrowleft")) v.sub(right);
      if (v.lengthSq() === 0 && this.moveTarget) {
        const d = this.moveTarget.clone().sub(this.pos);
        const stopAt = this.pendingInteractNpc ? 2.4 : 0.3;
        if (d.length() < stopAt) {
          this.moveTarget = null;
          this.clickMarker.visible = false;
          if (this.pendingInteractNpc) {
            const id = this.pendingInteractNpc;
            this.pendingInteractNpc = null;
            this.onInteract?.({ kind: "npc", id, dist: d.length() });
          }
        } else v.copy(d);
      }
    }
    let moving = 0;
    if (v.lengthSq() > 0) {
      v.normalize();
      const before = this.pos.clone();
      this.moveBy(this.pos, v.x * this.speed * dt, v.y * this.speed * dt);
      moving = before.distanceTo(this.pos) / Math.max(dt, 1e-4);
      if (moving < 0.2 && this.moveTarget) {
        this.moveTarget = null;
        this.clickMarker.visible = false;
      }
      this.facing = Math.atan2(v.x, v.y);
    }
    this.player.face(this.facing);
    this.player.setMoving(moving);
    this.syncPlayer();
    if (moving > 0.1) this.onMove?.(this.pos.x, this.pos.y, this.facing);
    const region = regionAt(this.pos.x, this.pos.y);
    if (region !== this.lastRegion) {
      this.lastRegion = region;
      this.onRegion?.(region);
    }
  }

  private updateEnemies(dt: number, now: number) {
    for (const e of this.enemies) {
      if (!e.alive) {
        if (now > e.respawnAt) {
          e.alive = true;
          e.pos.copy(e.home);
          e.fig.reset();
          e.fig.group.visible = this.mode !== "battle";
          e.calmUntil = now + 2000;
        }
        continue;
      }
      if (this.mode === "battle") {
        e.fig.setMoving(0);
        continue;
      }
      const toPlayer = Math.hypot(this.pos.x - e.pos.x, this.pos.y - e.pos.y);
      const homeDist = e.pos.distanceTo(e.home);
      let speed = 0;
      const playerSafe = inSafeZone(this.pos.x, this.pos.y);
      if (inSafeZone(e.pos.x, e.pos.y, 1)) {
        // nepřítel zabloudil do bezpečné zóny → vrací se domů
        e.target.copy(e.home);
        speed = 2.6;
      } else if (this.mode === "explore" && !playerSafe && now > e.calmUntil && toPlayer < 7 && homeDist < 18) {
        e.target.copy(this.pos);
        speed = 3.4;
        if (toPlayer < 1.5) {
          e.calmUntil = now + 4000;
          this.moveTarget = null;
          this.onEncounter?.({ key: e.key, region: e.region, def: e.def });
          continue;
        }
      } else {
        e.wait -= dt;
        if (e.wait <= 0 && e.pos.distanceTo(e.target) < 0.5) {
          e.target.set(e.home.x + (Math.random() - 0.5) * 14, e.home.y + (Math.random() - 0.5) * 14);
          if (inSafeZone(e.target.x, e.target.y, 2)) e.target.copy(e.home);
          e.wait = 2 + Math.random() * 4;
        }
        if (homeDist > 18) e.target.copy(e.home);
        if (e.pos.distanceTo(e.target) > 0.5 && e.wait <= 0) speed = 1.5;
      }
      if (speed > 0) {
        const d = e.target.clone().sub(e.pos);
        if (d.length() > 0.1) {
          d.normalize();
          const before = e.pos.clone();
          this.moveBy(e.pos, d.x * speed * dt, d.y * speed * dt);
          if (before.distanceTo(e.pos) < 0.001) e.target.copy(e.pos);
          e.fig.face(Math.atan2(d.x, d.y));
        }
      }
      e.fig.setMoving(speed);
      e.fig.group.position.set(e.pos.x, heightAt(e.pos.x, e.pos.y), e.pos.y);
    }
  }

  /** Po souboji: poražený nepřítel zmizí a za chvíli se objeví znovu. */
  resolveEncounter(key: string, won: boolean) {
    const e = this.enemies.find((x) => x.key === key);
    if (!e) return;
    if (won) {
      e.alive = false;
      e.fig.group.visible = false;
      e.respawnAt = performance.now() + 35000;
    } else {
      e.calmUntil = performance.now() + 6000;
    }
  }

  // ================================================================ souboj na místě
  private clearBattle() {
    for (const f of this.battleFigures) {
      this.scene.remove(f.group);
      f.dispose();
      this.figures = this.figures.filter((x) => x !== f);
    }
    this.battleFigures = [];
  }

  setBattleSpeed(speed: number) {
    this.battleSpeed = speed;
  }

  abortBattle() {
    this.battleAbort = true;
  }

  async playFight(fight: Fight, onEvent: (e: BattleEvent) => void, ally: HeroId | null = null) {
    // bojiště = volné místo u hráče
    const cx = this.pos.x, cz = this.pos.y;
    this.battleCenter.set(cx, heightAt(cx, cz), cz);
    this.setMode("battle");
    this.clearBattle();
    this.battleAbort = false;
    this.battleSpeed = 1;
    const dir = new THREE.Vector2(Math.cos(this.yaw), -Math.sin(this.yaw));
    const make = (f: Fighter, side: 1 | 2) => {
      const fig = createFigure({
        cls: f.class,
        appearance: f.appearance ?? {},
        eryon: !!f.eryon || f.appearance?.hero === "eryon",
        azkar: !!f.azkar || f.appearance?.hero === "azkar",
        legion: f.faction === "legie" && !f.azkar,
        enemy: side === 2 && !!f.npc && !f.appearance?.kalidran && !f.appearance?.hero,
        boss: !!f.appearance?.boss,
        shield: f.shield,
      });
      const s = side === 1 ? -1 : 1;
      const x = cx + dir.x * 1.3 * s, z = cz + dir.y * 1.3 * s;
      fig.group.position.set(x, heightAt(x, z), z);
      fig.face(Math.atan2(-dir.x * s, -dir.y * s));
      this.scene.add(fig.group);
      this.figures.push(fig);
      this.battleFigures.push(fig);
      return fig;
    };
    const a = make(fight.f1, 1);
    const b = make(fight.f2, 2);
    if (ally) {
      const af = createFigure({ cls: "hoplit", eryon: ally === "eryon", azkar: ally === "azkar" });
      const x = cx - dir.x * 2.4 + dir.y * 1.2, z = cz - dir.y * 2.4 - dir.x * 1.2;
      af.group.position.set(x, heightAt(x, z), z);
      af.face(Math.atan2(dir.x, dir.y));
      this.scene.add(af.group);
      this.figures.push(af);
      this.battleFigures.push(af);
    }
    onEvent({ type: "start", f1: fight.f1, f2: fight.f2, hp1: fight.hp1, hp2: fight.hp2 });
    await this.wait(0.9);
    for (let i = 0; i < fight.rounds.length; i += 1) {
      if (this.battleAbort) break;
      const r = fight.rounds[i];
      const att = r.a === 1 ? a : b;
      const def = r.a === 1 ? b : a;
      const kind = att.opts.cls === "hoplit" ? "melee" : att.opts.cls === "lucistnik" ? "ranged" : "magic";
      att.attack(kind);
      await this.wait(kind === "melee" ? 0.22 : 0.3);
      if (r.e) def.evade();
      else if (r.b) def.block();
      else def.hit(r.c);
      onEvent({
        type: "round", index: i, hp1: r.h1, hp2: r.h2, attacker: r.a, damage: r.d, crit: r.c, evaded: r.e, blocked: r.b,
        at: this.project(def.group.position.clone().add(new THREE.Vector3(0, 2.1, 0))),
      });
      if ((r.a === 1 ? r.h2 : r.h1) <= 0) {
        def.die();
        break;
      }
      await this.wait(0.55);
    }
    if (!this.battleAbort) {
      (fight.winner === 1 ? a : b).cheer();
      await this.wait(1.0);
    }
    onEvent({ type: "end", winner: fight.winner });
  }

  private wait(seconds: number) {
    return new Promise<void>((resolve) => {
      if (this.battleAbort) return resolve();
      const start = performance.now();
      const tick = () => {
        if (this.battleAbort || (performance.now() - start) / 1000 >= seconds / this.battleSpeed) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  // ================================================================ kamera, smyčka
  private project(v: THREE.Vector3): ScreenPoint {
    const p = v.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: (p.x * 0.5 + 0.5) * rect.width, y: (-p.y * 0.5 + 0.5) * rect.height, visible: p.z < 1 && p.x > -1.1 && p.x < 1.1 && p.y > -1.1 && p.y < 1.1 };
  }

  private updateCamera(dt: number) {
    let look: THREE.Vector3;
    let dist: number;
    let pitch: number;
    let yaw = this.yaw;
    if (this.mode === "battle") {
      look = this.battleCenter.clone().add(new THREE.Vector3(0, 1.0, 0));
      dist = 7.2;
      pitch = 0.32;
    } else if (this.mode === "create" || this.mode === "portrait") {
      look = new THREE.Vector3(this.pos.x, heightAt(this.pos.x, this.pos.y) + 1.15, this.pos.y);
      dist = 4.6;
      pitch = 0.18;
      yaw = this.facing + 0.35;
      // hrdina mírně vlevo, aby ho nezakryl panel vpravo
      const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(this.mode === "create" ? -0.7 : 0.9);
      look.add(side);
    } else if (this.mode === "talk" && this.focus) {
      const mid = new THREE.Vector3(this.pos.x, 0, this.pos.y).add(this.focus).multiplyScalar(0.5);
      look = new THREE.Vector3(mid.x, heightAt(mid.x, mid.z) + 1.3, mid.z);
      dist = 7;
      pitch = 0.28;
    } else if (this.camMode === "third") {
      // třetí osoba: kamera za hrdinou ve výšce ramen
      look = new THREE.Vector3(this.pos.x, heightAt(this.pos.x, this.pos.y) + 1.65, this.pos.y);
      dist = this.tpDist;
      pitch = this.tpPitch;
      // při chůzi kliknutím se kamera pomalu natočí za hrdinu
      if (this.moveTarget && !this.dragging) {
        const want = this.facing + Math.PI;
        let d = want - this.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.yaw += d * Math.min(1, dt * 2.2);
      }
      yaw = this.yaw;
    } else {
      look = new THREE.Vector3(this.pos.x, heightAt(this.pos.x, this.pos.y) + 1.2, this.pos.y);
      dist = this.zoom;
      pitch = 0.82;
    }
    // plynulý přechod v kulových souřadnicích (úhel, sklon, vzdálenost) – kamera
    // při přepnutí pohledu obkrouží hrdinu, místo aby proletěla nad ním
    const k = 1 - Math.pow(0.0015, dt);
    if (!this.camInit) {
      this.camInit = true;
      this.sYaw = yaw;
      this.sPitch = pitch;
      this.sDist = dist;
      this.camLook.copy(look);
    } else {
      this.sYaw += Math.atan2(Math.sin(yaw - this.sYaw), Math.cos(yaw - this.sYaw)) * k;
      this.sPitch += (pitch - this.sPitch) * k;
      this.sDist += (dist - this.sDist) * k;
      this.camLook.lerp(look, k);
    }
    const lk = this.camLook;
    const target = new THREE.Vector3(
      lk.x + Math.sin(this.sYaw) * Math.cos(this.sPitch) * this.sDist,
      lk.y + Math.sin(this.sPitch) * this.sDist,
      lk.z + Math.cos(this.sYaw) * Math.cos(this.sPitch) * this.sDist,
    );
    // kamera nesmí pod terén (ani cestou k hrdinovi)
    const third = this.camMode === "third" && this.mode === "explore";
    let ground = heightAt(target.x, target.z) + (third ? 0.6 : 1.2);
    if (third) {
      for (let i = 1; i < 4; i += 1) {
        const t = i / 4;
        ground = Math.max(ground, heightAt(lk.x + (target.x - lk.x) * t, lk.z + (target.z - lk.z) * t) + 0.5);
      }
    }
    if (target.y < ground) target.y = ground;
    this.camPos.copy(target);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    // stíny následují hráče
    const c = this.mode === "battle" ? this.battleCenter : new THREE.Vector3(this.pos.x, 0, this.pos.y);
    this.sun.position.set(c.x - 38, 70, c.z + 22);
    this.sun.target.position.set(c.x, 0, c.z);
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer?.setSize(w, h);
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const now = performance.now();
    this.updatePlayer(dt);
    this.updateEnemies(dt, now);
    for (const o of this.others.values()) {
      const before = o.pos.clone();
      o.pos.lerp(o.target, Math.min(1, dt * 6));
      const sp = before.distanceTo(o.pos) / Math.max(dt, 1e-4);
      o.fig.setMoving(sp > 0.3 ? sp : 0);
      o.fig.face(o.ry);
      o.fig.group.position.set(o.pos.x, heightAt(o.pos.x, o.pos.y), o.pos.y);
      o.fig.group.visible = this.mode !== "battle";
    }
    this.updateCamera(dt);
    this.wildlife?.update(dt, t, this.pos, this.camera);
    for (const f of this.fires) f.update(dt, t);
    for (const fig of this.figures) fig.update(dt, t);
    this.waterNormal.offset.set(t * 0.004, t * 0.006);
    this.clickMarker.rotation.z = t;

    if (this.onFrame) {
      const npcs: Record<string, ScreenPoint> = {};
      for (const [id, n] of this.npcs) {
        const p = this.project(n.fig.group.position.clone().add(new THREE.Vector3(0, n.def.hero ? 2.6 : 2.3, 0)));
        // jmenovky jen u blízkých postav (ve třetí osobě by jinak prosvítaly z dálky)
        if (Math.hypot(n.def.x - this.pos.x, n.def.z - this.pos.y) > (this.camMode === "third" ? 28 : 45)) p.visible = false;
        npcs[id] = p;
      }
      const enemies: WorldFrame["enemies"] = [];
      for (const e of this.enemies) {
        if (!e.alive || this.mode === "battle") continue;
        if (Math.hypot(e.pos.x - this.pos.x, e.pos.y - this.pos.y) > 22) continue;
        enemies.push({ key: e.key, name: e.def.n, level: `${e.def.l[0]}–${e.def.l[1]}`, p: this.project(e.fig.group.position.clone().add(new THREE.Vector3(0, 2.2, 0))) });
      }
      const others: Record<string, ScreenPoint> = {};
      for (const [key, o] of this.others) others[key] = this.project(o.fig.group.position.clone().add(new THREE.Vector3(0, 2.2, 0)));
      this.onFrame({
        player: { x: this.pos.x, z: this.pos.y, ry: this.facing, region: regionAt(this.pos.x, this.pos.y) },
        npcs, enemies, others, near: this.mode === "explore" ? this.nearest() : null,
        safe: inSafeZone(this.pos.x, this.pos.y),
      });
    }
    if (this.composer && this.mode !== "create") this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

  /** Přepne pohled kamery (shora / třetí osoba). Klávesa V. */
  setCameraMode(mode: CameraMode) {
    this.camMode = mode;
    saveCameraMode(mode);
    if (mode === "third") this.yaw = this.facing + Math.PI;
    this.onCameraMode?.(mode);
  }
  get cameraMode() {
    return this.camMode;
  }

  /** Rozlišení vykreslování: 0.5–1 = podíl nativního rozlišení okna (výkon vs. ostrost). */
  setRenderScale(scale: number) {
    const s = Math.max(0.4, Math.min(1, scale));
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pixelRatio) * s);
    this.resize();
  }

  /** Pozice pro minimapu. */
  minimap() {
    return {
      player: { x: this.pos.x, z: this.pos.y, ry: this.facing },
      npcs: [...this.npcs.values()].map(({ def }) => ({ id: def.id, x: def.x, z: def.z })),
      enemies: this.enemies.filter((e) => e.alive).map((e) => ({ x: e.pos.x, z: e.pos.y })),
      others: [...this.others.values()].map((o) => ({ x: o.pos.x, z: o.pos.y })),
      yaw: this.yaw,
    };
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.wildlife?.dispose();
    this.unbind();
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export { assets };
