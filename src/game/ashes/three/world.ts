import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Figure } from "./figure";
import type { Appearance, Fight, Fighter, HeroClass, PresenceHero } from "../types";

/**
 * 3D svět Bezejmenného břehu. Malířské pozadí (wallpaper Kalidry) tvoří
 * vzdálenou krajinu, popředí je skutečná 3D scéna: skály, ruiny, oheň,
 * moře, hrdinové a souboje. Vše procedurálně, bez externích modelů.
 */

export type LocationId = "krcma" | "kovarna" | "arena" | "hradby" | "bard" | "postava";
export type ViewMode = "hub" | "portrait" | "battle" | "create";

export const LOCATIONS: { id: LocationId; label: string; pos: [number, number, number] }[] = [
  { id: "krcma", label: "Krčma", pos: [-3.4, 2.3, -0.6] },
  { id: "kovarna", label: "Kovárna", pos: [3.3, 1.9, 0.1] },
  { id: "arena", label: "Aréna", pos: [-2.2, 1.9, -4.4] },
  { id: "hradby", label: "Hradby a Eryon", pos: [2.7, 3.2, -4.6] },
  { id: "bard", label: "Bard u ohně", pos: [-1.0, 1.45, 1.0] },
  { id: "postava", label: "Tvůj hrdina", pos: [1.0, 2.3, 3.0] },
];

export type ScreenPoint = { x: number; y: number; visible: boolean };
export type FrameAnchors = { locations: Record<string, ScreenPoint>; others: Record<string, ScreenPoint>; eryon: ScreenPoint | null };

export type BattleEvent =
  | { type: "start"; f1: Fighter; f2: Fighter; hp1: number; hp2: number }
  | { type: "round"; index: number; hp1: number; hp2: number; attacker: 1 | 2; damage: number; crit: boolean; evaded: boolean; blocked: boolean; at: ScreenPoint }
  | { type: "end"; winner: 1 | 2 };

const VIEWS: Record<ViewMode, { pos: THREE.Vector3; look: THREE.Vector3; fov: number }> = {
  hub: { pos: new THREE.Vector3(0.3, 2.5, 9.6), look: new THREE.Vector3(0, 1.45, -2), fov: 44 },
  portrait: { pos: new THREE.Vector3(2.0, 1.6, 6.3), look: new THREE.Vector3(1.4, 1.15, 3.0), fov: 30 },
  battle: { pos: new THREE.Vector3(0, 2.0, 7.4), look: new THREE.Vector3(0, 1.05, 1.6), fov: 38 },
  create: { pos: new THREE.Vector3(0.2, 1.7, 7.6), look: new THREE.Vector3(0.35, 1.15, 3.0), fov: 32 },
};

function rand(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function noise2(x: number, z: number) {
  return (
    Math.sin(x * 0.35 + z * 0.21) * 0.6 +
    Math.sin(x * 0.9 - z * 0.7) * 0.25 +
    Math.sin(x * 2.1 + z * 1.7) * 0.08 +
    (rand(Math.floor(x * 3) * 31 + Math.floor(z * 3)) - 0.5) * 0.06
  );
}

function glowTexture(inner: string, outer: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(0.4, outer);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

class Fire {
  readonly group = new THREE.Group();
  private sprites: { s: THREE.Sprite; life: number; speed: number; x: number; z: number }[] = [];
  private light: THREE.PointLight;
  private size: number;

  constructor(size = 1, tex: THREE.Texture) {
    this.size = size;
    for (let i = 0; i < 18; i += 1) {
      const mat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: new THREE.Color().setHSL(0.06 + Math.random() * 0.04, 1, 0.55) });
      const s = new THREE.Sprite(mat);
      this.group.add(s);
      this.sprites.push({ s, life: Math.random(), speed: 0.6 + Math.random() * 0.6, x: (Math.random() - 0.5) * 0.3 * size, z: (Math.random() - 0.5) * 0.3 * size });
    }
    this.light = new THREE.PointLight("#ff8a3a", 2.4 * size, 5 * size, 1.6);
    this.light.position.y = 0.5 * size;
    this.light.castShadow = false;
    this.group.add(this.light);
  }

  update(dt: number, t: number) {
    for (const p of this.sprites) {
      p.life += dt * p.speed;
      if (p.life > 1) {
        p.life = 0;
        p.x = (Math.random() - 0.5) * 0.3 * this.size;
        p.z = (Math.random() - 0.5) * 0.3 * this.size;
      }
      const k = p.life;
      const scale = (0.55 - k * 0.4) * this.size;
      p.s.position.set(p.x * (1 - k), k * 0.9 * this.size, p.z * (1 - k));
      p.s.scale.set(scale, scale * 1.3, 1);
      p.s.material.opacity = Math.sin(k * Math.PI) * 0.9;
    }
    this.light.intensity = (2.2 + Math.sin(t * 11) * 0.3 + Math.sin(t * 17.3) * 0.2) * this.size;
  }
}

export class AshesWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
  private container: HTMLElement;
  private clock = new THREE.Clock();
  private raf = 0;
  private fires: Fire[] = [];
  private figures: Figure[] = [];
  private player: Figure | null = null;
  private eryon: Figure | null = null;
  private others = new Map<string, Figure>();
  private battleFigures: Figure[] = [];
  private embers: THREE.Points;
  private sea: THREE.Mesh;
  private seaBase: Float32Array;
  private hitAreas: THREE.Mesh[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(-9, -9);
  private view: ViewMode = "hub";
  private camFrom = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 42 };
  private camTo = VIEWS.hub;
  private camK = 1;
  private currentLook = VIEWS.hub.look.clone();
  private resizeObserver: ResizeObserver;
  private hovered: LocationId | null = null;
  private battleSpeed = 1;
  private battleAbort = false;
  private backdrop: THREE.Mesh;
  private flicker: THREE.Sprite[] = [];
  onFrame: ((anchors: FrameAnchors) => void) | null = null;
  onHover: ((id: LocationId | null) => void) | null = null;
  onSelect: ((id: LocationId) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.style.display = "block";
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color("#15110f");
    // Odrazy prostředí – bez nich by bronz působil černě.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    pmrem.dispose();
    this.scene.fog = new THREE.Fog("#2b2724", 11, 26);

    const fireTex = glowTexture("rgba(255,244,214,1)", "rgba(255,120,30,.85)");
    this.backdrop = this.buildBackdrop();
    this.buildLights();
    this.buildGround();
    this.sea = this.buildSea();
    this.seaBase = Float32Array.from((this.sea.geometry.attributes.position as THREE.BufferAttribute).array as ArrayLike<number>);
    this.buildRuins(fireTex);
    this.embers = this.buildEmbers();
    this.buildHitAreas();

    this.eryon = new Figure({ cls: "hoplit", eryon: true });
    this.eryon.group.position.set(2.75, 0, -4.1);
    this.eryon.face(-0.25);
    this.scene.add(this.eryon.group);
    this.figures.push(this.eryon);

    this.camera.position.copy(VIEWS.hub.pos);
    this.camera.lookAt(VIEWS.hub.look);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.renderer.domElement.addEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.addEventListener("pointerleave", this.handlePointerLeave);
    this.renderer.domElement.addEventListener("click", this.handleClick);
    this.loop();
  }

  private buildBackdrop() {
    const tex = new THREE.TextureLoader().load("/game/eryon/shore.webp");
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    plane.position.set(0, 0, -40);
    plane.renderOrder = -10;
    this.scene.add(plane);
    return plane;
  }

  /** Pozadí pokrývá celý výhled kamery (cover) a horizont malby sedí na horizont scény. */
  private fitBackdrop() {
    const dist = this.camera.position.z - this.backdrop.position.z;
    const h = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * dist;
    const w = h * this.camera.aspect;
    const imgAspect = 1672 / 941;
    let pw = w * 1.08;
    let ph = pw / imgAspect;
    if (ph < h * 1.08) {
      ph = h * 1.08;
      pw = ph * imgAspect;
    }
    this.backdrop.scale.set(pw, ph, 1);
    this.backdrop.position.y = this.camera.position.y + ph * 0.06;
    this.backdrop.position.x = this.camera.position.x;
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight("#7a7680", "#16110e", 0.65));
    const sun = new THREE.DirectionalLight("#ffb072", 1.8);
    sun.position.set(9, 7, -9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -9;
    sun.shadow.camera.right = 9;
    sun.shadow.camera.top = 9;
    sun.shadow.camera.bottom = -9;
    sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0008;
    sun.target.position.set(0, 0, 0);
    this.scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight("#7d8fb0", 0.85);
    fill.position.set(-5, 6, 12);
    this.scene.add(fill);
  }

  private buildGround() {
    const geo = new THREE.PlaneGeometry(40, 30, 160, 120);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i) - 4; // světové z (síť je posunutá o -4)
      // hrací plocha je rovná, okraje skalnaté; za z < -8 plošina padá k pobřeží (malba)
      const center = Math.min(1, Math.hypot(x * 0.5, (z - 0.5) * 0.65) / 4.6);
      let y = noise2(x, z) * 0.22 * center + Math.max(0, center - 0.75) * Math.abs(noise2(x * 1.6, z * 1.2)) * 1.1;
      if (z < -8) y -= Math.pow(-8 - z, 1.6) * 0.35;
      if (Math.abs(x) > 8) y += (Math.abs(x) - 8) * 0.25;
      pos.setY(i, y);
      const v = 0.075 + noise2(x * 2.3, z * 2.1) * 0.018 + rand(i) * 0.02;
      c.setRGB(v * 1.12, v * 1.02, v * 0.92);
      const onPath = Math.abs(x - 2.0 + z * 0.12) < 0.8 && z < 5 && z > -9;
      if (onPath) c.setRGB(v * 1.35, v * 1.28, v * 1.18);
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0 }));
    ground.position.z = -4;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private buildSea() {
    const geo = new THREE.PlaneGeometry(30, 40, 60, 60);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: "#1d2a33", roughness: 0.22, metalness: 0.55, flatShading: true });
    const sea = new THREE.Mesh(geo, mat);
    sea.position.set(-23, -1.25, -8);
    sea.visible = false; // moře je součástí malby v pozadí
    this.scene.add(sea);
    return sea;
  }

  private buildRuins(fireTex: THREE.Texture) {
    const stone = new THREE.MeshStandardMaterial({ color: "#6e665c", roughness: 0.9, flatShading: true });
    const darkStone = new THREE.MeshStandardMaterial({ color: "#3e3832", roughness: 0.95, flatShading: true });
    const add = (mesh: THREE.Mesh) => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return mesh;
    };

    // Kamenná cesta ke Kalidře
    for (let i = 0; i < 26; i += 1) {
      const z = 4.5 - i * 0.62;
      const x = 2.0 + z * -0.12 + (rand(i) - 0.5) * 0.6;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.7 + rand(i + 3) * 0.5, 0.08, 0.5 + rand(i + 7) * 0.2), i % 3 ? stone : darkStone);
      slab.position.set(x, 0.02, z);
      slab.rotation.y = (rand(i + 11) - 0.5) * 0.4;
      add(slab);
    }

    // Zlomené sloupy staré Kalidry
    const columns: [number, number, number][] = [
      [-5.6, -3.0, 2.4], [-4.6, -6.6, 3.2], [5.6, -3.2, 1.6], [6.2, -6.8, 3.6], [7.0, 1.0, 1.1], [-7.0, 1.4, 0.8], [-1.2, -8.2, 2.2],
    ];
    columns.forEach(([x, z, h], i) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.33, h, 12), stone);
      col.position.set(x, h / 2 + 0.2, z);
      col.rotation.z = (rand(i) - 0.5) * 0.08;
      add(col);
      const top = new THREE.Mesh(new THREE.DodecahedronGeometry(0.31, 0), stone);
      top.scale.set(1, 0.45, 1);
      top.position.set(x, h + 0.2, z);
      top.rotation.set(rand(i) * 0.6, rand(i + 4) * 3, 0.3);
      add(top);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.85), darkStone);
      base.position.set(x, 0.12, z);
      add(base);
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + rand(i + 2) * 0.18, 0), stone);
      chunk.position.set(x + 0.6, 0.15, z + 0.4);
      chunk.rotation.set(rand(i), rand(i + 1), 0);
      add(chunk);
    });

    // Oblouk staré brány s korouhví (hradby a Eryon)
    const archX = 3.3;
    const archZ = -5.6;
    for (const dx of [-1.15, 1.15]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 2.7, 4), stone);
      p.rotation.y = Math.PI / 4;
      p.position.set(archX + dx, 1.35, archZ);
      add(p);
    }
    const arc = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.26, 4, 14, Math.PI), stone);
    arc.position.set(archX, 2.7, archZ);
    add(arc);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 4.2, 8), new THREE.MeshStandardMaterial({ color: "#2a1d14", roughness: 0.8 }));
    pole.position.set(archX + 1.9, 2.1, archZ + 0.5);
    add(pole);
    const bannerGeo = new THREE.PlaneGeometry(0.75, 1.7, 4, 10);
    const bp = bannerGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i += 1) {
      const y = bp.getY(i);
      if (y < -0.7) bp.setY(i, y + (Math.abs(bp.getX(i)) < 0.1 ? -0.25 : 0));
    }
    const banner = new THREE.Mesh(bannerGeo, new THREE.MeshStandardMaterial({ color: "#6a1610", roughness: 0.95, side: THREE.DoubleSide }));
    banner.position.set(archX + 1.5, 3.2, archZ + 0.5);
    add(banner);

    // Krčma: plachtový stan s lucernou
    const tentMat = new THREE.MeshStandardMaterial({ color: "#5a4c3c", roughness: 0.95, side: THREE.DoubleSide, flatShading: true });
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.6, 2.2, 6, 1, true), tentMat);
    tent.position.set(-3.6, 1.1, -0.9);
    add(tent);
    const tentPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6), darkStone);
    tentPole.position.set(-3.6, 1.3, -0.9);
    add(tentPole);
    const lantern = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: "#ffb35a" }));
    lantern.position.set(-2.5, 1.35, 0.25);
    lantern.scale.set(0.5, 0.5, 1);
    this.scene.add(lantern);
    this.flicker.push(lantern);
    const lanternLight = new THREE.PointLight("#ffa04a", 3, 5, 2);
    lanternLight.position.copy(lantern.position);
    this.scene.add(lanternLight);
    for (let i = 0; i < 3; i += 1) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.48, 12), new THREE.MeshStandardMaterial({ color: "#6a4a30", roughness: 0.85 }));
      barrel.position.set(-2.6 - i * 0.5, 0.25, 0.4 + (i % 2) * 0.3);
      add(barrel);
    }

    // Kovárna: kovadlina a výheň
    const anvil = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: "#3a3a3c", metalness: 0.8, roughness: 0.4 });
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.28), metal);
    a1.position.y = 0.62;
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.22), metal);
    a2.position.y = 0.38;
    const a3 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.22, 10), new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.9 }));
    a3.position.y = 0.11;
    anvil.add(a1, a2, a3);
    anvil.position.set(3.0, 0, 0.6);
    anvil.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(anvil);
    const forge = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.0), darkStone);
    forge.position.set(4.1, 0.45, -0.3);
    add(forge);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.5), new THREE.MeshStandardMaterial({ color: "#5a1a08", emissive: "#d2400c", emissiveIntensity: 0.9, roughness: 0.9 }));
    coals.position.set(4.1, 0.92, -0.3);
    this.scene.add(coals);
    const forgeFire = new Fire(0.7, fireTex);
    forgeFire.group.position.set(4.1, 0.92, -0.3);
    this.scene.add(forgeFire.group);
    this.fires.push(forgeFire);

    // Aréna: kruh menhirů
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      const h = 1.1 + rand(i + 40) * 0.9;
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), stone);
      m.scale.set(0.95, h * 1.15, 0.75);
      m.material = darkStone;
      m.position.set(-2.2 + Math.cos(a) * 1.9, h / 2, -4.6 + Math.sin(a) * 1.2);
      m.rotation.y = -a;
      m.rotation.z = (rand(i) - 0.5) * 0.15;
      add(m);
    }

    // Táborový oheň uprostřed
    for (let i = 0; i < 10; i += 1) {
      const a = (i / 10) * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), darkStone);
      rock.position.set(-1.0 + Math.cos(a) * 0.55, 0.08, 1.0 + Math.sin(a) * 0.55);
      add(rock);
    }
    for (let i = 0; i < 4; i += 1) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 6), new THREE.MeshStandardMaterial({ color: "#2a1a10", roughness: 1 }));
      log.position.set(-1.0, 0.12, 1.0);
      log.rotation.set(Math.PI / 2 - 0.3, (i / 4) * Math.PI, 0);
      add(log);
    }
    const campfire = new Fire(1.15, fireTex);
    campfire.group.position.set(-1.0, 0.1, 1.0);
    this.scene.add(campfire.group);
    this.fires.push(campfire);
    const lyre = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: "#c9a45c", metalness: 0.8, roughness: 0.3 });
    const arm1 = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 12, Math.PI), gold);
    arm1.rotation.z = Math.PI;
    arm1.position.y = 0.25;
    lyre.add(arm1);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.36, 6), gold);
    bar.rotation.z = Math.PI / 2;
    bar.position.y = 0.08;
    lyre.add(bar);
    lyre.position.set(-1.9, 0.25, 1.5);
    lyre.rotation.set(-0.5, 0.4, 0.2);
    this.scene.add(lyre);

    // Kameny a balvany na okrajích
    for (let i = 0; i < 40; i += 1) {
      const side = i % 2 ? 1 : -1;
      const x = side * (4 + rand(i) * 7);
      const z = -10 + rand(i + 100) * 16;
      if (Math.abs(x - 2.2) < 1 && z < 4) continue;
      const r = 0.2 + rand(i + 9) * 0.7;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rand(i + 5) > 0.5 ? stone : darkStone);
      rock.position.set(x, r * 0.4 + noise2(x, z) * 0.2, z);
      rock.rotation.set(rand(i + 1) * 3, rand(i + 2) * 3, 0);
      rock.scale.y = 0.6 + rand(i + 3) * 0.6;
      add(rock);
    }

    // Suchá tráva
    const grassMat = new THREE.MeshStandardMaterial({ color: "#57492c", roughness: 1, side: THREE.DoubleSide });
    const blade = new THREE.ConeGeometry(0.014, 0.32, 3);
    blade.translate(0, 0.16, 0);
    const grass = new THREE.InstancedMesh(blade, grassMat, 900);
    const m = new THREE.Matrix4();
    let n = 0;
    for (let i = 0; i < 4000 && n < 900; i += 1) {
      const x = (rand(i + 500) - 0.5) * 18;
      const z = -9 + rand(i + 900) * 15;
      if (Math.hypot(x, z - 1) < 3.2) continue;
      m.compose(new THREE.Vector3(x, 0.02, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rand(i) - 0.5) * 0.6, rand(i) * 3, (rand(i + 1) - 0.5) * 0.6)), new THREE.Vector3(1, 0.6 + rand(i + 2), 1));
      grass.setMatrixAt(n, m);
      n += 1;
    }
    grass.count = n;
    this.scene.add(grass);
  }

  private buildEmbers() {
    const count = 260;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      pos[i * 3] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = -8 + Math.random() * 14;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.07,
      map: glowTexture("rgba(255,220,160,1)", "rgba(255,110,30,.8)"),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      color: "#ffae5c",
    });
    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    return points;
  }

  private buildHitAreas() {
    for (const loc of LOCATIONS) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
      mesh.position.set(loc.pos[0], 1.1, loc.pos[2]);
      mesh.userData.location = loc.id;
      this.scene.add(mesh);
      this.hitAreas.push(mesh);
    }
  }

  private handlePointerMove = (event: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  };

  private handlePointerLeave = () => {
    this.pointer.set(-9, -9);
  };

  private handleClick = () => {
    if (this.view !== "hub" || !this.hovered) return;
    this.onSelect?.(this.hovered);
  };

  setPlayer(cls: HeroClass, appearance: Appearance, isEryon: boolean, shield: boolean) {
    if (this.player) {
      this.scene.remove(this.player.group);
      this.player.dispose();
      this.figures = this.figures.filter((f) => f !== this.player);
    }
    this.player = new Figure({ cls, appearance, eryon: isEryon, shield });
    this.player.group.position.set(1.0, 0, 3.0);
    this.player.face(-0.2);
    this.player.group.visible = this.view !== "battle";
    this.scene.add(this.player.group);
    this.figures.push(this.player);
    if (this.eryon) this.eryon.group.visible = !isEryon && this.view !== "battle";
  }

  setOthers(heroes: PresenceHero[]) {
    const keep = new Set(heroes.map((h) => h.key));
    for (const [key, fig] of this.others) {
      if (!keep.has(key)) {
        this.scene.remove(fig.group);
        fig.dispose();
        this.figures = this.figures.filter((f) => f !== fig);
        this.others.delete(key);
      }
    }
    heroes.slice(0, 10).forEach((hero, index) => {
      let fig = this.others.get(hero.key);
      if (!fig) {
        fig = new Figure({ cls: hero.cls, appearance: hero.appearance, eryon: hero.eryon });
        this.others.set(hero.key, fig);
        this.figures.push(fig);
        this.scene.add(fig.group);
      }
      const a = Math.PI * 0.85 + (index / 10) * Math.PI * 1.3;
      const r = 1.9 + (index % 2) * 0.5;
      fig.group.position.set(-1.0 + Math.cos(a) * r, 0, 1.0 + Math.sin(a) * r * 0.75);
      fig.face(Math.atan2(-1.0 - fig.group.position.x, 1.0 - fig.group.position.z));
      fig.group.visible = this.view !== "battle";
    });
  }

  setView(mode: ViewMode) {
    this.view = mode;
    this.camFrom = { pos: this.camera.position.clone(), look: this.currentLook.clone(), fov: this.camera.fov };
    this.camTo = VIEWS[mode];
    this.camK = 0;
    const hubVisible = mode !== "battle";
    if (this.player) this.player.group.visible = hubVisible;
    if (this.eryon) this.eryon.group.visible = hubVisible && mode !== "create" && !(this.player?.opts.eryon);
    for (const fig of this.others.values()) fig.group.visible = hubVisible;
    if (mode !== "battle") this.clearBattle();
  }

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

  /** Přehraje souboj vypočtený serverem. */
  async playFight(fight: Fight, onEvent: (e: BattleEvent) => void, allyEryon = false) {
    this.setView("battle");
    this.clearBattle();
    this.battleAbort = false;
    this.battleSpeed = 1;
    const make = (f: Fighter, side: 1 | 2) => {
      const fig = new Figure({
        cls: f.class,
        appearance: f.appearance ?? {},
        eryon: !!f.eryon,
        enemy: side === 2 && !!f.npc,
        boss: !!f.appearance?.boss,
        shield: f.shield,
      });
      fig.group.position.set(side === 1 ? -1.25 : 1.25, 0, 1.7);
      fig.face(side === 1 ? Math.PI / 2 - 0.25 : -Math.PI / 2 + 0.25);
      this.scene.add(fig.group);
      this.figures.push(fig);
      this.battleFigures.push(fig);
      return fig;
    };
    const a = make(fight.f1, 1);
    const b = make(fight.f2, 2);
    if (allyEryon) {
      const ally = new Figure({ cls: "hoplit", eryon: true });
      ally.group.position.set(-2.3, 0, 1.0);
      ally.face(Math.PI / 2 - 0.4);
      this.scene.add(ally.group);
      this.figures.push(ally);
      this.battleFigures.push(ally);
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
        type: "round",
        index: i,
        hp1: r.h1,
        hp2: r.h2,
        attacker: r.a,
        damage: r.d,
        crit: r.c,
        evaded: r.e,
        blocked: r.b,
        at: this.project(new THREE.Vector3().copy(def.group.position).add(new THREE.Vector3(0, 2.05, 0))),
      });
      if ((r.a === 1 ? r.h2 : r.h1) <= 0) {
        def.die();
        break;
      }
      await this.wait(0.55);
    }
    const winner = fight.winner;
    if (!this.battleAbort) {
      (winner === 1 ? a : b).cheer();
      await this.wait(1.0);
    }
    onEvent({ type: "end", winner });
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

  private project(v: THREE.Vector3): ScreenPoint {
    const p = v.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (p.x * 0.5 + 0.5) * rect.width,
      y: (-p.y * 0.5 + 0.5) * rect.height,
      visible: p.z < 1 && p.x > -1.1 && p.x < 1.1 && p.y > -1.1 && p.y < 1.1,
    };
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitBackdrop();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (document.hidden) return;
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;

    if (this.camK < 1) {
      this.camK = Math.min(1, this.camK + dt * 1.4);
      const k = 1 - Math.pow(1 - this.camK, 3);
      this.camera.position.lerpVectors(this.camFrom.pos, this.camTo.pos, k);
      this.currentLook.lerpVectors(this.camFrom.look, this.camTo.look, k);
      this.camera.fov = THREE.MathUtils.lerp(this.camFrom.fov, this.camTo.fov, k);
      this.camera.updateProjectionMatrix();
      this.fitBackdrop();
    } else if (this.view === "hub") {
      // jemné „dýchání“ kamery
      this.camera.position.x = this.camTo.pos.x + Math.sin(t * 0.15) * 0.25;
      this.camera.position.y = this.camTo.pos.y + Math.sin(t * 0.21) * 0.06;
    }
    this.camera.lookAt(this.currentLook);

    for (const fire of this.fires) fire.update(dt, t);
    for (const fig of this.figures) fig.update(dt, t);
    for (const s of this.flicker) if (s.material) s.material.opacity = 0.75 + Math.sin(t * 9 + s.id) * 0.2;

    const ep = this.embers.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < ep.count; i += 1) {
      let y = ep.getY(i) + dt * (0.25 + (i % 7) * 0.05);
      let x = ep.getX(i) + Math.sin(t * 0.7 + i) * dt * 0.25 + dt * 0.12;
      if (y > 7) {
        y = 0;
        x = (Math.random() - 0.5) * 18;
      }
      ep.setXY(i, x, y);
    }
    ep.needsUpdate = true;

    const sp = this.sea.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i += 1) {
      const x = this.seaBase[i * 3];
      const z = this.seaBase[i * 3 + 2];
      sp.setY(i, Math.sin(x * 0.6 + t * 1.1) * 0.12 + Math.sin(z * 0.9 + t * 0.8) * 0.1);
    }
    sp.needsUpdate = true;
    this.sea.geometry.computeVertexNormals();

    if (this.view === "hub") {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.hitAreas, false)[0];
      const id = (hit?.object.userData.location as LocationId | undefined) ?? null;
      if (id !== this.hovered) {
        this.hovered = id;
        this.renderer.domElement.style.cursor = id ? "pointer" : "default";
        this.onHover?.(id);
      }
    }

    if (this.onFrame) {
      const locations: Record<string, ScreenPoint> = {};
      for (const loc of LOCATIONS) locations[loc.id] = this.project(new THREE.Vector3(...loc.pos));
      const others: Record<string, ScreenPoint> = {};
      for (const [key, fig] of this.others) others[key] = this.project(fig.group.position.clone().add(new THREE.Vector3(0, 2.15, 0)));
      const eryon = this.eryon && this.eryon.group.visible ? this.project(this.eryon.group.position.clone().add(new THREE.Vector3(0, 2.4, 0))) : null;
      this.onFrame({ locations, others, eryon });
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener("pointermove", this.handlePointerMove);
    this.renderer.domElement.removeEventListener("pointerleave", this.handlePointerLeave);
    this.renderer.domElement.removeEventListener("click", this.handleClick);
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
