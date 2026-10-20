import * as THREE from "three";

/**
 * Stavby z GLB modelů (`public/game/models/buildings`): vila s modrými okenicemi,
 * chrám a stánky na tržišti. Model se natočí, usadí na zem a zmenší tak, aby se
 * vešel do půdorysu w × d. Když se model nenačte, zavolá se `fallback`
 * (procedurální stavba).
 */

export type BuildingModel = "villa" | "temple" | "stall";

const cache = new Map<string, Promise<THREE.Group | null>>();

function load(file: string) {
  let p = cache.get(file);
  if (!p) {
    p = import("three/examples/jsm/loaders/GLTFLoader.js")
      .then(({ GLTFLoader }) => new GLTFLoader().loadAsync(`/game/models/buildings/${file}.glb`))
      .then((g) => g.scene as THREE.Group)
      .catch(() => null);
    cache.set(file, p);
  }
  return p;
}

/** Úsporný režim: jen jednoduché modely staveb (cca 5 000 trojúhelníků místo 30–40 000). */
let liteBuildings = false;
export function setLiteBuildings(on: boolean) {
  liteBuildings = on;
}
/** Od jaké vzdálenosti se místo detailního modelu kreslí jednoduchý. */
const LOD_DISTANCE = 32;

/** Natočení po 90° tak, aby vchod (+Z modelu) mířil k bodu (tx, tz). */
export function faceToward(x: number, z: number, tx: number, tz: number) {
  const a = Math.atan2(tx - x, tz - z);
  return Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
}

export function placeBuilding(
  scene: THREE.Object3D,
  kind: BuildingModel,
  opts: { x: number; y: number; z: number; w: number; d: number; rotY: number; fill?: number },
  fallback: () => void,
  onPlaced?: (holder: THREE.Object3D) => void,
) {
  const fit = (src: THREE.Group) => {
    const model = src.clone(true);
    const turn = new THREE.Group();
    turn.add(model);
    turn.rotation.y = opts.rotY;
    turn.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(turn);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = Math.min(opts.w / (size.x || 1), opts.d / (size.z || 1)) * (opts.fill ?? 1);
    const g = new THREE.Group();
    g.add(turn);
    turn.position.set(-center.x, -box.min.y, -center.z);
    g.scale.setScalar(s);
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
    return g;
  };
  void Promise.all([liteBuildings ? Promise.resolve(null) : load(kind), load(`${kind}_lo`)]).then(([hi, lo]) => {
    if (!hi && !lo) {
      fallback();
      return;
    }
    // detail zblízka, jednoduchý model z dálky (LOD)
    const holder = new THREE.LOD();
    if (hi) holder.addLevel(fit(hi), 0);
    if (lo) holder.addLevel(fit(lo), hi ? LOD_DISTANCE : 0);
    // lehce zapustit do terénu, ať pod stavbou není mezera ve svahu
    holder.position.set(opts.x, opts.y - 0.08, opts.z);
    scene.add(holder);
    onPlaced?.(holder);
  });
}
