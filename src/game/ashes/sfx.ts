import { music } from "./audio";

/**
 * Zvukové efekty hry. Zvuky se syntetizují přes Web Audio (žádné soubory ke stažení),
 * hlasitost řídí nastavení „Efekty“ × „Celková hlasitost“ (music.sfxLevel).
 * Později je lze nahradit nahrávkami – stačí změnit implementaci `play`.
 */
export type Sfx = "hit" | "crit" | "block" | "evade" | "victory" | "defeat" | "click" | "quest" | "level" | "fire";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noiseBuffer(c: AudioContext) {
  if (noise) return noise;
  noise = c.createBuffer(1, c.sampleRate * 0.6, c.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return noise;
}

function tone(c: AudioContext, out: AudioNode, freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.5, slideTo?: number) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(out);
  o.start(start);
  o.stop(start + dur + 0.05);
}

function burst(c: AudioContext, out: AudioNode, start: number, dur: number, freq: number, gain = 0.6) {
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = freq;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(out);
  src.start(start);
  src.stop(start + dur + 0.05);
}

export function playSfx(kind: Sfx) {
  const level = music.sfxLevel;
  if (level <= 0.001) return;
  const c = audio();
  if (!c) return;
  const out = c.createGain();
  out.gain.value = level * 0.55;
  out.connect(c.destination);
  const t = c.currentTime + 0.01;
  switch (kind) {
    case "hit":
      burst(c, out, t, 0.14, 900, 0.8);
      tone(c, out, 180, t, 0.12, "triangle", 0.35, 90);
      break;
    case "crit":
      burst(c, out, t, 0.22, 1400, 0.9);
      tone(c, out, 260, t, 0.25, "sawtooth", 0.25, 70);
      break;
    case "block":
      tone(c, out, 620, t, 0.35, "square", 0.12);
      tone(c, out, 930, t, 0.3, "sine", 0.18);
      burst(c, out, t, 0.06, 3000, 0.4);
      break;
    case "evade":
      burst(c, out, t, 0.18, 2400, 0.25);
      break;
    case "victory":
      [392, 523, 659, 784].forEach((f, i) => tone(c, out, f, t + i * 0.12, 0.5, "triangle", 0.3));
      break;
    case "defeat":
      [330, 262, 196].forEach((f, i) => tone(c, out, f, t + i * 0.18, 0.6, "sine", 0.3));
      break;
    case "click":
      tone(c, out, 1200, t, 0.05, "sine", 0.15);
      break;
    case "quest":
      [523, 659, 784, 1047].forEach((f, i) => tone(c, out, f, t + i * 0.09, 0.45, "sine", 0.25));
      break;
    case "level":
      [523, 784, 1047, 1568].forEach((f, i) => tone(c, out, f, t + i * 0.1, 0.7, "triangle", 0.28));
      break;
    case "fire":
      burst(c, out, t, 0.5, 600, 0.5);
      tone(c, out, 110, t, 0.5, "sawtooth", 0.15, 220);
      break;
  }
  window.setTimeout(() => out.disconnect(), 3000);
}
