import * as THREE from "three";

/** Měkká záře pro oheň, jiskry a lucerny. */
export function glowTexture(inner: string, outer: string) {
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

let fireTexture: THREE.Texture | null = null;
export function getFireTexture() {
  if (!fireTexture) fireTexture = glowTexture("rgba(255,244,214,1)", "rgba(255,120,30,.85)");
  return fireTexture;
}

/** Oheň ze sprajtů s blikajícím světlem. `lit = false` ho zhasne (zůstane doutnající). */
export class Fire {
  readonly group = new THREE.Group();
  private sprites: { s: THREE.Sprite; life: number; speed: number; x: number; z: number }[] = [];
  private light: THREE.PointLight | null;
  private size: number;
  lit = true;

  constructor(size = 1, withLight = true) {
    this.size = size;
    const tex = getFireTexture();
    for (let i = 0; i < 16; i += 1) {
      const mat = new THREE.SpriteMaterial({
        map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
        color: new THREE.Color().setHSL(0.06 + Math.random() * 0.04, 1, 0.55),
      });
      const s = new THREE.Sprite(mat);
      this.group.add(s);
      this.sprites.push({ s, life: Math.random(), speed: 0.6 + Math.random() * 0.6, x: (Math.random() - 0.5) * 0.3 * size, z: (Math.random() - 0.5) * 0.3 * size });
    }
    this.light = withLight ? new THREE.PointLight("#ff8a3a", 2.4 * size, 7 * size, 1.6) : null;
    if (this.light) {
      this.light.position.y = 0.6 * size;
      this.group.add(this.light);
    }
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
      const scale = (0.55 - k * 0.4) * this.size * (this.lit ? 1 : 0.25);
      p.s.position.set(p.x * (1 - k), k * (this.lit ? 0.9 : 0.25) * this.size, p.z * (1 - k));
      p.s.scale.set(scale, scale * 1.3, 1);
      p.s.material.opacity = Math.sin(k * Math.PI) * (this.lit ? 0.9 : 0.35);
    }
    if (this.light) this.light.intensity = this.lit ? (2.2 + Math.sin(t * 11) * 0.3 + Math.sin(t * 17.3) * 0.2) * this.size : 0.15;
  }
}
