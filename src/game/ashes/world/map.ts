import type { Faction, HeroClass } from "../types";

/**
 * Mapa 1. aktu – pobřeží Kalidry. Souřadnice ve světových jednotkách (≈ metry):
 * x roste na východ, z na jih. Moře je na západě, v severozápadní zátoce a pod útesy na východě.
 * Všechno, co určuje svět, je tady jako data, aby se dal mapa později upravovat nebo nahradit.
 */

export const WORLD_HALF = 125;
export const SEA_LEVEL = 0;

export type RegionId = "shore" | "aqueduct" | "hills" | "plain" | "kalidra" | "cove" | "camp";

export const REGION_NAME: Record<RegionId, { cs: string; en: string }> = {
  shore: { cs: "Bezejmenný břeh", en: "Nameless Shore" },
  aqueduct: { cs: "Akvadukt", en: "The Aqueduct" },
  hills: { cs: "Kopce strážních ohňů", en: "Watchfire Hills" },
  plain: { cs: "Pláň před branou", en: "Plain before the Gate" },
  kalidra: { cs: "Kalidra", en: "Kalidra" },
  cove: { cs: "Zátoka černých plachet", en: "Bay of Black Sails" },
  camp: { cs: "Tábor Legie", en: "Legion Camp" },
};

// ---------------------------------------------------------------- šum a terén
function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
function valueNoise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
export function fbm(x: number, z: number) {
  return valueNoise(x, z) * 0.55 + valueNoise(x * 2.1, z * 2.1) * 0.3 + valueNoise(x * 4.3, z * 4.3) * 0.15;
}
function step(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return smooth(t);
}
function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export const CITY = { x0: 52, x1: 98, z0: -14, z1: 44, gateZ0: 11, gateZ1: 19, height: 3.2 };
export const COVE = { x: -64, z: -74, r: 24 };
export const CAMP = { x: 60, z: -68, r: 20 };

export function coastX(z: number) {
  return -80 + 7 * Math.sin(z * 0.045) + 3 * Math.sin(z * 0.13 + 1.3);
}

/** Výška terénu v bodě (y). Pod 0 je moře. */
export function heightAt(x: number, z: number): number {
  let h = 1.4 + (fbm(x * 0.035 + 10, z * 0.035) - 0.5) * 2.4;
  // kopce na severu a hory za nimi
  h += step(-30, -62, z) * (5.5 + fbm(x * 0.05, z * 0.05 + 4) * 6);
  h += step(-90, -118, z) * 16;
  // pobřeží na západě s pláží
  const cx = coastX(z);
  const beach = step(cx + 14, cx + 3, x);
  h = mix(h, 0.55, beach * 0.85);
  h = mix(h, -5, step(cx, cx - 10, x));
  // zátoka černých plachet
  const dc = Math.hypot(x - COVE.x, z - COVE.z);
  h = mix(h, 0.5, step(COVE.r + 12, COVE.r + 2, dc) * 0.8);
  h = mix(h, -4, step(COVE.r + 1, COVE.r - 8, dc));
  // plošina s Kalidrou a útesy nad mořem na východě
  const inCity = step(CITY.x0 - 6, CITY.x0 + 2, x) * step(CITY.z0 - 8, CITY.z0 + 2, z) * step(CITY.z1 + 8, CITY.z1 - 2, z);
  h = mix(h, CITY.height, inCity * step(CITY.x1 + 14, CITY.x1 + 4, x));
  h = mix(h, -7, step(CITY.x1 + 8, CITY.x1 + 15, x));
  // cesty se lehce zarovnají
  const road = roadDistance(x, z);
  if (road < 3.2) h = mix(h, Math.max(h * 0.85, 0.7), (1 - road / 3.2) * 0.5);
  return h;
}

// ---------------------------------------------------------------- cesty
export type Pt = [number, number];
export const ROADS: Pt[][] = [
  [[-50, 46], [-40, 30], [-33, 13], [-12, 8], [20, 12], [46, 15], [60, 15], [74, 15]],
  [[-44, -52], [-30, -45], [-10, -47], [4, -60], [18, -54], [32, -50], [52, -62]],
  [[2, -47], [8, -22], [16, -2], [20, 12]],
  [[20, 12], [28, 30]],
  [[74, 15], [74, -6]],
  [[74, 15], [86, 28]],
];

function segDist(px: number, pz: number, a: Pt, b: Pt) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t));
}
export function roadDistance(x: number, z: number) {
  let best = Infinity;
  for (const road of ROADS) for (let i = 0; i < road.length - 1; i += 1) best = Math.min(best, segDist(x, z, road[i], road[i + 1]));
  return best;
}

// ---------------------------------------------------------------- oblasti
export function inCity(x: number, z: number) {
  return x > CITY.x0 && x < CITY.x1 && z > CITY.z0 && z < CITY.z1;
}
export function regionAt(x: number, z: number): RegionId {
  if (inCity(x, z)) return "kalidra";
  if (Math.hypot(x - CAMP.x, z - CAMP.z) < CAMP.r) return "camp";
  if (Math.hypot(x - (COVE.x + 14), z - (COVE.z + 14)) < COVE.r + 4) return "cove";
  if (z < -34) return "hills";
  if (x < -28 && z > 26) return "shore";
  if (x < -4) return "aqueduct";
  return "plain";
}

/** Bezpečné oblasti, kde se nepřátelé neobjevují. */
export const SAFE: Record<Faction, RegionId[]> = { kalidra: ["kalidra"], legie: ["cove", "camp"] };

// ---------------------------------------------------------------- místa
export const SPAWN: Record<Faction, Pt> = { kalidra: [-52, 50], legie: [-44, -50] };
export const RESPAWN: Record<Faction, Pt> = { kalidra: [62, 15], legie: [56, -60] };

export const BEACONS: { id: "b1" | "b2" | "b3"; x: number; z: number }[] = [
  { id: "b1", x: -22, z: -58 },
  { id: "b2", x: 2, z: -72 },
  { id: "b3", x: 28, z: -60 },
];
export const MEMORIAL = { x: 28, z: 30 };

// ---------------------------------------------------------------- nepřátelé (stejné jako server: ashes_region_enemies)
export type EnemyDef = { id: string; n: string; c: HeroClass; l: [number, number] };
export const REGION_ENEMIES: Record<Faction, Partial<Record<RegionId, EnemyDef[]>>> = {
  kalidra: {
    shore: [{ id: "vrakar", n: "Vrakař", c: "lucistnik", l: [1, 2] }, { id: "pasarak", n: "Pašerák z útesů", c: "lucistnik", l: [1, 2] }],
    aqueduct: [{ id: "lapka", n: "Lapka od akvaduktu", c: "hoplit", l: [2, 3] }, { id: "kultista", n: "Kultista popela", c: "vestec", l: [2, 3] }],
    hills: [{ id: "zved-legie", n: "Zvěd Rudého slunce", c: "lucistnik", l: [3, 5] }, { id: "predvoj", n: "Předvoj legie", c: "hoplit", l: [3, 5] }],
    plain: [{ id: "kopinik", n: "Kopiník Rudého slunce", c: "hoplit", l: [4, 6] }, { id: "knez-slunce", n: "Kněz Rudého slunce", c: "vestec", l: [4, 6] }],
    cove: [{ id: "strazce-lodi", n: "Strážce černých lodí", c: "hoplit", l: [5, 7] }],
    camp: [{ id: "garda", n: "Azkarova garda", c: "hoplit", l: [6, 8] }],
  },
  legie: {
    cove: [{ id: "strazny-utesy", n: "Strážný z útesů", c: "lucistnik", l: [1, 2] }, { id: "vrakar", n: "Vrakař", c: "lucistnik", l: [1, 2] }],
    shore: [{ id: "vrakar", n: "Vrakař", c: "lucistnik", l: [2, 3] }, { id: "rybar", n: "Rybář s harpunou", c: "hoplit", l: [2, 3] }],
    aqueduct: [{ id: "strazce-akvaduktu", n: "Strážce akvaduktu", c: "hoplit", l: [2, 3] }, { id: "knezka", n: "Kněžka přílivu", c: "vestec", l: [2, 3] }],
    hills: [{ id: "zved-kalidra", n: "Kalidrský zvěd", c: "lucistnik", l: [3, 5] }, { id: "strazce-ohne", n: "Strážce ohně", c: "hoplit", l: [3, 5] }],
    plain: [{ id: "obrance", n: "Obránce Kalidry", c: "hoplit", l: [4, 6] }, { id: "knez-kalidry", n: "Kněz Kalidry", c: "vestec", l: [4, 6] }],
    kalidra: [{ id: "straz-kalidry", n: "Stráž Kalidry", c: "hoplit", l: [6, 8] }],
  },
};

/** Místa, kde se nepřátelé objevují (střed + poloměr toulání). */
export const ENEMY_CAMPS: { region: RegionId; x: number; z: number }[] = [
  { region: "shore", x: -60, z: 62 }, { region: "shore", x: -48, z: 72 }, { region: "shore", x: -66, z: 40 }, { region: "shore", x: -40, z: 58 },
  { region: "aqueduct", x: -46, z: 18 }, { region: "aqueduct", x: -28, z: 2 }, { region: "aqueduct", x: -56, z: -4 }, { region: "aqueduct", x: -20, z: -18 },
  { region: "hills", x: -30, z: -50 }, { region: "hills", x: -8, z: -64 }, { region: "hills", x: 16, z: -68 }, { region: "hills", x: 36, z: -46 }, { region: "hills", x: -2, z: -42 },
  { region: "plain", x: 12, z: 26 }, { region: "plain", x: 34, z: 0 }, { region: "plain", x: 34, z: 36 }, { region: "plain", x: 8, z: -6 },
  { region: "cove", x: -52, z: -50 }, { region: "cove", x: -38, z: -62 },
  { region: "camp", x: 50, z: -58 }, { region: "camp", x: 68, z: -60 },
  { region: "kalidra", x: 58, z: 6 }, { region: "kalidra", x: 58, z: 24 },
];

// ---------------------------------------------------------------- NPC
export type NpcId =
  | "nikias" | "damon" | "eryon" | "gorgias" | "tharos" | "thalia" | "melos" | "pylas" | "arena-k"
  | "varkas" | "sabra" | "rukmar" | "oren" | "azkar" | "taras" | "arena-l";

export type NpcDef = {
  id: NpcId;
  faction: Faction;
  name: { cs: string; en: string };
  role: { cs: string; en: string };
  x: number;
  z: number;
  face: number;
  cls: HeroClass;
  look?: { cloak?: string; crest?: string; skin?: string };
  hero?: "eryon" | "azkar";
  /** Panel, který NPC otevírá (obchod, krčma, bard, aréna). */
  opens?: "krcma" | "kovarna" | "bard" | "arena" | "hradby";
};

export const NPCS: NpcDef[] = [
  { id: "nikias", faction: "kalidra", name: { cs: "Nikias", en: "Nikias" }, role: { cs: "starý rybář", en: "old fisherman" }, x: -50, z: 44, face: 2.4, cls: "vestec", look: { cloak: "#4a5a6a" } },
  { id: "damon", faction: "kalidra", name: { cs: "Damon", en: "Damon" }, role: { cs: "velitel hradeb", en: "wall commander" }, x: 46, z: 9.5, face: -1.4, cls: "hoplit", look: { cloak: "#2c3e5a", crest: "#d8cdb8" } },
  { id: "eryon", faction: "kalidra", name: { cs: "Eryon", en: "Eryon" }, role: { cs: "poslední štít", en: "the last shield" }, x: 47.5, z: 16, face: -1.57, cls: "hoplit", hero: "eryon", opens: "hradby" },
  { id: "gorgias", faction: "kalidra", name: { cs: "Gorgias", en: "Gorgias" }, role: { cs: "hostinský", en: "innkeeper" }, x: 66, z: 7, face: 3.14, cls: "vestec", look: { cloak: "#6a4a2a" }, opens: "krcma" },
  { id: "tharos", faction: "kalidra", name: { cs: "Tharos", en: "Tharos" }, role: { cs: "kovář", en: "smith" }, x: 81, z: 7, face: 3.14, cls: "hoplit", look: { cloak: "#3a2a1c", crest: "#1d1d1d" }, opens: "kovarna" },
  { id: "thalia", faction: "kalidra", name: { cs: "Thalia", en: "Thalia" }, role: { cs: "kněžka moře", en: "sea priestess" }, x: 82, z: 27, face: 2.2, cls: "vestec", look: { cloak: "#e6dccb" } },
  { id: "melos", faction: "kalidra", name: { cs: "Melos", en: "Melos" }, role: { cs: "bard", en: "bard" }, x: 74, z: 20, face: 3.14, cls: "vestec", look: { cloak: "#5a2a5a" }, opens: "bard" },
  { id: "pylas", faction: "kalidra", name: { cs: "Pylas", en: "Pylas" }, role: { cs: "strážný", en: "sentry" }, x: -19, z: -55, face: 2.6, cls: "lucistnik", look: { cloak: "#7a1f16" } },
  { id: "arena-k", faction: "kalidra", name: { cs: "Mistr arény", en: "Arena Master" }, role: { cs: "kruh kamenů", en: "stone circle" }, x: 66, z: 29, face: 0, cls: "hoplit", look: { cloak: "#8a6a2a", crest: "#8a1a12" }, opens: "arena" },
  { id: "varkas", faction: "legie", name: { cs: "Varkas", en: "Varkas" }, role: { cs: "setník", en: "centurion" }, x: -44, z: -55, face: 0.6, cls: "hoplit", look: { cloak: "#5e0d0a", crest: "#140806" } },
  { id: "sabra", faction: "legie", name: { cs: "Sabra", en: "Sabra" }, role: { cs: "markytánka", en: "sutler" }, x: -38, z: -58, face: 0.3, cls: "vestec", look: { cloak: "#4a1414" }, opens: "krcma" },
  { id: "rukmar", faction: "legie", name: { cs: "Rukmar", en: "Rukmar" }, role: { cs: "kovář Legie", en: "Legion smith" }, x: -50, z: -50, face: 1.0, cls: "hoplit", look: { cloak: "#2a2422", crest: "#2a2422" }, opens: "kovarna" },
  { id: "oren", faction: "legie", name: { cs: "Oren", en: "Oren" }, role: { cs: "kněz Rudého slunce", en: "priest of the Red Sun" }, x: 54, z: -60, face: -0.8, cls: "vestec", look: { cloak: "#8a1c12" } },
  { id: "azkar", faction: "legie", name: { cs: "Azkar", en: "Azkar" }, role: { cs: "Syn Rudého slunce", en: "Son of the Red Sun" }, x: 63, z: -71, face: -0.3, cls: "hoplit", hero: "azkar", opens: "hradby" },
  { id: "taras", faction: "legie", name: { cs: "Taras", en: "Taras" }, role: { cs: "bubeník", en: "drummer" }, x: 50, z: -70, face: 0.8, cls: "lucistnik", look: { cloak: "#5e0d0a" }, opens: "bard" },
  { id: "arena-l", faction: "legie", name: { cs: "Mistr zápasů", en: "Pit Master" }, role: { cs: "kruh v táboře", en: "camp ring" }, x: 70, z: -58, face: -2, cls: "hoplit", look: { cloak: "#3a1010", crest: "#140806" }, opens: "arena" },
];

// ---------------------------------------------------------------- stavby Kalidry a táborů
export type Box = { x: number; z: number; w: number; d: number; h: number; kind: "house" | "wall" | "tower" | "tavern" | "smithy" | "temple" | "tent" | "bigtent" | "hut" };

export const BUILDINGS: Box[] = [
  { x: 66, z: 0, w: 9, d: 7, h: 4.2, kind: "tavern" },
  { x: 82, z: 1, w: 8, d: 6, h: 3.6, kind: "smithy" },
  { x: 88, z: 33, w: 12, d: 9, h: 5.5, kind: "temple" },
  { x: 59, z: -7, w: 6, d: 5, h: 3.4, kind: "house" },
  { x: 92, z: -6, w: 6, d: 6, h: 3.8, kind: "house" },
  { x: 93, z: 14, w: 5, d: 7, h: 3.4, kind: "house" },
  { x: 58, z: 38, w: 6, d: 5, h: 3.2, kind: "house" },
  { x: 76, z: 38, w: 7, d: 5, h: 3.6, kind: "house" },
  { x: 72, z: -9, w: 5, d: 4, h: 3.0, kind: "house" },
  { x: -50, z: 41, w: 4.5, d: 3.5, h: 2.6, kind: "hut" },
  { x: 64, z: -76, w: 8, d: 7, h: 4.5, kind: "bigtent" },
  { x: 52, z: -74, w: 4, d: 4, h: 2.8, kind: "tent" },
  { x: 72, z: -66, w: 4, d: 4, h: 2.8, kind: "tent" },
  { x: 56, z: -54, w: 4, d: 4, h: 2.8, kind: "tent" },
  { x: 46, z: -64, w: 4, d: 4, h: 2.8, kind: "tent" },
  { x: -42, z: -46, w: 4, d: 4, h: 2.8, kind: "tent" },
];

/** Hradby jako osové obdélníky; v západní zdi je brána. */
export function cityWalls(): Box[] {
  const { x0, x1, z0, z1, gateZ0, gateZ1 } = CITY;
  const t = 1.6, h = 6;
  return [
    { x: x0, z: (z0 + gateZ0) / 2, w: t, d: gateZ0 - z0, h, kind: "wall" },
    { x: x0, z: (gateZ1 + z1) / 2, w: t, d: z1 - gateZ1, h, kind: "wall" },
    { x: (x0 + x1) / 2, z: z0, w: x1 - x0, d: t, h, kind: "wall" },
    { x: (x0 + x1) / 2, z: z1, w: x1 - x0, d: t, h, kind: "wall" },
    { x: x1, z: (z0 + z1) / 2, w: t, d: z1 - z0, h: h * 0.6, kind: "wall" },
    { x: x0, z: gateZ0 - 1, w: 3.4, d: 3.4, h: h + 2.5, kind: "tower" },
    { x: x0, z: gateZ1 + 1, w: 3.4, d: 3.4, h: h + 2.5, kind: "tower" },
    { x: x0, z: z0, w: 3.6, d: 3.6, h: h + 2, kind: "tower" },
    { x: x0, z: z1, w: 3.6, d: 3.6, h: h + 2, kind: "tower" },
    { x: x1, z: z0, w: 3.6, d: 3.6, h: h + 1, kind: "tower" },
    { x: x1, z: z1, w: 3.6, d: 3.6, h: h + 1, kind: "tower" },
  ];
}

export const AQUEDUCT: Pt[] = [[-64, 24], [-15, -10]];
export const WRECKS: { x: number; z: number; r: number }[] = [
  { x: -71, z: 60, r: 0.6 }, { x: -68, z: 74, r: 2.2 }, { x: -73, z: 46, r: 1.2 },
];
export const SHIPS: { x: number; z: number; r: number }[] = [
  { x: -66, z: -78, r: 0.4 }, { x: -74, z: -68, r: 1.0 }, { x: -58, z: -86, r: 0.9 }, { x: -78, z: -82, r: 0.6 },
];
