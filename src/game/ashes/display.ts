/**
 * Režim zobrazení a rozlišení.
 * - V aplikaci (launcher) přepíná herní okno přes `window.ashesDesktop` (Electron).
 * - V prohlížeči umí jen celou obrazovku (Fullscreen API).
 * - „Rozlišení vykreslování“ snižuje počet vykreslovaných pixelů (výkon na slabších PC).
 */
export type DisplayMode = "windowed" | "maximized" | "fullscreen";
export type DisplaySettings = { mode: DisplayMode; width: number; height: number; renderScale: number };

type DesktopBridge = {
  isDesktop: true;
  exit: () => Promise<boolean>;
  setDisplay: (o: { mode: DisplayMode; width?: number; height?: number }) => Promise<unknown>;
  getDisplay: () => Promise<{ mode: DisplayMode; width: number; height: number; screen: { width: number; height: number } } | null>;
};

export function desktop(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  const d = (window as unknown as { ashesDesktop?: DesktopBridge }).ashesDesktop;
  return d?.isDesktop ? d : null;
}

export const isDesktop = () => !!desktop();

export const RESOLUTIONS: [number, number][] = [
  [1280, 720],
  [1366, 768],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
];

const KEY = "ashes.display";
const DEFAULTS: DisplaySettings = { mode: "windowed", width: 1600, height: 900, renderScale: 1 };

export function getDisplay(): DisplaySettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v === "object") return { ...DEFAULTS, ...v };
  } catch {
    /* bez úložiště */
  }
  return { ...DEFAULTS };
}

export function saveDisplay(s: DisplaySettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* bez úložiště */
  }
}

/** Použije režim okna. V prohlížeči umí jen celou obrazovku / okno. */
export async function applyDisplayMode(s: DisplaySettings) {
  const d = desktop();
  if (d) {
    await d.setDisplay({ mode: s.mode, width: s.width, height: s.height });
    return;
  }
  try {
    if (s.mode === "fullscreen" && !document.fullscreenElement) await document.documentElement.requestFullscreen();
    if (s.mode !== "fullscreen" && document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* prohlížeč celou obrazovku odmítl (vyžaduje kliknutí) */
  }
}

/** Ukončí hru: v aplikaci zavře herní okno (návrat do launcheru), na webu přejde na hlavní stránku. */
export function exitGame() {
  const d = desktop();
  if (d) {
    void d.exit();
    return;
  }
  window.location.assign("/");
}
