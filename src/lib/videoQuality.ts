/** Shared video / screen-share quality presets for Voxar voice channels. */

export type QualityKey = "480p" | "720p" | "1080p" | "1440p";

export interface QualityPreset {
  key: QualityKey;
  label: string;
  width: number;
  height: number;
}

export const QUALITY_PRESETS: QualityPreset[] = [
  { key: "480p", label: "480p", width: 854, height: 480 },
  { key: "720p", label: "720p HD", width: 1280, height: 720 },
  { key: "1080p", label: "1080p Full HD", width: 1920, height: 1080 },
  { key: "1440p", label: "1440p QHD", width: 2560, height: 1440 },
];

export const FPS_OPTIONS = [15, 30, 60] as const;
export type FpsOption = (typeof FPS_OPTIONS)[number];

export interface VideoPrefs {
  camQuality: QualityKey;
  camFps: FpsOption;
  screenQuality: QualityKey;
  screenFps: FpsOption;
}

const KEY = "sv.videoPrefs";

export const DEFAULT_VIDEO_PREFS: VideoPrefs = {
  camQuality: "1080p",
  camFps: 30,
  screenQuality: "1080p",
  screenFps: 30,
};

export function readVideoPrefs(): VideoPrefs {
  try {
    return { ...DEFAULT_VIDEO_PREFS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULT_VIDEO_PREFS };
  }
}

export function writeVideoPrefs(patch: Partial<VideoPrefs>): VideoPrefs {
  const next = { ...readVideoPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("sv:video-prefs"));
  } catch { /* noop */ }
  return next;
}

export function presetOf(key: QualityKey): QualityPreset {
  return QUALITY_PRESETS.find((p) => p.key === key) ?? QUALITY_PRESETS[2];
}

/** Electron desktop capture source (screen or a single window / game). */
export interface CaptureSource {
  id: string;
  name: string;
  type: "screen" | "window";
  thumbnail: string | null;
  appIcon: string | null;
}

interface DesktopBridge {
  getCaptureSources?: () => Promise<CaptureSource[]>;
  selectCaptureSource?: (id: string) => Promise<boolean>;
}

function bridge(): DesktopBridge | null {
  return (window as unknown as { studioVoxarioDesktop?: DesktopBridge }).studioVoxarioDesktop ?? null;
}

export const isDesktopCapture = () => typeof bridge()?.getCaptureSources === "function";

export async function listCaptureSources(): Promise<CaptureSource[]> {
  const b = bridge();
  if (!b?.getCaptureSources) return [];
  try { return await b.getCaptureSources(); } catch { return []; }
}

export async function selectCaptureSource(id: string) {
  try { await bridge()?.selectCaptureSource?.(id); } catch { /* noop */ }
}
