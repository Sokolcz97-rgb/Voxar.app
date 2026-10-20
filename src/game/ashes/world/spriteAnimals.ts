import * as THREE from "three";

/**
 * Zvířata z obrázků (šablony zepředu / z boku / zezadu, `public/game/animals`).
 * Plocha se vždy natočí ke kameře a podle úhlu se přepíná pohled. Pohyb je
 * v shaderu: při chůzi se kývají přední a zadní nohy, ptáci mávají křídly,
 * ryba vrtí ocasem.
 */

export type SpriteKind =
  | "wolf" | "fish" | "doe" | "boar" | "stag" | "pig" | "gull" | "dog" | "chicken"
  | "goat" | "cow" | "songbird" | "bear" | "squirrel";

type View = "front" | "side" | "back";

/** Velikost obrázků v pixelech (stejné měřítko v rámci druhu) a kam míří hlava na bočním pohledu. */
const SHEETS: Record<SpriteKind, { side: 1 | -1; px: Record<View, [number, number]>; height: number; leg: number; motion: "walk" | "bird" | "fish" }> = {
  wolf: { side: 1, px: { side: [613, 600], front: [273, 600], back: [268, 597] }, height: 1.0, leg: 0.4, motion: "walk" },
  fish: { side: -1, px: { side: [574, 506], front: [323, 502], back: [326, 501] }, height: 0.55, leg: 0, motion: "fish" },
  doe: { side: -1, px: { side: [433, 684], front: [341, 692], back: [340, 694] }, height: 1.45, leg: 0.45, motion: "walk" },
  boar: { side: 1, px: { side: [553, 373], front: [314, 381], back: [294, 378] }, height: 0.85, leg: 0.3, motion: "walk" },
  stag: { side: 1, px: { side: [444, 725], front: [396, 721], back: [386, 721] }, height: 1.9, leg: 0.36, motion: "walk" },
  pig: { side: 1, px: { side: [533, 376], front: [392, 380], back: [394, 378] }, height: 0.8, leg: 0.22, motion: "walk" },
  gull: { side: -1, px: { side: [480, 576], front: [366, 557], back: [372, 582] }, height: 0.7, leg: 0.2, motion: "bird" },
  dog: { side: 1, px: { side: [525, 491], front: [389, 511], back: [375, 513] }, height: 0.75, leg: 0.3, motion: "walk" },
  chicken: { side: -1, px: { side: [496, 473], front: [395, 467], back: [406, 467] }, height: 0.5, leg: 0.16, motion: "walk" },
  goat: { side: 1, px: { side: [493, 542], front: [392, 551], back: [396, 551] }, height: 1.15, leg: 0.3, motion: "walk" },
  cow: { side: -1, px: { side: [553, 479], front: [312, 480], back: [296, 477] }, height: 1.5, leg: 0.32, motion: "walk" },
  songbird: { side: -1, px: { side: [471, 454], front: [414, 475], back: [410, 476] }, height: 0.3, leg: 0.15, motion: "bird" },
  bear: { side: -1, px: { side: [516, 438], front: [376, 453], back: [371, 450] }, height: 1.5, leg: 0.3, motion: "walk" },
  squirrel: { side: 1, px: { side: [556, 343], front: [281, 355], back: [362, 384] }, height: 0.4, leg: 0.25, motion: "walk" },
};

export const hasSprite = (k: string): k is SpriteKind => k in SHEETS;

const loader = new THREE.TextureLoader();
const texCache = new Map<string, THREE.Texture>();
function tex(kind: SpriteKind, view: View) {
  const key = `${kind}-${view}`;
  let t = texCache.get(key);
  if (!t) {
    t = loader.load(`/game/animals/${key}.webp`);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    texCache.set(key, t);
  }
  return t;
}

const plane = new THREE.PlaneGeometry(1, 1);
plane.translate(0, 0.5, 0);
const blobGeo = new THREE.CircleGeometry(0.5, 20);
blobGeo.rotateX(-Math.PI / 2);
const blobMat = new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.28, depthWrite: false });

/** Režimy pohybu v shaderu. */
const MODE = { walkSide: 0, walkFront: 1, birdSide: 2, birdFront: 3, fishSide: 4, fishFront: 5 };

function makeMaterial() {
  const uniforms = {
    uT: { value: 0 },
    uAmt: { value: 0 },
    uMode: { value: 0 },
    uLeg: { value: 0.35 },
    uFlip: { value: 0 },
    uHead: { value: 1 },
  };
  const mat = new THREE.MeshLambertMaterial({ transparent: false, alphaTest: 0.5, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uT, uAmt, uMode, uLeg, uFlip, uHead;
        vec2 animUv(vec2 uv) {
          if (uFlip > 0.5) uv.x = 1.0 - uv.x;
          float u = uv.x, v = uv.y;
          if (uMode < 0.5) {
            // bok při chůzi: přední a zadní nohy se kývají proti sobě
            if (v < uLeg) {
              float k = (uLeg - v) / uLeg;
              float hp = u < 0.5 ? 0.0 : 3.14159;
              uv.x -= sin(uT + hp) * 0.05 * k * uAmt;
            }
          } else if (uMode < 1.5) {
            // zepředu/zezadu: levá a pravá noha se střídavě zvedají
            if (v < uLeg) {
              float k = (uLeg - v) / uLeg;
              float hp = u < 0.5 ? 0.0 : 3.14159;
              uv.y -= max(0.0, sin(uT + hp)) * 0.06 * k * uAmt;
            }
          } else if (uMode < 2.5) {
            // pták z boku: křídlo uprostřed těla mává nahoru a dolů
            float m = smoothstep(0.2, 0.45, v) * (1.0 - smoothstep(0.65, 0.85, v)) * smoothstep(0.2, 0.4, u) * (1.0 - smoothstep(0.7, 0.9, u));
            uv.y += sin(uT) * 0.08 * m * uAmt;
          } else if (uMode < 3.5) {
            // pták zepředu: křídla po stranách
            float side = max(0.0, abs(u - 0.5) - 0.22) / 0.28;
            uv.y -= sin(uT) * 0.18 * side * uAmt;
          } else if (uMode < 4.5) {
            // ryba z boku: ocas se vlní, tělo se jemně prohýbá
            float s = uHead > 0.0 ? u : 1.0 - u;
            float tail = pow(max(0.0, 0.45 - s) / 0.45, 2.0);
            uv.y += sin(uT) * 0.12 * tail + sin(uT - s * 6.0) * 0.012;
          } else {
            // ryba zepředu: lehké kývání do stran
            uv.x += sin(uT) * 0.03 * (1.0 - v);
          }
          return uv;
        }`,
      )
      .replace(
        "#include <map_fragment>",
        `vec2 auv = animUv(vMapUv);
        if (auv.x < 0.0 || auv.x > 1.0 || auv.y < 0.0 || auv.y > 1.0) discard;
        vec4 sampledDiffuseColor = texture2D(map, auv);
        diffuseColor *= sampledDiffuseColor;`,
      );
  };
  mat.customProgramCacheKey = () => "ashes-sprite-animal";
  return { mat, uniforms };
}

export class SpriteAnimal {
  readonly group = new THREE.Group();
  private mesh: THREE.Mesh;
  private mat: THREE.MeshLambertMaterial;
  private u: ReturnType<typeof makeMaterial>["uniforms"];
  private view: View | null = null;
  private phase = Math.random() * 10;
  private sheet: (typeof SHEETS)[SpriteKind];
  private scale: number;

  constructor(readonly kind: SpriteKind, scale = 1, shadow = true) {
    this.sheet = SHEETS[kind];
    this.scale = scale;
    const { mat, uniforms } = makeMaterial();
    this.mat = mat;
    this.u = uniforms;
    this.mesh = new THREE.Mesh(plane, mat);
    this.group.add(this.mesh);
    if (shadow) {
      const blob = new THREE.Mesh(blobGeo, blobMat);
      blob.position.y = 0.03;
      const w = this.sheet.height * scale * 0.8;
      blob.scale.set(w, 1, w * 0.6);
      this.group.add(blob);
      this.blob = blob;
    }
    this.setView("side");
  }
  private blob: THREE.Mesh | null = null;

  private setView(view: View) {
    if (view === this.view) return;
    this.view = view;
    const t = tex(this.kind, view);
    this.mat.map = t;
    this.mat.needsUpdate = true;
    // stejné měřítko pro všechny pohledy: výška podle nejvyššího obrázku druhu
    const maxH = Math.max(...Object.values(this.sheet.px).map((p) => p[1]));
    const [pw, ph] = this.sheet.px[view];
    const k = (this.sheet.height * this.scale) / maxH;
    this.mesh.scale.set(pw * k, ph * k, 1);
  }

  /**
   * heading = směr, kam zvíře míří (rotace kolem Y, dopředu = (sin, cos)).
   * speed = rychlost pohybu; flying/swimming pro ptáky a ryby.
   */
  update(dt: number, camera: THREE.Camera, heading: number, speed: number, moving = speed > 0.05) {
    const wp = this.group.getWorldPosition(_v);
    const cx = camera.position.x - wp.x, cz = camera.position.z - wp.z;
    const toCam = Math.atan2(cx, cz);
    let rel = toCam - heading;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const view: View = Math.abs(rel) < 0.75 ? "front" : Math.abs(rel) > 2.4 ? "back" : "side";
    this.setView(view);
    // plocha natočená ke kameře (jen kolem svislé osy)
    this.mesh.rotation.y = toCam - (this.group.parent ? this.group.parent.rotation.y : 0);
    // na boku: kam míří hlava na obrazovce
    const right = _r.setFromMatrixColumn(camera.matrixWorld, 0);
    const headRight = Math.sin(heading) * right.x + Math.cos(heading) * right.z > 0;
    this.u.uFlip.value = view === "side" && headRight !== (this.sheet.side > 0) ? 1 : 0;
    this.u.uHead.value = headRight ? 1 : -1;
    const m = this.sheet.motion;
    this.u.uMode.value = m === "walk" ? (view === "side" ? MODE.walkSide : MODE.walkFront) : m === "bird" ? (view === "side" ? MODE.birdSide : MODE.birdFront) : view === "side" ? MODE.fishSide : MODE.fishFront;
    this.u.uLeg.value = this.sheet.leg;
    const target = m === "walk" ? (moving ? Math.min(1, 0.45 + speed * 0.12) : 0) : 1;
    this.u.uAmt.value += (target - this.u.uAmt.value) * Math.min(1, dt * 6);
    const rate = m === "bird" ? 14 : m === "fish" ? 7 : 5 + speed * 2.4;
    this.phase += dt * (m === "walk" && !moving ? 0 : rate);
    this.u.uT.value = this.phase;
    // poskakování těla při chůzi
    this.mesh.position.y = m === "walk" ? Math.abs(Math.sin(this.phase)) * 0.04 * this.u.uAmt.value * this.sheet.height : 0;
  }

  setShadowVisible(v: boolean) {
    if (this.blob) this.blob.visible = v;
  }

  dispose() {
    this.mat.dispose();
  }
}

const _v = new THREE.Vector3();
const _r = new THREE.Vector3();
