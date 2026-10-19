import { useEffect, useRef } from "react";
import type { Faction, WQuest } from "../types";
import { BEACONS, CITY, MEMORIAL, WORLD_HALF, heightAt, inCity } from "../world/map";
import { questTargets } from "../world/quests";
import type { OpenWorld } from "../world/openWorld";

const SIZE = 168;
let terrainCache: HTMLCanvasElement | null = null;

/** Podklad minimapy – spočítá se jednou z výškové mapy. */
function terrain() {
  if (terrainCache) return terrainCache;
  const n = 120;
  const c = document.createElement("canvas");
  c.width = n;
  c.height = n;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const img = ctx.createImageData(n, n);
  for (let j = 0; j < n; j += 1) {
    for (let i = 0; i < n; i += 1) {
      const x = (i / n) * 2 * WORLD_HALF - WORLD_HALF;
      const z = (j / n) * 2 * WORLD_HALF - WORLD_HALF;
      const h = heightAt(x, z);
      let r: number, g: number, b: number;
      if (h < 0.25) [r, g, b] = [24, 46, 66];
      else if (h < 1) [r, g, b] = [150, 132, 96];
      else if (inCity(x, z)) [r, g, b] = [126, 112, 92];
      else {
        const t = Math.min(1, h / 14);
        [r, g, b] = [86 + t * 60, 92 + t * 34, 52 + t * 30];
      }
      const k = (j * n + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  terrainCache = c;
  return c;
}

const toMap = (v: number) => ((v + WORLD_HALF) / (2 * WORLD_HALF)) * SIZE;

export function Minimap({ world, faction, wquests }: { world: OpenWorld | null; faction: Faction; wquests: WQuest[] | undefined }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const questsRef = useRef(wquests);
  questsRef.current = wquests;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !world) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    const bg = terrain();
    const draw = () => {
      const m = world.minimap();
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(bg, 0, 0, SIZE, SIZE);
      // hradby
      ctx.strokeStyle = "rgba(232, 214, 170, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(toMap(CITY.x0), toMap(CITY.z0), toMap(CITY.x1) - toMap(CITY.x0), toMap(CITY.z1) - toMap(CITY.z0));
      // vatry a památník
      for (const b of BEACONS) {
        ctx.fillStyle = "#ff8a3a";
        ctx.fillRect(toMap(b.x) - 1.5, toMap(b.z) - 1.5, 3, 3);
      }
      ctx.fillStyle = "#cfd6e0";
      ctx.fillRect(toMap(MEMORIAL.x) - 1.5, toMap(MEMORIAL.z) - 1.5, 3, 3);
      // nepřátelé
      ctx.fillStyle = "#d2492b";
      for (const e of m.enemies) {
        ctx.beginPath();
        ctx.arc(toMap(e.x), toMap(e.z), 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      // NPC
      ctx.fillStyle = "#f0d39a";
      for (const n of m.npcs) {
        ctx.beginPath();
        ctx.arc(toMap(n.x), toMap(n.z), 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      // ostatní hráči
      ctx.fillStyle = "#7fc8ff";
      for (const o of m.others) {
        ctx.beginPath();
        ctx.arc(toMap(o.x), toMap(o.z), 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // cíle úkolů
      const t = performance.now() / 400;
      for (const q of questTargets(faction, questsRef.current)) {
        const x = toMap(q.x), y = toMap(q.z);
        ctx.font = "bold 12px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(0,0,0,0.8)";
        const ch = q.kind === "offer" ? "!" : q.kind === "ready" ? "?" : "◆";
        ctx.strokeText(ch, x, y + 4 - Math.sin(t) * 1.2);
        ctx.fillStyle = q.kind === "goal" ? "#ffd56a" : "#ffe9a8";
        ctx.fillText(ch, x, y + 4 - Math.sin(t) * 1.2);
      }
      // hráč (šipka)
      const px = toMap(m.player.x), py = toMap(m.player.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.PI - m.player.ry);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(3.5, 4);
      ctx.lineTo(0, 2);
      ctx.lineTo(-3.5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    draw();
    const t = window.setInterval(draw, 200);
    return () => window.clearInterval(t);
  }, [world, faction]);

  return <canvas ref={ref} className="ash-minimap ash-frame" style={{ width: SIZE, height: SIZE }} aria-hidden="true" />;
}
