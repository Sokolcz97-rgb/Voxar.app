import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Webové demo Voxario Studia: zjednodušený editor scény nad Three.js (WebGL 2).
 * Plná verze běží nativně přes Vulkan (deferred PBR, DLSS) – tohle je jen náhled ovládání.
 */

export type ObjType = "cube" | "sphere" | "plane" | "cylinder" | "model";
export type Tool = "select" | "translate" | "rotate" | "scale";
export type ViewMode = "final" | "albedo" | "normals" | "wire";

export type SceneEntry = { id: string; name: string; type: ObjType; visible: boolean };

export type TransformSnap = {
  position: [number, number, number];
  rotation: [number, number, number]; // stupně
  scale: [number, number, number];
};

export type MaterialSnap = { color: string; metalness: number; roughness: number; emissive: number } | null;

export type EnvSettings = {
  sunAzimuth: number;
  sunElevation: number;
  sunIntensity: number;
  ambient: number;
  shadows: boolean;
  shadowRes: 1024 | 2048 | 4096;
  grid: boolean;
};

export type Stats = { fps: number; ms: number; triangles: number; drawCalls: number; objects: number; width: number; height: number };

export const DEFAULT_ENV: EnvSettings = {
  sunAzimuth: 135,
  sunElevation: 42,
  sunIntensity: 3,
  ambient: 0.6,
  shadows: true,
  shadowRes: 2048,
  grid: true,
};

const NAMES: Record<Exclude<ObjType, "model">, string> = {
  cube: "Krychle",
  sphere: "Koule",
  plane: "Rovina",
  cylinder: "Válec",
};

const DEG = Math.PI / 180;

function std(color: string, roughness = 0.5, metalness = 0, emissive = 0) {
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  if (emissive > 0) {
    m.emissive = new THREE.Color(color);
    m.emissiveIntensity = emissive;
  }
  return m;
}

function shadowAll(o: THREE.Object3D) {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

/** Ukázkové modely z Prohlížeče assetů (procedurálně, aby demo nic nestahovalo). */
export const PRESET_MODELS = ["Sloup", "Bedna", "Strom", "Voxario_Logo", "Lucerna"] as const;
export type PresetModel = (typeof PRESET_MODELS)[number];

export const PRESET_MATERIALS: Record<string, { color: string; metalness: number; roughness: number; emissive?: number }> = {
  Zlato: { color: "#e3b14f", metalness: 1, roughness: 0.25 },
  Chrom: { color: "#d9dde3", metalness: 1, roughness: 0.06 },
  Kámen: { color: "#8d877c", metalness: 0, roughness: 0.92 },
  Dřevo: { color: "#8a5a32", metalness: 0, roughness: 0.75 },
  "Lesklý plast": { color: "#d23c5a", metalness: 0, roughness: 0.18 },
  "Neon fialová": { color: "#8b5cff", metalness: 0, roughness: 0.4, emissive: 1.6 },
};

function buildPreset(name: PresetModel): THREE.Group {
  const g = new THREE.Group();
  if (name === "Sloup") {
    const stone = std("#b9b2a5", 0.85);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 1.1), stone);
    base.position.y = 0.125;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.38, 2.6, 24), stone);
    shaft.position.y = 1.55;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1, 0.22, 1), stone);
    cap.position.y = 2.96;
    g.add(base, shaft, cap);
  } else if (name === "Bedna") {
    const wood = std("#9a6a3d", 0.8);
    const dark = std("#5b3b20", 0.85);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wood);
    box.position.y = 0.5;
    g.add(box);
    for (const y of [0.06, 0.94]) {
      for (const [w, d, x, z] of [
        [1.04, 0.08, 0, 0.5],
        [1.04, 0.08, 0, -0.5],
        [0.08, 1.04, 0.5, 0],
        [0.08, 1.04, -0.5, 0],
      ]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), dark);
        b.position.set(x, y, z);
        g.add(b);
      }
    }
  } else if (name === "Strom") {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.4, 10), std("#6b4a2e", 0.9));
    trunk.position.y = 0.7;
    g.add(trunk);
    const leaf = std("#3f7d3a", 0.8);
    [
      [1.1, 1.3, 1.5],
      [0.85, 1.1, 2.15],
      [0.55, 0.9, 2.7],
    ].forEach(([r, h, y]) => {
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), leaf);
      c.position.y = y;
      g.add(c);
    });
  } else if (name === "Voxario_Logo") {
    const mat = std("#efeaff", 0.35, 0.1);
    const pts: [number, number][] = [
      [-2, 4], [-1.6, 3], [-1.2, 2], [-0.8, 1], [-0.4, 0.2], [0.4, 0.2], [0.8, 1], [1.2, 2], [1.6, 3], [2, 4], [0, -0.4],
    ];
    const geo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
    pts.forEach(([x, y]) => {
      const c = new THREE.Mesh(geo, mat);
      c.position.set(x * 0.6, y * 0.6 + 0.6, 0);
      c.rotation.set(0.35, 0.6, 0);
      g.add(c);
    });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(3.6, 3.6, 0.2), std("#5b3fd6", 0.35, 0.2, 0.25));
    plate.position.set(0, 1.75, -0.6);
    g.add(plate);
  } else if (name === "Lucerna") {
    const metal = std("#2b2b30", 0.4, 0.9);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 10), metal);
    pole.position.y = 1.2;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.34), std("#ffcf7a", 0.3, 0, 2.2));
    lamp.position.y = 2.6;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.25, 4), metal);
    roof.position.y = 2.94;
    roof.rotation.y = Math.PI / 4;
    const light = new THREE.PointLight("#ffcf7a", 6, 6, 2);
    light.position.y = 2.6;
    g.add(pole, lamp, roof, light);
  }
  shadowAll(g);
  return g;
}

function primitive(type: Exclude<ObjType, "model">, mat?: THREE.MeshStandardMaterial) {
  const m = mat ?? std("#c9c4d6", 0.45);
  let geo: THREE.BufferGeometry;
  if (type === "cube") geo = new THREE.BoxGeometry(1, 1, 1);
  else if (type === "sphere") geo = new THREE.SphereGeometry(0.5, 48, 32);
  else if (type === "cylinder") geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 40);
  else geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = type !== "plane";
  mesh.receiveShadow = true;
  return mesh;
}

export class StudioEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
  private orbit: OrbitControls;
  private gizmo: TransformControls;
  private sun = new THREE.DirectionalLight("#fff4e0", 3);
  private hemi = new THREE.HemisphereLight("#cfe0ff", "#4a4036", 0.6);
  private grid = new THREE.GridHelper(40, 40, 0x6a5acd, 0x3a3a48);
  private floor: THREE.Mesh;
  private outline = new THREE.BoxHelper(new THREE.Object3D(), 0x8b6cff);
  private objects = new Map<string, { obj: THREE.Object3D; type: ObjType }>();
  private order: string[] = [];
  private selected: string | null = null;
  private tool: Tool = "translate";
  private viewMode: ViewMode = "final";
  private renderScale = 1;
  private raf = 0;
  private ro: ResizeObserver;
  private frames = 0;
  private lastStat = performance.now();
  private lastFrame = performance.now();
  private frameMs = 0;
  private down: { x: number; y: number } | null = null;
  private gizmoDragging = false;
  private env: EnvSettings = { ...DEFAULT_ENV };
  private disposed = false;
  private overrideNormals = new THREE.MeshNormalMaterial();
  private overrideWire = new THREE.MeshBasicMaterial({ color: 0xb8a8ff, wireframe: true });

  onScene: (list: SceneEntry[]) => void = () => {};
  onSelect: (id: string | null) => void = () => {};
  onTransform: (t: TransformSnap | null) => void = () => {};
  onStats: (s: Stats) => void = () => {};

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera.position.set(6, 4.5, 7.5);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 0.8, 0);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.mouseButtons = { LEFT: null as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    this.orbit.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setSize(0.9);
    this.gizmo.addEventListener("dragging-changed", (e) => {
      this.gizmoDragging = !!(e as unknown as { value: boolean }).value;
      this.orbit.enabled = !this.gizmoDragging;
    });
    this.gizmo.addEventListener("objectChange", () => {
      this.outline.update();
      this.emitTransform();
    });
    this.scene.add(this.gizmo.getHelper());

    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -18;
    sc.right = sc.top = 18;
    sc.near = 1;
    sc.far = 80;
    this.scene.add(this.sun, this.sun.target, this.hemi);

    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2), std("#3b3a44", 0.95));
    this.floor.receiveShadow = true;
    this.floor.name = "__floor";
    this.scene.add(this.floor);
    this.grid.position.y = 0.002;
    (this.grid.material as THREE.Material).transparent = true;
    (this.grid.material as THREE.Material).opacity = 0.55;
    this.scene.add(this.grid);
    this.outline.visible = false;
    this.scene.add(this.outline);

    this.setEnv(this.env);

    // Alt + levé tlačítko = otáčení, Shift + pravé = posun (jako v editoru)
    host.addEventListener("pointerdown", this.onPointerDownCapture, true);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.loop();
  }

  // ------------------------------------------------------------ vstup
  private onPointerDownCapture = (e: PointerEvent) => {
    this.orbit.mouseButtons = {
      LEFT: (e.altKey ? THREE.MOUSE.ROTATE : null) as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: e.shiftKey ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
    };
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button === 0) this.down = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || e.button !== 0 || e.altKey || this.gizmoDragging) return;
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const roots = this.order.map((id) => this.objects.get(id)!.obj).filter((o) => o.visible);
    const hit = ray.intersectObjects(roots, true)[0];
    if (!hit) {
      this.select(null);
      return;
    }
    let o: THREE.Object3D | null = hit.object;
    while (o && !this.objects.has(o.uuid)) o = o.parent;
    this.select(o ? o.uuid : null);
  };

  // ------------------------------------------------------------ smyčka
  private resize() {
    const w = Math.max(1, this.host.clientWidth);
    const h = Math.max(1, this.host.clientHeight);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio) * this.renderScale);
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    this.frameMs = this.frameMs * 0.9 + (now - this.lastFrame) * 0.1;
    this.lastFrame = now;
    this.orbit.update();
    if (this.selected) this.outline.update();
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    if (now - this.lastStat > 500) {
      const info = this.renderer.info.render;
      const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.onStats({
        fps: Math.round((this.frames * 1000) / (now - this.lastStat)),
        ms: Math.round(this.frameMs * 10) / 10,
        triangles: info.triangles,
        drawCalls: info.calls,
        objects: this.order.length,
        width: size.x,
        height: size.y,
      });
      this.frames = 0;
      this.lastStat = now;
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.host.removeEventListener("pointerdown", this.onPointerDownCapture, true);
    this.gizmo.dispose();
    this.orbit.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ------------------------------------------------------------ scéna
  private emitScene() {
    this.onScene(
      this.order.map((id) => {
        const e = this.objects.get(id)!;
        return { id, name: e.obj.name, type: e.type, visible: e.obj.visible };
      }),
    );
  }

  private emitTransform() {
    const o = this.selected ? this.objects.get(this.selected)?.obj : null;
    if (!o) return this.onTransform(null);
    const r = (n: number) => Math.round(n * 1000) / 1000;
    this.onTransform({
      position: [r(o.position.x), r(o.position.y), r(o.position.z)],
      rotation: [Math.round(o.rotation.x / DEG * 10) / 10, Math.round(o.rotation.y / DEG * 10) / 10, Math.round(o.rotation.z / DEG * 10) / 10],
      scale: [r(o.scale.x), r(o.scale.y), r(o.scale.z)],
    });
  }

  private uniqueName(base: string) {
    const names = new Set(this.order.map((id) => this.objects.get(id)!.obj.name));
    if (!names.has(base)) return base;
    for (let i = 2; ; i++) if (!names.has(`${base} (${i})`)) return `${base} (${i})`;
  }

  private insert(obj: THREE.Object3D, type: ObjType, name: string, select = true) {
    obj.name = this.uniqueName(name);
    this.scene.add(obj);
    this.objects.set(obj.uuid, { obj, type });
    this.order.push(obj.uuid);
    this.applyViewModeTo(obj);
    this.emitScene();
    if (select) this.select(obj.uuid);
    return obj.uuid;
  }

  clear() {
    this.select(null);
    for (const id of this.order) this.scene.remove(this.objects.get(id)!.obj);
    this.objects.clear();
    this.order = [];
    this.emitScene();
  }

  add(type: Exclude<ObjType, "model">) {
    const m = primitive(type);
    const t = this.orbit.target;
    m.position.set(Math.round(t.x), type === "plane" ? 0.01 : 0.5, Math.round(t.z));
    return this.insert(m, type, NAMES[type]);
  }

  addPreset(name: PresetModel, at?: THREE.Vector3) {
    const g = buildPreset(name);
    if (at) g.position.copy(at);
    else g.position.set(Math.round(this.orbit.target.x), 0, Math.round(this.orbit.target.z));
    return this.insert(g, "model", name.replace(/_/g, " "));
  }

  async loadFile(file: File) {
    const buf = await file.arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(buf, "");
    const root = gltf.scene;
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()).length();
    if (size > 0 && (size > 20 || size < 0.2)) root.scale.multiplyScalar(3 / size);
    const b2 = new THREE.Box3().setFromObject(root);
    const c = b2.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -b2.min.y, -c.z);
    const g = new THREE.Group();
    g.add(root);
    shadowAll(g);
    return this.insert(g, "model", file.name.replace(/\.[^.]+$/, ""));
  }

  loadTemplate(t: "empty" | "pbr") {
    this.clear();
    this.setEnv(DEFAULT_ENV);
    this.camera.position.set(6, 4.5, 7.5);
    this.orbit.target.set(0, 0.8, 0);
    if (t === "empty") return;
    // řada koulí: drsnost zleva doprava, nahoře kov, dole dielektrikum
    for (let i = 0; i < 5; i++) {
      const r = 0.05 + i * 0.22;
      const metal = primitive("sphere", std("#e3b14f", r, 1));
      metal.position.set(-3 + i * 1.5, 0.5, -2.2);
      this.insert(metal, "sphere", `Kov drsnost ${r.toFixed(2)}`, false);
      const diel = primitive("sphere", std("#c8324f", r, 0));
      diel.position.set(-3 + i * 1.5, 0.5, -0.9);
      this.insert(diel, "sphere", `Plast drsnost ${r.toFixed(2)}`, false);
    }
    const chrome = primitive("cube", std("#d9dde3", 0.06, 1));
    chrome.position.set(-2.6, 0.5, 1.6);
    chrome.rotation.y = 0.5;
    this.insert(chrome, "cube", "Chromová krychle", false);
    const neon = primitive("cylinder", std("#8b5cff", 0.4, 0, 1.6));
    neon.position.set(2.8, 0.5, 1.8);
    this.insert(neon, "cylinder", "Neonový válec", false);
    const logoId = this.addPreset("Voxario_Logo", new THREE.Vector3(0, 0, 0.6));
    this.objects.get(logoId)!.obj.rotation.y = 0.55;
    this.addPreset("Sloup", new THREE.Vector3(-5.2, 0, -1.5));
    this.addPreset("Sloup", new THREE.Vector3(5.2, 0, -1.5));
    this.addPreset("Strom", new THREE.Vector3(5.5, 0, 3.2));
    this.addPreset("Lucerna", new THREE.Vector3(-4.6, 0, 2.6));
    this.addPreset("Bedna", new THREE.Vector3(1.4, 0, 3.4));
    this.select(null);
    this.camera.position.set(8, 6, 10);
    this.focus(null);
  }

  // ------------------------------------------------------------ výběr a úpravy
  select(id: string | null) {
    this.selected = id && this.objects.has(id) ? id : null;
    const o = this.selected ? this.objects.get(this.selected)!.obj : null;
    if (o) {
      this.outline.setFromObject(o);
      this.outline.visible = true;
      if (this.tool !== "select") this.gizmo.attach(o);
      else this.gizmo.detach();
    } else {
      this.outline.visible = false;
      this.gizmo.detach();
    }
    this.onSelect(this.selected);
    this.emitTransform();
  }

  setTool(t: Tool) {
    this.tool = t;
    if (t !== "select") this.gizmo.setMode(t);
    this.select(this.selected);
  }

  setSnap(on: boolean) {
    this.gizmo.setTranslationSnap(on ? 0.5 : null);
    this.gizmo.setRotationSnap(on ? 15 * DEG : null);
    this.gizmo.setScaleSnap(on ? 0.1 : null);
  }

  setTransform(id: string, t: Partial<TransformSnap>) {
    const o = this.objects.get(id)?.obj;
    if (!o) return;
    if (t.position) o.position.set(...t.position);
    if (t.rotation) o.rotation.set(t.rotation[0] * DEG, t.rotation[1] * DEG, t.rotation[2] * DEG);
    if (t.scale) o.scale.set(...t.scale);
    this.outline.update();
    this.emitTransform();
  }

  rename(id: string, name: string) {
    const o = this.objects.get(id)?.obj;
    if (!o || !name.trim()) return;
    o.name = name.trim();
    this.emitScene();
  }

  setVisible(id: string, v: boolean) {
    const o = this.objects.get(id)?.obj;
    if (!o) return;
    o.visible = v;
    this.emitScene();
  }

  remove(id: string) {
    const e = this.objects.get(id);
    if (!e) return;
    if (this.selected === id) this.select(null);
    this.scene.remove(e.obj);
    this.objects.delete(id);
    this.order = this.order.filter((x) => x !== id);
    this.emitScene();
  }

  duplicate(id: string) {
    const e = this.objects.get(id);
    if (!e) return null;
    this.applyViewModeTo(e.obj, "final");
    const copy = e.obj.clone(true);
    this.applyViewModeTo(e.obj);
    copy.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
    });
    copy.position.x += 1;
    return this.insert(copy, e.type, e.obj.name.replace(/ \(\d+\)$/, ""));
  }

  dropToGround(id: string) {
    const o = this.objects.get(id)?.obj;
    if (!o) return;
    const b = new THREE.Box3().setFromObject(o);
    o.position.y -= b.min.y;
    this.outline.update();
    this.emitTransform();
  }

  focus(id?: string | null) {
    const target = id ? this.objects.get(id)?.obj : null;
    const box = new THREE.Box3();
    if (target) box.setFromObject(target);
    else this.order.forEach((x) => box.expandByObject(this.objects.get(x)!.obj));
    if (box.isEmpty()) box.set(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1));
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(0.5, box.getSize(new THREE.Vector3()).length() * 0.5);
    const dir = this.camera.position.clone().sub(this.orbit.target).normalize();
    this.orbit.target.copy(c);
    const vfov = this.camera.fov * DEG;
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
    this.camera.position.copy(c).addScaledVector(dir, (r / Math.sin(Math.min(vfov, hfov) / 2)) * (id ? 1.05 : 0.8));
  }

  /** Materiál upravitelný v Inspektoru (jen primitiva – modely mají materiály z modelu). */
  getMaterial(id: string): MaterialSnap {
    const e = this.objects.get(id);
    if (!e || e.type === "model") return null;
    const mesh = e.obj as THREE.Mesh;
    const m = ((mesh.userData.origMat as THREE.MeshStandardMaterial) ?? mesh.material) as THREE.MeshStandardMaterial;
    return {
      color: `#${m.color.getHexString()}`,
      metalness: m.metalness,
      roughness: m.roughness,
      emissive: m.emissive.getHex() ? m.emissiveIntensity : 0,
    };
  }

  setMaterial(id: string, p: Partial<NonNullable<MaterialSnap>>) {
    const e = this.objects.get(id);
    if (!e || e.type === "model") return;
    const mesh = e.obj as THREE.Mesh;
    const m = ((mesh.userData.origMat as THREE.MeshStandardMaterial) ?? mesh.material) as THREE.MeshStandardMaterial;
    if (p.color) m.color.set(p.color);
    if (p.metalness !== undefined) m.metalness = p.metalness;
    if (p.roughness !== undefined) m.roughness = p.roughness;
    if (p.emissive !== undefined) {
      m.emissive = p.emissive > 0 ? m.color.clone() : new THREE.Color(0);
      m.emissiveIntensity = p.emissive;
    } else if (p.color && m.emissive.getHex()) m.emissive.set(p.color);
    if (this.viewMode === "albedo") this.applyViewModeTo(mesh);
  }

  materialCount(id: string) {
    const set = new Set<THREE.Material>();
    this.objects.get(id)?.obj.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) set.add(((m.userData.origMat as THREE.Material) ?? m.material) as THREE.Material);
    });
    return set.size;
  }

  // ------------------------------------------------------------ prostředí a zobrazení
  setEnv(env: EnvSettings) {
    this.env = { ...env };
    const az = env.sunAzimuth * DEG;
    const el = Math.max(2, env.sunElevation) * DEG;
    const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    this.sun.position.copy(dir.multiplyScalar(30));
    this.sun.intensity = env.sunIntensity;
    const warm = new THREE.Color("#ffb070").lerp(new THREE.Color("#fff4e0"), Math.min(1, env.sunElevation / 35));
    this.sun.color.copy(warm);
    this.hemi.intensity = env.ambient;
    this.scene.environmentIntensity = 0.25 + env.ambient * 0.6;
    this.sun.castShadow = env.shadows;
    if (this.sun.shadow.mapSize.x !== env.shadowRes) {
      this.sun.shadow.mapSize.set(env.shadowRes, env.shadowRes);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    }
    this.grid.visible = env.grid;
    const day = Math.min(1, Math.max(0, env.sunElevation / 40));
    const sky = new THREE.Color("#1d1830").lerp(new THREE.Color("#8fb3e3"), day);
    this.scene.background = sky;
    this.scene.fog = new THREE.Fog(sky, 35, 120);
  }

  setRenderScale(s: number) {
    this.renderScale = s;
    this.resize();
  }

  private applyViewModeTo(root: THREE.Object3D, mode: ViewMode = this.viewMode) {
    root.traverse((c) => {
      const m = c as THREE.Mesh;
      if (!m.isMesh) return;
      if (m.userData.origMat) {
        if (m.material !== this.overrideNormals && m.material !== this.overrideWire) (m.material as THREE.Material).dispose();
        m.material = m.userData.origMat;
        delete m.userData.origMat;
      }
      if (mode === "final") return;
      const src = m.material as THREE.MeshStandardMaterial;
      m.userData.origMat = src;
      m.material =
        mode === "normals"
          ? this.overrideNormals
          : mode === "wire"
            ? this.overrideWire
            : new THREE.MeshBasicMaterial({ color: src.color ?? 0xffffff, map: src.map ?? null });
    });
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
    for (const id of this.order) this.applyViewModeTo(this.objects.get(id)!.obj);
    this.applyViewModeTo(this.floor);
  }
}
