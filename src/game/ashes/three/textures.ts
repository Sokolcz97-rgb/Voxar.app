import * as THREE from "three";

/**
 * Procedurální textury (bez souborů ke stažení). Vše je dlaždicové (tileable),
 * počítá se jednou do canvasu a pak se sdílí. Každá textura má i výškovou mapu
 * (bump) pro jemný reliéf.
 */

const cache = new Map<string, { map: THREE.Texture; bump: THREE.Texture }>();

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Periodický value-noise: hodnoty 0..1, opakuje se po `period` buňkách. */
function makeNoise(period: number, seed: number) {
  const r = rand(seed);
  const grid = new Float32Array(period * period).map(() => r());
  const at = (x: number, y: number) => grid[((y % period) + period) % period * period + (((x % period) + period) % period)];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (u: number, v: number) => {
    const x = u * period, y = v * period;
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = smooth(x - xi), yf = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  };
}

/** Fraktální šum (více oktáv), dlaždicový. */
function makeFbm(seed: number, base = 4, octaves = 4) {
  const layers = Array.from({ length: octaves }, (_, i) => makeNoise(base * 2 ** i, seed + i * 101));
  return (u: number, v: number) => {
    let sum = 0, amp = 0.5, norm = 0;
    for (const n of layers) {
      sum += n(u, v) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

type Rgb = [number, number, number];
const hex = (h: string): Rgb => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};
const lerp3 = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

type PixelFn = (u: number, v: number) => { c: Rgb; h: number };

function build(key: string, size: number, pixel: PixelFn, post?: (ctx: CanvasRenderingContext2D, hctx: CanvasRenderingContext2D, size: number) => void, repeat = 1) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const hcanvas = document.createElement("canvas");
  hcanvas.width = hcanvas.height = size;
  const ctx = canvas.getContext("2d");
  const hctx = hcanvas.getContext("2d");
  if (ctx && hctx) {
    const img = ctx.createImageData(size, size);
    const himg = hctx.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const { c, h } = pixel(x / size, y / size);
        const k = (y * size + x) * 4;
        img.data[k] = c[0];
        img.data[k + 1] = c[1];
        img.data[k + 2] = c[2];
        img.data[k + 3] = 255;
        const hv = Math.max(0, Math.min(255, h * 255));
        himg.data[k] = himg.data[k + 1] = himg.data[k + 2] = hv;
        himg.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    hctx.putImageData(himg, 0, 0);
    post?.(ctx, hctx, size);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(hcanvas);
  for (const t of [map, bump]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.repeat.set(repeat, repeat);
  }
  const out = { map, bump };
  cache.set(key, out);
  return out;
}

/** Kladívkovaný bronz se škrábanci a zelenou patinou ve spárách. */
export function bronzeTex(tint: string, patina = 0.25) {
  const n = makeFbm(11, 6, 4);
  const dents = makeNoise(24, 3);
  const base = hex(tint);
  const dark = lerp3(base, [30, 18, 8], 0.55);
  const green: Rgb = [70, 110, 88];
  return build(`bronze:${tint}:${patina}`, 256, (u, v) => {
    const f = n(u, v);
    const d = dents(u, v);
    let c = lerp3(dark, lerp3(base, [255, 225, 170], 0.25), f);
    const p = Math.max(0, (n(u + 0.37, v + 0.11) - 0.62) * 3) * patina;
    c = lerp3(c, green, Math.min(0.8, p));
    return { c, h: 0.5 + (d - 0.5) * 0.6 + (f - 0.5) * 0.3 };
  }, (ctx, hctx, s) => {
    const r = rand(7);
    for (let i = 0; i < 90; i += 1) {
      const x = r() * s, y = r() * s, dx = (r() - 0.5) * 40, dy = (r() - 0.5) * 40;
      ctx.strokeStyle = `rgba(255,235,200,${0.05 + r() * 0.12})`;
      ctx.lineWidth = 0.6 + r();
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx, y + dy);
      ctx.stroke();
      hctx.strokeStyle = "rgba(0,0,0,0.35)";
      hctx.beginPath();
      hctx.moveTo(x, y);
      hctx.lineTo(x + dx, y + dy);
      hctx.stroke();
    }
  });
}

/** Kůže: zrno, odřeniny a prošití po okraji. */
export function leatherTex(tint: string) {
  const n = makeFbm(21, 8, 4);
  const grain = makeNoise(64, 5);
  const base = hex(tint);
  return build(`leather:${tint}`, 256, (u, v) => {
    const f = n(u, v);
    const g = grain(u, v);
    const c = lerp3(lerp3(base, [10, 6, 3], 0.35), lerp3(base, [200, 160, 110], 0.18), f * 0.8 + g * 0.2);
    return { c, h: 0.5 + (g - 0.5) * 0.5 + (f - 0.5) * 0.2 };
  }, (ctx, hctx, s) => {
    ctx.strokeStyle = "rgba(230,200,150,0.35)";
    hctx.strokeStyle = "rgba(0,0,0,0.5)";
    for (const c of [ctx, hctx]) {
      c.setLineDash([5, 4]);
      c.lineWidth = 1.5;
      c.strokeRect(6, 6, s - 12, s - 12);
    }
  });
}

/** Lněná / vlněná látka: tkaní s jemnou nerovností. */
export function clothTex(tint: string) {
  const n = makeFbm(31, 4, 3);
  const base = hex(tint);
  return build(`cloth:${tint}`, 256, (u, v) => {
    const weave = (Math.sin(u * Math.PI * 2 * 64) * Math.sin(v * Math.PI * 2 * 64) + 1) / 2;
    const f = n(u, v);
    const c = lerp3(lerp3(base, [0, 0, 0], 0.25), lerp3(base, [255, 240, 220], 0.12), f * 0.7 + weave * 0.3);
    return { c, h: 0.4 + weave * 0.4 + (f - 0.5) * 0.2 };
  });
}

/** Kůže postavy: jemné skvrny a póry (barva se násobí tónem pleti). */
export function skinTex() {
  const n = makeFbm(41, 6, 3);
  const pores = makeNoise(96, 9);
  return build("skin", 128, (u, v) => {
    const f = n(u, v);
    const p = pores(u, v);
    const k = 0.9 + f * 0.12 - p * 0.04;
    return { c: [255 * k, 245 * k, 238 * k], h: 0.5 + (p - 0.5) * 0.3 };
  });
}

/** Svalový kyrys: hrudní svaly a břicho vytepané do bronzu (bump). */
export function muscleBump() {
  return build("muscle", 256, (u, v) => {
    // u = obvod (0..1, předek kolem 0.25), v = výška (0 dole, 1 nahoře)
    const front = Math.cos((u - 0.25) * Math.PI * 2);
    const x = (u - 0.25) * 4;
    let h = 0.5;
    if (front > 0) {
      const pec = Math.exp(-(((Math.abs(x) - 0.28) ** 2) / 0.02 + ((v - 0.7) ** 2) / 0.012));
      const abs = [0.25, 0.38, 0.5].reduce((s, y) => s + Math.exp(-(((Math.abs(x) - 0.1) ** 2) / 0.006 + ((v - y) ** 2) / 0.003)), 0);
      const line = Math.exp(-((x ** 2) / 0.0006)) * (v < 0.78 ? 1 : 0);
      h += pec * 0.45 + abs * 0.22 - line * 0.25;
    }
    return { c: [255, 255, 255], h };
  });
}

// ---------------------------------------------------------------- krajina a stavby

export function grassTex() {
  const n = makeFbm(51, 4, 5);
  const blades = makeNoise(128, 13);
  return build("grass", 512, (u, v) => {
    const f = n(u, v);
    const b = blades(u, v);
    const c = lerp3(lerp3([62, 78, 36], [96, 112, 52], f), [140, 136, 74], Math.max(0, b - 0.7) * 2);
    return { c, h: b * 0.7 + f * 0.3 };
  });
}

export function dryGrassTex() {
  const n = makeFbm(61, 4, 5);
  const blades = makeNoise(128, 17);
  return build("dry", 512, (u, v) => {
    const f = n(u, v);
    const b = blades(u, v);
    const c = lerp3(lerp3([120, 104, 62], [168, 148, 92], f), [90, 84, 50], Math.max(0, 0.35 - b) * 2);
    return { c, h: b * 0.6 + f * 0.4 };
  });
}

export function sandTex() {
  const n = makeFbm(71, 6, 4);
  const grain = makeNoise(256, 19);
  return build("sand", 512, (u, v) => {
    const f = n(u, v);
    const g = grain(u, v);
    const ripple = Math.sin((v + f * 0.08) * Math.PI * 2 * 18) * 0.5 + 0.5;
    const c = lerp3([176, 152, 112], [214, 192, 150], f * 0.7 + g * 0.3);
    return { c, h: ripple * 0.4 + g * 0.4 + f * 0.2 };
  });
}

export function rockTex() {
  const n = makeFbm(81, 4, 5);
  const cracks = makeFbm(83, 8, 3);
  return build("rock", 512, (u, v) => {
    const f = n(u, v);
    const cr = Math.abs(cracks(u, v) - 0.5);
    const crack = cr < 0.03 ? 1 - cr / 0.03 : 0;
    const c = lerp3(lerp3([98, 92, 82], [150, 142, 128], f), [50, 46, 40], crack * 0.8);
    return { c, h: f * 0.8 - crack * 0.5 + 0.2 };
  });
}

export function dirtTex() {
  const n = makeFbm(91, 6, 4);
  const pebbles = makeNoise(96, 23);
  return build("dirt", 512, (u, v) => {
    const f = n(u, v);
    const p = pebbles(u, v);
    const peb = p > 0.78 ? (p - 0.78) * 4 : 0;
    const c = lerp3(lerp3([104, 84, 60], [146, 120, 88], f), [170, 160, 140], peb);
    return { c, h: f * 0.5 + peb * 0.5 };
  });
}

/** Dlažba z nepravidelných kamenných desek. */
export function pavingTex() {
  const n = makeFbm(101, 6, 4);
  return build("paving", 512, (u, v) => {
    const rows = 6;
    const row = Math.floor(v * rows);
    const off = (row % 2) * 0.5;
    const cols = 5;
    const cu = (u * cols + off) % 1;
    const cv = (v * rows) % 1;
    const edge = Math.min(cu, 1 - cu, cv * 1.2, (1 - cv) * 1.2);
    const joint = edge < 0.05 ? 1 - edge / 0.05 : 0;
    const f = n(u, v);
    const tone = ((row * 7 + Math.floor(u * cols + off) * 13) % 5) / 5;
    const c = lerp3(lerp3([168, 156, 136], [204, 194, 172], tone * 0.6 + f * 0.4), [92, 84, 72], joint * 0.85);
    return { c, h: 0.7 - joint * 0.6 + (f - 0.5) * 0.2 };
  });
}

/** Omítka s jemnými skvrnami a odprýsknutím. */
export function plasterTex() {
  const n = makeFbm(111, 4, 5);
  return build("plaster", 512, (u, v) => {
    const f = n(u, v);
    const stain = Math.max(0, (n(u + 0.5, v * 0.5) - 0.6) * 2);
    const c = lerp3(lerp3([214, 204, 186], [238, 232, 218], f), [170, 150, 120], stain * 0.6);
    return { c, h: 0.5 + (f - 0.5) * 0.5 };
  });
}

/** Kamenné kvádry (hradby, věže). */
export function stoneBlockTex() {
  const n = makeFbm(121, 6, 4);
  return build("stoneblocks", 512, (u, v) => {
    const rows = 4;
    const row = Math.floor(v * rows);
    const off = (row % 2) * 0.5;
    const cols = 3;
    const cu = (u * cols + off) % 1;
    const cv = (v * rows) % 1;
    const edge = Math.min(cu * 1.4, (1 - cu) * 1.4, cv, 1 - cv);
    const joint = edge < 0.06 ? 1 - edge / 0.06 : 0;
    const f = n(u, v);
    const tone = ((row * 5 + Math.floor(u * cols + off) * 11) % 4) / 4;
    const c = lerp3(lerp3([170, 160, 140], [212, 204, 186], tone * 0.5 + f * 0.5), [96, 88, 76], joint * 0.8);
    return { c, h: 0.75 - joint * 0.7 + (f - 0.5) * 0.25 };
  });
}

/** Pálené střešní tašky. */
export function roofTex() {
  const n = makeFbm(131, 6, 3);
  return build("roof", 256, (u, v) => {
    const rows = 8;
    const cv = (v * rows) % 1;
    const row = Math.floor(v * rows);
    const cu = (u * 8 + (row % 2) * 0.5) % 1;
    const curve = Math.sin(cu * Math.PI);
    const shade = 0.55 + curve * 0.45 - (cv > 0.85 ? 0.35 : 0);
    const f = n(u, v);
    const c = lerp3([120, 52, 34], [186, 96, 62], shade * 0.7 + f * 0.3);
    return { c, h: curve * 0.6 + (1 - cv) * 0.4 };
  });
}

/** Dřevěná prkna. */
export function woodTex() {
  const n = makeFbm(141, 4, 4);
  return build("wood", 256, (u, v) => {
    const plank = (u * 5) % 1;
    const gap = plank < 0.04 ? 1 : 0;
    const ring = Math.sin((v * 20 + n(u * 0.5, v) * 6 + Math.floor(u * 5) * 3) * Math.PI) * 0.5 + 0.5;
    const c = lerp3(lerp3([70, 44, 26], [120, 82, 50], ring * 0.6 + n(u, v) * 0.4), [30, 20, 12], gap);
    return { c, h: 0.6 + ring * 0.2 - gap * 0.5 };
  });
}

// ---------------------------------------------------------------- mapování ve světových souřadnicích

/**
 * Nanese texturu podle světových souřadnic (triplanárně) – stavby a skály pak
 * nepotřebují UV a textura má všude stejné měřítko (metry).
 */
export function worldMapped(mat: THREE.MeshStandardMaterial, tex: { map: THREE.Texture; bump: THREE.Texture }, scale: number, bumpStrength = 1) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tpMap = { value: tex.map };
    shader.uniforms.tpBump = { value: tex.bump };
    shader.uniforms.tpScale = { value: 1 / scale };
    shader.uniforms.tpBumpK = { value: bumpStrength };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTpPos;\nvarying vec3 vTpN;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vec4 tpW = vec4(transformed, 1.0);
        mat3 tpM = mat3(modelMatrix);
        #ifdef USE_INSTANCING
          tpW = instanceMatrix * tpW;
          tpM = tpM * mat3(instanceMatrix);
        #endif
        tpW = modelMatrix * tpW;
        vTpPos = tpW.xyz;
        vTpN = normalize(tpM * objectNormal);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vTpPos;\nvarying vec3 vTpN;\nuniform sampler2D tpMap;\nuniform sampler2D tpBump;\nuniform float tpScale;\nuniform float tpBumpK;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 tpB = pow(abs(normalize(vTpN)), vec3(4.0));
        tpB /= (tpB.x + tpB.y + tpB.z);
        vec3 tpP = vTpPos * tpScale;
        vec4 tpC = texture2D(tpMap, tpP.zy) * tpB.x + texture2D(tpMap, tpP.xz) * tpB.y + texture2D(tpMap, tpP.xy) * tpB.z;
        diffuseColor.rgb *= tpC.rgb * 1.25;
        float tpH = texture2D(tpBump, tpP.zy).r * tpB.x + texture2D(tpBump, tpP.xz).r * tpB.y + texture2D(tpBump, tpP.xy).r * tpB.z;
        diffuseColor.rgb *= mix(1.0, 0.75 + tpH * 0.5, tpBumpK);`,
      );
  };
  mat.customProgramCacheKey = () => `tp:${tex.map.uuid}:${scale}`;
  mat.userData.tp = { tex, scale };
  return mat;
}

/**
 * Úsporná varianta: jedno čtení textury podle převažující osy místo šesti
 * (bez reliéfu). Pro režim „Úsporná / Nízká“.
 */
export function worldMappedLite(mat: THREE.Material, tp: { tex: { map: THREE.Texture }; scale: number }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.tpMap = { value: tp.tex.map };
    shader.uniforms.tpScale = { value: 1 / tp.scale };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTpUv;\nuniform float tpScale;")
      .replace(
        "#include <worldpos_vertex>",
        `#include <worldpos_vertex>
        vec4 tpW = vec4(transformed, 1.0);
        mat3 tpM = mat3(modelMatrix);
        #ifdef USE_INSTANCING
          tpW = instanceMatrix * tpW;
          tpM = tpM * mat3(instanceMatrix);
        #endif
        tpW = modelMatrix * tpW;
        vec3 tpN = abs(normalize(tpM * objectNormal));
        vTpUv = (tpN.x > tpN.y && tpN.x > tpN.z ? tpW.zy : tpN.y > tpN.z ? tpW.xz : tpW.xy) * tpScale;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTpUv;\nuniform sampler2D tpMap;")
      .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb *= texture2D(tpMap, vTpUv).rgb * 1.25;");
  };
  mat.customProgramCacheKey = () => `tpl:${tp.tex.map.uuid}:${tp.scale}`;
  return mat;
}

/** Srst / vlna zvířat: krátké chlupy a jemné stínování. */
export function furTex(tint: string) {
  const n = makeFbm(151, 6, 4);
  const hairs = makeNoise(160, 29);
  const base = hex(tint);
  return build(`fur:${tint}`, 128, (u, v) => {
    const f = n(u, v);
    const h = hairs(u * 0.6, v * 1.6);
    const c = lerp3(lerp3(base, [0, 0, 0], 0.3), lerp3(base, [255, 255, 255], 0.12), f * 0.5 + h * 0.5);
    return { c, h: h * 0.7 + f * 0.3 };
  });
}
