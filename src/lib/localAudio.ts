/**
 * Per-user local audio preferences (volume 0..2, mute).
 * Purely client-side; persisted to localStorage and reactive via subscribe().
 */

const KEY = "sv.localAudio.v1";

type State = {
  volume: Record<string, number>; // 0..2 (0% .. 200%)
  muted: Record<string, boolean>;
};

let state: State = load();
const listeners = new Set<() => void>();

function load(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { volume: raw.volume ?? {}, muted: raw.muted ?? {} };
  } catch {
    return { volume: {}, muted: {} };
  }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
function emit() {
  listeners.forEach((l) => { try { l(); } catch {} });
}

export const localAudio = {
  getVolume(uid: string): number {
    return state.volume[uid] ?? 1;
  },
  setVolume(uid: string, v: number) {
    const clamped = Math.max(0, Math.min(2, v));
    state = { ...state, volume: { ...state.volume, [uid]: clamped } };
    persist(); emit();
  },
  isMuted(uid: string): boolean {
    return !!state.muted[uid];
  },
  setMuted(uid: string, m: boolean) {
    state = { ...state, muted: { ...state.muted, [uid]: m } };
    persist(); emit();
  },
  toggleMuted(uid: string) {
    this.setMuted(uid, !this.isMuted(uid));
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  snapshot(): State {
    return state;
  },
};

/** Apply a user's local prefs to an existing <audio> element. */
export function applyLocalAudioToElement(uid: string, audio: HTMLAudioElement, deafened: boolean) {
  const muted = deafened || localAudio.isMuted(uid);
  const vol = localAudio.getVolume(uid);
  audio.muted = muted;
  audio.volume = Math.max(0, Math.min(1, vol)); // <audio>.volume caps at 1; >1 requires WebAudio gain
}
