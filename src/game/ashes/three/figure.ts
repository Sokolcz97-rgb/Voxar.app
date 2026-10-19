import * as THREE from "three";
import type { Appearance, HeroClass } from "../types";

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
    const skin = std(appearance.skin || SKIN_DEFAULT, 0, 0.75);
    const bronzeColor = azkar ? "#3d2c20" : legion ? "#5e4430" : this.opts.enemy ? "#4a3a2c" : eryon ? "#c58a3e" : "#a8743a";
    const bronze = std(bronzeColor, 0.85, azkar ? 0.3 : enemy ? 0.5 : 0.32);
    const leather = std(enemy ? "#2a1f19" : "#5a3a22", 0, 0.9);
    const cloth = std(azkar ? "#5e0d0a" : eryon ? "#8e1b14" : appearance.cloak || (enemy ? appearance.tint || "#4a1414" : "#6b2a1e"), 0, 0.95, { side: THREE.DoubleSide });
    const crestColor = azkar ? "#140806" : eryon ? "#b3160d" : appearance.crest || (enemy ? "#1d1d1d" : "#8a1a12");
    this.flashMats.push(skin, bronze, leather, cloth);

    // Nohy
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.62, 4, 10), skin);
      leg.position.set(0.1 * side, 0.43, 0);
      this.root.add(leg);
      const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.075, 0.34, 12, 1, true), cls === "hoplit" ? bronze : leather);
      greave.position.set(0.1 * side, 0.27, 0.005);
      this.root.add(greave);
      const sandal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.22), leather);
      sandal.position.set(0.1 * side, 0.025, 0.04);
      this.root.add(sandal);
    }

    // Trup
    this.torso.position.y = 0.9;
    this.root.add(this.torso);
    if (cls === "vestec") {
      const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.95, 18, 1, true), cloth);
      robe.position.y = -0.38;
      this.torso.add(robe);
      const sash = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.025, 6, 20), bronze);
      sash.rotation.x = Math.PI / 2;
      sash.position.y = 0.08;
      this.torso.add(sash);
    } else {
      const skirtTex = stripesTexture(cls === "hoplit" ? "#b9a888" : "#6a4a2c", cls === "hoplit" ? "#8a785a" : "#4c341f");
      const skirt = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.28, 0.3, 18, 1, true),
        std("#ffffff", 0, 0.9, { map: skirtTex, side: THREE.DoubleSide }),
      );
      skirt.position.y = -0.06;
      this.torso.add(skirt);
    }
    const cuirassProfile = [
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.2, 0.08),
      new THREE.Vector2(0.235, 0.26),
      new THREE.Vector2(0.24, 0.36),
      new THREE.Vector2(0.21, 0.48),
      new THREE.Vector2(0.12, 0.54),
      new THREE.Vector2(0.06, 0.55),
    ];
    const cuirass = new THREE.Mesh(new THREE.LatheGeometry(cuirassProfile, 20), cls === "lucistnik" ? leather : cls === "vestec" ? cloth : bronze);
    cuirass.scale.z = 0.78;
    cuirass.position.y = 0.06;
    this.torso.add(cuirass);
    if (cls !== "vestec") {
      const belt = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 6, 22), leather);
      belt.rotation.x = Math.PI / 2;
      belt.scale.y = 0.8;
      belt.position.y = 0.08;
      this.torso.add(belt);
    }

    // Krk a hlava
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), skin);
    neck.position.y = 0.64;
    this.torso.add(neck);
    this.head.position.y = 0.77;
    this.torso.add(this.head);
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), skin);
    face.scale.set(0.92, 1.08, 1);
    this.head.add(face);
    const eyeMat = std("#120c08", 0, 0.4);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), eyeMat);
      eye.position.set(0.036 * side, 0.015, 0.095);
      this.head.add(eye);
    }
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std(enemy ? "#1a1410" : "#3a2616", 0, 1));
    beard.position.set(0, -0.03, 0.04);
    beard.scale.set(1.1, 1.2, 1);
    if (cls !== "vestec") this.head.add(beard);

    if (cls === "hoplit") {
      // Korintská přilba s hřebenem z koňských žíní
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.128, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), bronze);
      helm.scale.set(0.95, 1.12, 1.05);
      helm.position.y = 0.012;
      this.head.add(helm);
      for (const side of [-1, 1]) {
        const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.11, 0.09), bronze);
        cheek.position.set(0.085 * side, -0.04, 0.055);
        cheek.rotation.y = -0.35 * side;
        this.head.add(cheek);
      }
      const nose = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.07, 0.02), bronze);
      nose.position.set(0, 0.0, 0.118);
      this.head.add(nose);
      const crestMat = std(crestColor, 0, 1);
      const crest = new THREE.Mesh(new THREE.TorusGeometry(hero ? 0.15 : 0.13, hero ? 0.04 : 0.03, 8, 20, Math.PI), crestMat);
      crest.rotation.y = Math.PI / 2;
      crest.position.y = 0.09;
      crest.scale.set(1, hero ? 1.25 : 1, 0.6);
      this.head.add(crest);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, hero ? 0.42 : 0.3, 8), crestMat);
      tail.position.set(0, -0.02, -0.17);
      tail.rotation.x = 0.35;
      this.head.add(tail);
      this.flashMats.push(crestMat);
      if (azkar) {
        // zlatá koruna paprsků rudého slunce na přilbě vojevůdce
        const gold = std("#d8a24a", 0.9, 0.25, { emissive: "#3a1a00" });
        for (let i = 0; i < 7; i += 1) {
          const ray = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 4), gold);
          const a = -Math.PI / 2 + (i - 3) * 0.32;
          ray.position.set(Math.sin(a + Math.PI / 2) * 0.13, 0.08 + Math.cos(a + Math.PI / 2) * 0.03, 0.08 + Math.abs(i - 3) * -0.02);
          ray.rotation.z = -(i - 3) * 0.3;
          this.head.add(ray);
        }
      }
    } else if (cls === "lucistnik") {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.118, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), leather);
      cap.position.y = 0.02;
      this.head.add(cap);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.108, 0.014, 6, 18), bronze);
      band.rotation.x = Math.PI / 2;
      band.position.y = 0.03;
      this.head.add(band);
    } else {
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7), cloth);
      hood.position.set(0, 0.02, -0.02);
      hood.scale.set(1, 1.1, 1.1);
      this.head.add(hood);
      const circlet = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.01, 6, 18), std("#e0b45a", 0.9, 0.25, { emissive: "#5a3000" }));
      circlet.rotation.x = Math.PI / 2 - 0.15;
      circlet.position.y = 0.05;
      this.head.add(circlet);
    }

    // Paže
    const buildArm = (group: THREE.Group, side: number, forearm?: THREE.Group) => {
      group.position.set(0.25 * side, 0.5, 0);
      this.torso.add(group);
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), cls === "hoplit" ? bronze : cls === "vestec" ? cloth : leather);
      shoulder.scale.set(1.15, 0.85, 1.05);
      group.add(shoulder);
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 4, 8), cls === "vestec" ? cloth : skin);
      upper.position.y = -0.16;
      group.add(upper);
      const lower = forearm ?? new THREE.Group();
      lower.position.y = -0.3;
      group.add(lower);
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.2, 4, 8), skin);
      fore.position.y = -0.13;
      lower.add(fore);
      const bracer = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.13, 10, 1, true), cls === "hoplit" ? bronze : leather);
      bracer.position.y = -0.15;
      lower.add(bracer);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin);
      hand.position.y = -0.28;
      lower.add(hand);
      return lower;
    };
    const lowerR = buildArm(this.armR, -1, this.forearmR);
    const lowerL = buildArm(this.armL, 1, this.forearmL);
    this.armR.rotation.z = -0.12;
    this.armL.rotation.z = 0.12;
    this.forearmR.rotation.x = -this.restBendR;
    this.forearmL.rotation.x = -this.restBendL;
    this.armL.rotation.x = cls === "hoplit" || this.opts.shield ? -0.35 : -0.15;

    // Zbraně – držák v dlani kompenzuje ohnuté předloktí, takže zbraň v klidu stojí svisle.
    const wood = std("#5b3b22", 0, 0.85);
    const grip = (lower: THREE.Group, bend: number) => {
      const holder = new THREE.Group();
      holder.position.set(0, -0.28, 0.02);
      holder.rotation.x = bend;
      lower.add(holder);
      return holder;
    };
    if (cls === "hoplit") {
      this.weapon = grip(lowerR, this.restBendR);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 2.3, 8), wood);
      shaft.position.y = 0.45;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.24, 8), bronze);
      tip.position.y = 1.26;
      shaft.add(tip);
      const butt = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 6), bronze);
      butt.position.y = -1.2;
      butt.rotation.x = Math.PI;
      shaft.add(butt);
      this.weapon.add(shaft);
    } else if (cls === "lucistnik") {
      const holder = grip(lowerL, this.restBendL);
      const yaw = new THREE.Group();
      yaw.rotation.y = Math.PI / 2;
      holder.add(yaw);
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.018, 6, 24, Math.PI * 0.8), wood);
      bow.rotation.z = Math.PI * 0.6;
      bow.position.x = 0.46;
      yaw.add(bow);
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.86, 4), std("#d8cfb8", 0, 0.6));
      string.position.x = 0.31;
      yaw.add(string);
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.5, 10), leather);
      quiver.position.set(0.08, 0.35, -0.2);
      quiver.rotation.z = -0.4;
      this.torso.add(quiver);
      for (let i = 0; i < 4; i += 1) {
        const arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 4), std("#c8b48a", 0, 0.8));
        arrow.position.set(-0.02 + i * 0.015, 0.32, 0);
        quiver.add(arrow);
      }
    } else {
      this.weapon = grip(lowerR, this.restBendR);
      const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 1.7, 8), wood);
      staff.position.y = 0.3;
      this.weapon.add(staff);
      const head = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 6, 14), bronze);
      head.position.y = 0.88;
      staff.add(head);
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
      const shieldMat = std("#ffffff", 0.75, 0.38, { map: shieldTexture(bronzeColor, eryon ? "#2a1408" : azkar ? "#d8a24a" : enemy ? "#a8261a" : "#3a2210", eryon ? "eryon" : enemy ? "redsun" : "sun") });
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32), [bronze, shieldMat, bronze]);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.025, 8, 32), bronze);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.026;
      shield.add(rim);
      shield.rotation.x = Math.PI / 2;
      this.shield = new THREE.Group();
      // štít opřený o levý bok – postava zůstane vidět, při bloku se přesune před tělo
      this.shield.position.set(0.38, 0.12, 0.1);
      this.shield.rotation.y = 1.15;
      this.shield.add(shield);
      this.torso.add(this.shield);
      this.flashMats.push(shieldMat);
    }

    // Plášť
    if (cls !== "vestec" || hero) {
      const geo = new THREE.PlaneGeometry(0.56, 1.15, 6, 14);
      geo.translate(0, -0.575, 0);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i += 1) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setZ(i, -Math.abs(x) * 0.35 - 0.03 * (-y));
        pos.setX(i, x * (1 + -y * 0.25));
      }
      geo.computeVertexNormals();
      this.cloakBase = Float32Array.from(pos.array as ArrayLike<number>);
      this.cloak = new THREE.Mesh(geo, cloth);
      this.cloak.position.set(0, 0.52, -0.17);
      this.cloak.rotation.x = 0.08;
      this.torso.add(this.cloak);
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

  update(dt: number, time: number) {
    const t = time + this.phase;
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
