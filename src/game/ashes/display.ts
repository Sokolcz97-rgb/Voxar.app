/**
 * Režim zobrazení a rozlišení.
 * - V aplikaci (launcher) přepíná herní okno přes `window.ashesDesktop` (Electron).
 * - V prohlížeči umí jen celou obrazovku (Fullscreen API).
 * - „Rozlišení vykreslování“ snižuje počet vykreslovaných pixelů (výkon na slabších PC).
 */
export type DisplayMode = "windowed" | "maximized" | "fullscreen";
export type Upscale = "off" | "quality" | "balanced" | "performance" | "ultra";
export type DisplaySettings = {
  mode: DisplayMode;
  width: number;
  height: number;
  /** stará volba (podíl rozlišení) – nahrazena `upscale` */
  renderScale: number;
  /** výška vykreslovaného obrazu v px (720, 1080, 1440 …), 0 = nativní */
  resolution: number;
  /** zvětšování obrazu: kolik pixelů se skutečně vykreslí */
  upscale: Upscale;
  /** doostření při zvětšování (jako AMD FSR 1 / CAS) */
  sharpen: boolean;
  /** limit snímků za sekundu, 0 = bez limitu */
  fpsCap: number;
  showFps: boolean;
};

export const UPSCALE: Record<Upscale, number> = { off: 1, quality: 0.77, balanced: 0.67, performance: 0.5, ultra: 0.33 };
export const RENDER_HEIGHTS = [0, 720, 900, 1080, 1440, 2160];

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
const DEFAULTS: DisplaySettings = { mode: "windowed", width: 1600, height: 900, renderScale: 1, resolution: 0, upscale: "off", sharpen: true, fpsCap: 0, showFps: false };

export function getDisplay(): DisplaySettings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (v && typeof v === "object") {
      const out = { ...DEFAULTS, ...v } as DisplaySettings;
      // převod staré volby „rozlišení vykreslování“
      if (!("upscale" in v) && typeof v.renderScale === "number" && v.renderScale < 1) {
        out.upscale = v.renderScale >= 0.85 ? "quality" : v.renderScale >= 0.7 ? "balanced" : "performance";
      }
      if (!(out.upscale in UPSCALE)) out.upscale = "off";
      return out;
    }
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
