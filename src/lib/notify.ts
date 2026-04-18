// Browser notifications + sound for new DMs

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new Ctx();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

type ToneStep = { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number };

function playSequence(steps: ToneStep[]) {
  const ctx = getCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  for (const s of steps) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = s.type ?? "sine";
    osc.frequency.setValueAtTime(s.freq, t0 + s.start);
    const peak = s.gain ?? 0.15;
    gain.gain.setValueAtTime(0.0001, t0 + s.start);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + s.start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + s.start + s.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0 + s.start);
    osc.stop(t0 + s.start + s.dur + 0.02);
  }
}

export type NotifSoundId = "ping" | "chime" | "blip" | "pop" | "bell" | "arcade" | "soft";

export const NOTIF_SOUNDS: { id: NotifSoundId; labelKey: string }[] = [
  { id: "ping", labelKey: "profile.sounds.ping" },
  { id: "chime", labelKey: "profile.sounds.chime" },
  { id: "blip", labelKey: "profile.sounds.blip" },
  { id: "pop", labelKey: "profile.sounds.pop" },
  { id: "bell", labelKey: "profile.sounds.bell" },
  { id: "arcade", labelKey: "profile.sounds.arcade" },
  { id: "soft", labelKey: "profile.sounds.soft" },
];

const STORAGE_KEY = "notify_sound_id";

export function getNotifSoundId(): NotifSoundId {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as NotifSoundId | null;
    if (v && NOTIF_SOUNDS.some((s) => s.id === v)) return v;
  } catch {
    // ignore
  }
  return "ping";
}

export function setNotifSoundId(id: NotifSoundId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function playNotifSound(id: NotifSoundId = getNotifSoundId()) {
  switch (id) {
    case "chime":
      playSequence([
        { freq: 880, start: 0, dur: 0.22, type: "sine" },
        { freq: 1318, start: 0.12, dur: 0.28, type: "sine" },
      ]);
      return;
    case "blip":
      playSequence([
        { freq: 660, start: 0, dur: 0.08, type: "square", gain: 0.1 },
        { freq: 990, start: 0.09, dur: 0.08, type: "square", gain: 0.1 },
      ]);
      return;
    case "pop":
      playSequence([{ freq: 220, start: 0, dur: 0.12, type: "triangle", gain: 0.18 }]);
      return;
    case "bell":
      playSequence([
        { freq: 1568, start: 0, dur: 0.5, type: "sine", gain: 0.12 },
        { freq: 2093, start: 0.05, dur: 0.45, type: "sine", gain: 0.06 },
      ]);
      return;
    case "arcade":
      playSequence([
        { freq: 523, start: 0, dur: 0.08, type: "square", gain: 0.1 },
        { freq: 659, start: 0.08, dur: 0.08, type: "square", gain: 0.1 },
        { freq: 784, start: 0.16, dur: 0.12, type: "square", gain: 0.1 },
      ]);
      return;
    case "soft":
      playSequence([{ freq: 523, start: 0, dur: 0.4, type: "sine", gain: 0.08 }]);
      return;
    case "ping":
    default:
      playSequence([{ freq: 880, start: 0, dur: 0.25, type: "sine", gain: 0.15 }]);
      return;
  }
}

// Backward-compat: existing imports of playBeep keep working, using the user's chosen sound.
export function playBeep() {
  playNotifSound();
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const res = await Notification.requestPermission();
    return res === "granted";
  } catch {
    return false;
  }
}

export function showNotification(title: string, body: string, onClick?: () => void) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { body, icon: "/favicon.ico", tag: "dm" });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
        n.close();
      };
    }
  } catch {
    // ignore
  }
}
