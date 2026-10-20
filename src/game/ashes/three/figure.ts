import * as THREE from "three";
import type { Appearance, HeroClass } from "../types";
import { bronzeTex, clothTex, leatherTex, muscleBump, skinTex, woodTex } from "./textures";

/**
 * Procedurální válečník doby bronzové (Kalidra). Žádné externí modely –
 * postava se skládá z jednoduchých těles, aby se dala obarvit podle výbavy,
 * povolání a vzhledu a aby se hra rychle načítala i v prohlížeči.
 */

export type FigureOptions = {
  cls: HeroClass;
  appearance?: Appearance;
  eryon?: boolean;
  /** Azkar, Syn Rudého slunce – vojevůdce Legie. */
  azkar?: boolean;
  /** Voják Legie Rudého slunce (tmavý bronz, znak rudého slunce). */
  legion?: boolean;
  enemy?: boolean;
  boss?: boolean;
  scale?: number;
  shield?: boolean;
};

type Anim = { t: number; dur: number; fn: (k: number) => void; done?: () => void };

const SKIN_DEFAULT = "#c99470";

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const textureCache = new Map<string, THREE.Texture>();

function shieldTexture(base: string, emblem: string, kind: "sun" | "eryon" | "redsun") {
  const key = `shield:${base}:${emblem}:${kind}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const tex = canvasTexture(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(110, 100, 10, 128, 128, 128);
    g.addColorStop(0, "#f1c27a");
    g.addColorStop(0.45, base);
    g.addColorStop(1, "#3a230f");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    // patina a škrábance
    for (let i = 0; i < 140; i += 1) {
      ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? "40,70,55" : "255,230,190"},${Math.random() * 0.12})`;
      ctx.lineWidth = Math.random() * 2;
      ctx.beginPath();
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 40, y + (Math.random() - 0.5) * 40);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(60,35,15,.8)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = emblem;
    ctx.strokeStyle = emblem;
    ctx.translate(128, 128);
    if (kind === "eryon") {
      // Štít Eryona: plamen nad vlnou moře – Kalidra na pobřeží.
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(-70, 40);
      for (let x = -70; x <= 70; x += 35) ctx.quadraticCurveTo(x + 17, 20, x + 35, 40);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -78);
      ctx.bezierCurveTo(40, -30, 30, 10, 0, 22);
      ctx.bezierCurveTo(-30, 10, -40, -30, 0, -78);
      ctx.fill();
    } else {
      const rays = kind === "redsun" ? 12 : 8;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 8;
      for (let i = 0; i < rays; i += 1) {
        const a = (i / rays) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 42, Math.sin(a) * 42);
        ctx.lineTo(Math.cos(a) * 80, Math.sin(a) * 80);
        ctx.stroke();
      }
    }
  });
  textureCache.set(key, tex);
  return tex;
}

function stripesTexture(a: string, b: string) {
  const key = `stripes:${a}:${b}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  const tex = canvasTexture(128, 32, (ctx) => {
    for (let i = 0; i < 16; i += 1) {
      ctx.fillStyle = i % 2 ? a : b;
      ctx.fillRect(i * 8, 0, 7, 32);
    }
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 26, 128, 6);
  });
  tex.wrapS = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

function std(color: string, metal = 0, rough = 0.8, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...extra });
}

export class Figure {
  readonly group = new THREE.Group();
  readonly root = new THREE.Group();
  readonly opts: FigureOptions;
  private torso = new THREE.Group();
  private legsL: THREE.Group[] = [];
  private legsR: THREE.Group[] = [];
  private kneesL: THREE.Group[] = [];
  private kneesR: THREE.Group[] = [];
  private moveSpeed = 0;
  private walkPhase = 0;
  private head = new THREE.Group();
  private armR = new THREE.Group();
  private armL = new THREE.Group();
  private forearmR = new THREE.Group();
  private forearmL = new THREE.Group();
  private weapon: THREE.Group | null = null;
  private shield: THREE.Group | null = null;
  private readonly restBendR = 1.25;
  private readonly restBendL = 1.0;
  private cloak: THREE.Mesh | null = null;
  private cloakBase: Float32Array | null = null;
  private flame: THREE.Sprite | null = null;
  private anims: Anim[] = [];
  private flashMats: THREE.MeshStandardMaterial[] = [];
  private phase = Math.random() * Math.PI * 2;
  private baseRot = 0;
  dead = false;

  constructor(opts: FigureOptions) {
    this.opts = opts;
    this.build();
    this.group.add(this.root);
    const s = opts.scale ?? (opts.eryon ? 1.12 : opts.azkar ? 1.15 : opts.boss ? 1.15 : 1);
    this.root.scale.setScalar(s);
    this.group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  private build() {
    const { cls, appearance = {}, eryon, azkar, legion } = this.opts;
    const enemy = !!this.opts.enemy || !!legion || !!azkar;
    const hero = eryon || azkar;
    const skinTone = appearance.skin || SKIN_DEFAULT;
    const st = skinTex();
    const skin = std(skinTone, 0, 0.62, { map: st.map, bumpMap: st.bump, bumpScale: 0.6 });
    const bronzeColor = azkar ? "#3d2c20" : legion ? "#5e4430" : this.opts.enemy ? "#4a3a2c" : eryon ? "#c58a3e" : "#a8743a";
    const bt = bronzeTex(bronzeColor, enemy ? 0.15 : 0.3);
    const bronze = std("#ffffff", 0.85, azkar ? 0.32 : enemy ? 0.5 : 0.36, { map: bt.map, bumpMap: bt.bump, bumpScale: 0.8, roughnessMap: bt.bump });
    const lt = leatherTex(enemy ? "#2e231c" : "#6a4428");
    const leather = std("#ffffff", 0, 0.85, { map: lt.map, bumpMap: lt.bump, bumpScale: 0.9 });
    const clothColor = azkar ? "#5e0d0a" : eryon ? "#8e1b14" : appearance.cloak || (enemy ? appearance.tint || "#4a1414" : "#6b2a1e");
    const ct = clothTex(clothColor);
    const cloth = std("#ffffff", 0, 0.95, { map: ct.map, bumpMap: ct.bump, bumpScale: 0.5, side: THREE.DoubleSide });
    const linen = std("#ffffff", 0, 0.92, { map: clothTex(cls === "hoplit" ? "#d8ccb0" : "#8a6a48").map, side: THREE.DoubleSide });
    const crestColor = azkar ? "#140806" : eryon ? "#b3160d" : appearance.crest || (enemy ? "#1d1d1d" : "#8a1a12");
    const hairMat = std(enemy ? "#2a2018" : "#5a3a22", 0, 0.85);
    this.flashMats.push(skin, bronze, leather, cloth, linen);

    // ---------------- nohy: kyčel (skupina) → stehno, koleno (skupina) → lýtko, sandál
    for (const side of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(0.1 * side, 0.82, 0);
      this.root.add(hip);
      (side < 0 ? this.legsR : this.legsL).push(hip);
      const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.082, 0.26, 6, 12), skin);
      thigh.position.y = -0.2;
      thigh.scale.set(1, 1, 1.08);
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.4;
      hip.add(knee);
      (side < 0 ? this.kneesR : this.kneesL).push(knee);
      const calf = new THREE.Mesh(new THREE.CapsuleGeometry(0.066, 0.24, 6, 12), skin);
      calf.position.y = -0.17;
      calf.scale.set(1, 1, 1.12);
      knee.add(calf);
      if (cls !== "vestec") {
        // holeně (knémidy) – bronz u štítonoše, kůže u ostatních
        const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.064, 0.3, 14, 1, true, -Math.PI * 0.75, Math.PI * 1.5), cls === "hoplit" ? bronze : leather);
        greave.position.set(0, -0.17, 0.006);
        knee.add(greave);
      }
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.03, 0.22), leather);
      sole.position.set(0, -0.395, 0.04);
      knee.add(sole);
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.12, 4, 8), skin);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(0, -0.36, 0.05);
      knee.add(foot);
      for (const y of [-0.33, -0.27]) {
        const strap = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.008, 4, 14), leather);
        strap.rotation.x = Math.PI / 2;
        strap.position.y = y;
        knee.add(strap);
      }
    }

    // ---------------- trup
    this.torso.position.y = 0.9;
    this.root.add(this.torso);
    if (cls === "vestec") {
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.37, 0.98, 22, 4, true), cloth);
      robe.position.y = -0.39;
      this.torso.add(robe);
      const sash = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.025, 6, 24), bronze);
      sash.rotation.x = Math.PI / 2;
      sash.position.y = 0.08;
      this.torso.add(sash);
    } else {
      // lněná tunika a pteryges – visící pruhy kůže kolem boků
      const tunic = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.32, 20, 1, true), linen);
      tunic.position.y = -0.1;
      this.torso.add(tunic);
      const strips = 14;
      for (let i = 0; i < strips; i += 1) {
        const a = (i / strips) * Math.PI * 2;
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.2, 0.012), cls === "hoplit" ? leather : linen);
        strip.position.set(Math.sin(a) * 0.235, -0.05, Math.cos(a) * 0.2);
        strip.rotation.y = a;
        strip.rotation.x = 0.12;
        this.torso.add(strip);
        const stud = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), bronze);
        stud.position.set(0, -0.08, 0.008);
        strip.add(stud);
      }
    }
    const cuirassProfile = [
      new THREE.Vector2(0.185, 0),
      new THREE.Vector2(0.205, 0.08),
      new THREE.Vector2(0.24, 0.26),
      new THREE.Vector2(0.25, 0.36),
      new THREE.Vector2(0.22, 0.48),
      new THREE.Vector2(0.13, 0.545),
      new THREE.Vector2(0.06, 0.555),
    ];
    const muscle = muscleBump();
    const cuirassMat = cls === "hoplit"
      ? std("#ffffff", 0.85, enemy ? 0.5 : 0.34, { map: bt.map, bumpMap: muscle.bump, bumpScale: 6 })
      : cls === "lucistnik"
        ? std("#ffffff", 0, 0.85, { map: lt.map, bumpMap: lt.bump, bumpScale: 0.9 })
        : cloth;
    if (cuirassMat !== cloth) this.flashMats.push(cuirassMat);
    const cuirass = new THREE.Mesh(new THREE.LatheGeometry(cuirassProfile, 28), cuirassMat);
    cuirass.scale.z = 0.78;
    cuirass.position.y = 0.06;
    this.torso.add(cuirass);
    if (cls !== "vestec") {
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.024, 6, 26), leather);
      belt.rotation.x = Math.PI / 2;
      belt.scale.y = 0.8;
      belt.position.y = 0.08;
      this.torso.add(belt);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.015), bronze);
      buckle.position.set(0, 0.08, 0.158);
      this.torso.add(buckle);
    }

    // ---------------- krk a hlava
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.062, 0.12, 12), skin);
    neck.position.y = 0.63;
    this.torso.add(neck);
    this.head.position.y = 0.77;
    this.torso.add(this.head);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skin);
    face.scale.set(0.9, 1.1, 1);
    this.head.add(face);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 10), skin);
    jaw.scale.set(1, 0.7, 1);
    jaw.position.set(0, -0.06, 0.02);
    this.head.add(jaw);
    const noseM = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 6), skin);
    noseM.rotation.x = Math.PI / 2 + 0.5;
    noseM.position.set(0, -0.005, 0.104);
    this.head.add(noseM);
    const lips = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.007, 0.01), std("#7a3a2a", 0, 0.6));
    lips.position.set(0, -0.045, 0.1);
    this.head.add(lips);
    const white = std("#e8e0d4", 0, 0.4);
    const iris = std(enemy ? "#2a1a10" : "#3a2a18", 0, 0.3);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), white);
      eye.position.set(0.037 * side, 0.018, 0.088);
      eye.scale.set(1, 0.7, 0.6);
      this.head.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), iris);
      pupil.position.set(0.037 * side, 0.018, 0.097);
      this.head.add(pupil);
      const brow = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.009, 0.012), hairMat);
      brow.position.set(0.038 * side, 0.042, 0.096);
      brow.rotation.z = -0.15 * side;
      this.head.add(brow);
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), skin);
      ear.scale.set(0.45, 1, 0.75);
      ear.position.set(0.096 * side, 0.0, -0.005);
      this.head.add(ear);
    }
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.112, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
    hair.position.set(0, 0.02, -0.022);
    hair.rotation.x = -0.35;
    hair.scale.set(0.97, 1.05, 1.05);
    this.head.add(hair);
    if (cls !== "vestec" || hero) {
      // plnovous kolem brady (ústa zůstanou vidět)
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45), hairMat);
      beard.position.set(0, -0.045, 0.045);
      beard.scale.set(1.05, 1.2, 0.85);
      this.head.add(beard);
    }

    if (cls === "hoplit") {
      // Korintská přilba: skořepina s lícnicemi a nánosníkem, otvory pro oči
      const helmProfile = [
        new THREE.Vector2(0.0, 0.17), new THREE.Vector2(0.06, 0.165), new THREE.Vector2(0.11, 0.13), new THREE.Vector2(0.13, 0.06),
        new THREE.Vector2(0.128, -0.02), new THREE.Vector2(0.118, -0.1), new THREE.Vector2(0.105, -0.15), new THREE.Vector2(0.1, -0.16),
      ];
      const helmGeo = new THREE.LatheGeometry(helmProfile, 36, Math.PI * 0.11, Math.PI * 1.78);
      const helm = new THREE.Mesh(helmGeo, bronze);
      helm.scale.set(0.98, 1.02, 1.08);
      helm.position.y = 0.0;
      this.head.add(helm);
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.018), bronze);
      nose.position.set(0, 0.0, 0.124);
      this.head.add(nose);
      // hřeben z koňských žíní: držák + vějíř z tenkých vláken
      const crestTex = canvasTexture(64, 128, (ctx) => {
        ctx.fillStyle = crestColor;
        ctx.fillRect(0, 0, 64, 128);
        for (let i = 0; i < 64; i += 1) {
          ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? "0,0,0" : "255,255,255"},${0.06 + Math.random() * 0.12})`;
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + (Math.random() - 0.5) * 6, 128);
          ctx.stroke();
        }
      });
      const crestMat = std("#ffffff", 0, 0.95, { map: crestTex, side: THREE.DoubleSide });
      const holder = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.18), bronze);
      holder.position.set(0, 0.17, -0.01);
      this.head.add(holder);
      const shape = new THREE.Shape();
      const len = hero ? 0.44 : 0.36;
      const tall = hero ? 0.15 : 0.12;
      shape.moveTo(-0.13, 0);
      shape.quadraticCurveTo(-0.12, tall, 0.02, tall + 0.02);
      shape.quadraticCurveTo(len - 0.12, tall, len - 0.1, -0.12);
      shape.quadraticCurveTo(0.12, 0.02, -0.13, 0);
      const crestGeo = new THREE.ExtrudeGeometry(shape, { depth: hero ? 0.05 : 0.04, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.008, bevelSegments: 2, curveSegments: 10 });
      crestGeo.translate(0, 0, -(hero ? 0.025 : 0.02));
      crestGeo.rotateY(-Math.PI / 2);
      const uv = crestGeo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 2);
      const crest = new THREE.Mesh(crestGeo, crestMat);
      crest.position.set(0, 0.18, 0);
      this.head.add(crest);
      this.flashMats.push(crestMat);
      if (azkar) {
        // zlatá koruna paprsků rudého slunce na přilbě vojevůdce
        const gold = std("#d8a24a", 0.9, 0.25, { emissive: "#3a1a00" });
        for (let i = 0; i < 9; i += 1) {
          const ray = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.11, 5), gold);
          const a = (i - 4) * 0.28;
          ray.position.set(Math.sin(a) * 0.12, 0.13 + Math.cos(a) * 0.02, Math.cos(a) * 0.08);
          ray.rotation.set(0.5, 0, -a * 0.9);
          this.head.add(ray);
        }
      }
    } else if (cls === "lucistnik") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), leather);
      cap.position.y = 0.045;
      this.head.add(cap);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.014, 6, 22), bronze);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.06;
      this.head.add(band);
      const flapL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.07), leather);
      for (const side of [-1, 1]) {
        const f = flapL.clone();
        f.position.set(0.1 * side, -0.03, -0.01);
        this.head.add(f);
      }
    } else {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.72), cloth);
      hood.position.set(0, 0.02, -0.025);
      hood.scale.set(1, 1.12, 1.12);
      this.head.add(hood);
      const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.112, 0.01, 6, 22), std("#e0b45a", 0.9, 0.25, { emissive: "#5a3000" }));
      circlet.rotation.x = Math.PI / 2 - 0.15;
      circlet.position.y = 0.05;
      this.head.add(circlet);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), std("#ff7a2a", 0.2, 0.2, { emissive: "#ff5a10", emissiveIntensity: 0.8 }));
      gem.position.set(0, 0.07, 0.11);
      this.head.add(gem);
    }

    // ---------------- paže
    const buildArm = (group: THREE.Group, side: number, forearm?: THREE.Group) => {
      group.position.set(0.25 * side, 0.5, 0);
      this.torso.add(group);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 10), cls === "hoplit" ? bronze : cls === "vestec" ? cloth : leather);
      shoulder.scale.set(1.2, 0.85, 1.1);
      group.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.18, 6, 12), cls === "vestec" ? cloth : skin);
      upper.position.y = -0.16;
      upper.scale.set(1, 1, 1.1);
      group.add(upper);
      const lower = forearm ?? new THREE.Group();
      lower.position.y = -0.3;
      group.add(lower);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.19, 6, 12), cls === "vestec" ? cloth : skin);
      fore.position.y = -0.13;
      lower.add(fore);
      if (cls !== "vestec") {
        const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.053, 0.13, 12, 1, true), cls === "hoplit" ? bronze : leather);
        bracer.position.y = -0.17;
        lower.add(bracer);
      }
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), skin);
      hand.scale.set(0.85, 1.05, 0.6);
      hand.position.y = -0.285;
      lower.add(hand);
      const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.013, 0.03, 3, 6), skin);
      thumb.position.set(-0.035 * side, -0.27, 0.02);
      thumb.rotation.z = 0.6 * side;
      lower.add(thumb);
      return lower;
    };
    const lowerR = buildArm(this.armR, -1, this.forearmR);
    const lowerL = buildArm(this.armL, 1, this.forearmL);
    this.armR.rotation.z = -0.12;
    this.armL.rotation.z = 0.12;
    this.forearmR.rotation.x = -this.restBendR;
    this.forearmL.rotation.x = -this.restBendL;
    this.armL.rotation.x = cls === "hoplit" || this.opts.shield ? -0.35 : -0.15;

    // ---------------- zbraně – držák v dlani kompenzuje ohnuté předloktí
    const wt = woodTex();
    const wood = std("#c8a888", 0, 0.8, { map: wt.map, bumpMap: wt.bump, bumpScale: 0.5 });
    const grip = (lower: THREE.Group, bend: number) => {
      const holder = new THREE.Group();
      holder.position.set(0, -0.28, 0.02);
      holder.rotation.x = bend;
      lower.add(holder);
      return holder;
    };
    if (cls === "hoplit") {
      this.weapon = grip(lowerR, this.restBendR);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.021, 2.3, 10), wood);
      shaft.position.y = 0.45;
      const tipShape = new THREE.LatheGeometry([new THREE.Vector2(0, 0.17), new THREE.Vector2(0.035, 0.05), new THREE.Vector2(0.03, 0.0), new THREE.Vector2(0.02, -0.06)], 8);
      const tip = new THREE.Mesh(tipShape, bronze);
      tip.scale.z = 0.35;
      tip.position.y = 1.18;
      shaft.add(tip);
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.22, 10), leather);
      wrap.position.y = -0.45;
      shaft.add(wrap);
      const butt = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.14, 8), bronze);
      butt.position.y = -1.2;
      butt.rotation.x = Math.PI;
      shaft.add(butt);
      this.weapon.add(shaft);
    } else if (cls === "lucistnik") {
      const holder = grip(lowerL, this.restBendL);
      const yaw = new THREE.Group();
      yaw.rotation.y = Math.PI / 2;
      holder.add(yaw);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.018, 8, 32, Math.PI * 0.8), wood);
      bow.rotation.z = Math.PI * 0.6;
      bow.position.x = 0.46;
      yaw.add(bow);
      const bowGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.1, 8), leather);
      bowGrip.position.set(0.0, 0, 0);
      yaw.add(bowGrip);
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.86, 4), std("#d8cfb8", 0, 0.6));
      string.position.x = 0.31;
      yaw.add(string);
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 12), leather);
      quiver.position.set(0.08, 0.35, -0.2);
      quiver.rotation.z = -0.4;
      this.torso.add(quiver);
      const fletch = std("#e8dcc0", 0, 0.9, { side: THREE.DoubleSide });
      for (let i = 0; i < 5; i += 1) {
        const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), wood);
        arrow.position.set(-0.025 + i * 0.013, 0.32, (i % 2) * 0.012);
        quiver.add(arrow);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.05), fletch);
        f.position.y = 0.09;
        arrow.add(f);
      }
    } else {
      this.weapon = grip(lowerR, this.restBendR);
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 1.7, 10), wood);
      staff.position.y = 0.3;
      this.weapon.add(staff);
      const head = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 8, 18), bronze);
      head.position.y = 0.88;
      staff.add(head);
      for (let i = 0; i < 3; i += 1) {
        const prong = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 5), bronze);
        const a = (i / 3) * Math.PI * 2;
        prong.position.set(Math.cos(a) * 0.04, 0.95, Math.sin(a) * 0.04);
        staff.add(prong);
      }
      const flameTex = canvasTexture(64, 64, (ctx) => {
        const g = ctx.createRadialGradient(32, 36, 2, 32, 32, 30);
        g.addColorStop(0, "rgba(255,240,200,1)");
        g.addColorStop(0.35, "rgba(255,150,40,.9)");
        g.addColorStop(1, "rgba(255,60,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
      });
      this.flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      this.flame.scale.set(0.3, 0.38, 1);
      this.flame.position.y = 0.98;
      staff.add(this.flame);
      const light = new THREE.PointLight("#ff8a2a", 0.8, 3, 2);
      light.position.y = 1;
      staff.add(light);
    }

    if (this.opts.shield ?? cls === "hoplit") {
      // aspis: vypouklý štít, přední strana s emblémem (rovinné UV)
      const shieldMat = std("#ffffff", 0.75, 0.38, {
        map: shieldTexture(bronzeColor, eryon ? "#2a1408" : azkar ? "#d8a24a" : enemy ? "#a8261a" : "#3a2210", eryon ? "eryon" : enemy ? "redsun" : "sun"),
        bumpMap: bt.bump,
        bumpScale: 0.6,
      });
      const R = 0.4;
      const dome = new THREE.SphereGeometry(R * 2.2, 40, 10, 0, Math.PI * 2, 0, Math.asin(R / (R * 2.2)));
      const dp = dome.attributes.position as THREE.BufferAttribute;
      const duv = dome.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < dp.count; i += 1) duv.setXY(i, dp.getX(i) / (2 * R) + 0.5, -dp.getZ(i) / (2 * R) + 0.5);
      dome.translate(0, -R * 2.2 * Math.cos(Math.asin(1 / 2.2)), 0);
      const face = new THREE.Mesh(dome, shieldMat);
      const back = new THREE.Mesh(new THREE.CircleGeometry(R, 40), leather);
      back.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.03, 10, 40), bronze);
      rim.rotation.x = Math.PI / 2;
      const shield = new THREE.Group();
      shield.add(face, back, rim);
      shield.rotation.x = Math.PI / 2;
      this.shield = new THREE.Group();
      // štít opřený o levý bok – postava zůstane vidět, při bloku se přesune před tělo
      this.shield.position.set(0.38, 0.12, 0.1);
      this.shield.rotation.y = 1.15;
      this.shield.add(shield);
      this.torso.add(this.shield);
      this.flashMats.push(shieldMat);
    }

    // ---------------- plášť
    if (cls !== "vestec" || hero) {
      const geo = new THREE.PlaneGeometry(0.58, 1.15, 10, 18);
      geo.translate(0, -0.575, 0);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        // záhyby látky
        const fold = Math.sin(x * 26) * 0.012 * (0.4 - y);
        pos.setZ(i, -Math.abs(x) * 0.35 - 0.03 * (-y) + fold);
        pos.setX(i, x * (1 + -y * 0.25));
      }
      geo.computeVertexNormals();
      this.cloakBase = Float32Array.from(pos.array as ArrayLike<number>);
      this.cloak = new THREE.Mesh(geo, cloth);
      this.cloak.position.set(0, 0.52, -0.17);
      this.cloak.rotation.x = 0.08;
      this.torso.add(this.cloak);
      const clasp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14), bronze);
      clasp.rotation.x = Math.PI / 2;
      clasp.position.set(0.17, 0.52, 0.06);
      this.torso.add(clasp);
    }
  }

  /** Natočí postavu (radiány kolem osy Y) a zapamatuje si výchozí směr. */
  face(angle: number) {
    this.baseRot = angle;
    this.root.rotation.y = angle;
  }

  private push(dur: number, fn: (k: number) => void, done?: () => void) {
    this.anims.push({ t: 0, dur, fn, done });
  }

  attack(kind: "melee" | "ranged" | "magic" = "melee") {
    const dir = this.forwardSign();
    if (kind === "melee") {
      this.push(0.42, (k) => {
        const lunge = Math.sin(k * Math.PI);
        this.root.position.z = lunge * 0.55 * dir.z;
        this.root.position.x = lunge * 0.55 * dir.x;
        this.armR.rotation.x = -lunge * 0.9;
        this.forearmR.rotation.x = -this.restBendR + lunge * 0.6;
        // hrot se sklopí z kolmé polohy dopředu
        if (this.weapon) this.weapon.rotation.x = this.restBendR + lunge * 1.87;
        this.torso.rotation.x = lunge * 0.18;
      });
    } else {
      this.push(0.42, (k) => {
        const pull = Math.sin(k * Math.PI);
        this.armR.rotation.x = -pull * 1.1;
        this.armL.rotation.x = -0.15 - pull * 1.1;
        this.torso.rotation.y = pull * 0.2;
        if (this.flame) this.flame.scale.set(0.3 + pull * 0.5, 0.38 + pull * 0.6, 1);
      });
    }
  }

  hit(crit = false) {
    const mats = this.flashMats;
    this.push(0.32, (k) => {
      const s = Math.sin(k * Math.PI);
      this.root.rotation.x = -s * (crit ? 0.3 : 0.16);
      mats.forEach((m) => m.emissive.setRGB(s * (crit ? 0.9 : 0.5), s * 0.08, 0));
    }, () => mats.forEach((m) => m.emissive.setRGB(0, 0, 0)));
  }

  evade() {
    this.push(0.36, (k) => {
      const s = Math.sin(k * Math.PI);
      this.root.position.x = s * 0.45;
      this.root.rotation.z = -s * 0.25;
    });
  }

  block() {
    this.push(0.34, (k) => {
      const s = Math.sin(k * Math.PI);
      if (this.shield) {
        this.shield.position.x = 0.38 - s * 0.36;
        this.shield.position.z = 0.1 + s * 0.3;
        this.shield.rotation.y = 1.15 * (1 - s);
      }
      this.root.rotation.x = -s * 0.08;
    });
  }

  die() {
    this.dead = true;
    this.push(0.9, (k) => {
      const e = 1 - Math.pow(1 - k, 3);
      this.root.rotation.x = -e * 1.45;
      this.root.position.y = -e * 0.15;
    });
  }

  cheer() {
    this.push(0.8, (k) => {
      const s = Math.sin(k * Math.PI);
      this.armR.rotation.x = -s * 2.6;
      this.root.position.y = s * 0.12;
    });
  }

  reset() {
    this.dead = false;
    this.anims = [];
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, this.baseRot, 0);
    this.armR.rotation.set(0, 0, -0.12);
    this.forearmR.rotation.set(-this.restBendR, 0, 0);
    if (this.weapon) this.weapon.rotation.set(this.restBendR, 0, 0);
    this.torso.rotation.set(0, 0, 0);
  }

  private forwardSign() {
    return new THREE.Vector3(Math.sin(this.baseRot), 0, Math.cos(this.baseRot));
  }

  /** Rychlost chůze (jednotky/s) – podle ní se hýbou nohy a paže. */
  setMoving(speed: number) {
    this.moveSpeed = speed;
  }

  update(dt: number, time: number) {
    const t = time + this.phase;
    if (!this.dead && this.anims.length === 0) {
      const k = Math.min(1, this.moveSpeed / 5);
      this.walkPhase += dt * (4 + this.moveSpeed * 1.6);
      const swing = Math.sin(this.walkPhase) * 0.6 * k;
      for (const leg of this.legsL) leg.rotation.x = swing;
      for (const leg of this.legsR) leg.rotation.x = -swing;
      // koleno se ohne, když noha jde dozadu (krok)
      const bendL = Math.max(0, -Math.sin(this.walkPhase - 0.6)) * 0.9 * k;
      const bendR = Math.max(0, Math.sin(this.walkPhase - 0.6)) * 0.9 * k;
      for (const kn of this.kneesL) kn.rotation.x = bendL;
      for (const kn of this.kneesR) kn.rotation.x = bendR;
      this.armR.rotation.x = swing * 0.5;
      this.root.position.y = Math.abs(Math.cos(this.walkPhase)) * 0.06 * k;
    }
    if (!this.dead) {
      this.torso.position.y = 0.9 + Math.sin(t * 1.6) * 0.008;
      this.head.rotation.y = Math.sin(t * 0.4) * 0.12;
      this.armL.rotation.z = 0.12 + Math.sin(t * 1.6) * 0.02;
    }
    if (this.cloak && this.cloakBase) {
      const pos = this.cloak.geometry.attributes.position as THREE.BufferAttribute;
      const base = this.cloakBase;
      for (let i = 0; i < pos.count; i += 1) {
        const y = base[i * 3 + 1];
        const x = base[i * 3];
        const depth = -y;
        pos.setZ(i, base[i * 3 + 2] - Math.sin(t * 2.2 + depth * 3 + x * 2) * 0.05 * depth - depth * 0.05);
      }
      pos.needsUpdate = true;
    }
    if (this.flame) {
      const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
      this.flame.material.rotation = Math.sin(t * 3) * 0.1;
      if (this.anims.length === 0) this.flame.scale.set(0.3 * f, 0.38 * f, 1);
    }
    for (let i = this.anims.length - 1; i >= 0; i -= 1) {
      const a = this.anims[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.fn(k);
      if (k >= 1) {
        this.anims.splice(i, 1);
        a.done?.();
      }
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}
