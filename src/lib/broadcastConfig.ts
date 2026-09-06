export type BroadcastPlatform = "twitch" | "youtube" | "kick";

export interface BroadcastDestination {
  platform: BroadcastPlatform;
  label: string;
  server: string;
  streamKey: string;
  enabled: boolean;
}

export interface BroadcastSettings {
  destinations: BroadcastDestination[];
  videoBitrate: number;
  fps: number;
  includeMic: boolean;
  includeSystemAudio: boolean;
}

const STORAGE_KEY = "voxar.broadcast.settings.v1";

export const BROADCAST_DEFAULTS: BroadcastSettings = {
  destinations: [
    { platform: "twitch", label: "Twitch", server: "rtmp://live.twitch.tv/app", streamKey: "", enabled: false },
    { platform: "youtube", label: "YouTube", server: "rtmp://a.rtmp.youtube.com/live2", streamKey: "", enabled: false },
    { platform: "kick", label: "Kick.com", server: "", streamKey: "", enabled: false },
  ],
  videoBitrate: 6000,
  fps: 30,
  includeMic: true,
  includeSystemAudio: true,
};

function normalize(input: any): BroadcastSettings {
  const incoming = input && typeof input === "object" ? input : {};
  const byPlatform = new Map<BroadcastPlatform, any>(
    Array.isArray(incoming.destinations)
      ? incoming.destinations.map((item: any) => [item?.platform, item])
      : [],
  );

  return {
    ...BROADCAST_DEFAULTS,
    ...incoming,
    videoBitrate: Number(incoming.videoBitrate) || BROADCAST_DEFAULTS.videoBitrate,
    fps: Number(incoming.fps) || BROADCAST_DEFAULTS.fps,
    includeMic: incoming.includeMic !== false,
    includeSystemAudio: incoming.includeSystemAudio !== false,
    destinations: BROADCAST_DEFAULTS.destinations.map((base) => ({
      ...base,
      ...(byPlatform.get(base.platform) || {}),
      platform: base.platform,
      label: base.label,
    })),
  };
}

export async function loadBroadcastSettings(): Promise<BroadcastSettings> {
  const desktop = (window as any).studioVoxarioDesktop;
  if (desktop?.getAppSettings) {
    try {
      const appSettings = await desktop.getAppSettings();
      if (appSettings?.broadcast) return normalize(appSettings.broadcast);
    } catch {
      // fall through to browser storage
    }
  }

  try {
    return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return normalize(null);
  }
}

export async function saveBroadcastSettings(next: BroadcastSettings): Promise<BroadcastSettings> {
  const normalized = normalize(next);
  const desktop = (window as any).studioVoxarioDesktop;
  if (desktop?.setAppSettings) {
    try {
      await desktop.setAppSettings({ broadcast: normalized });
    } catch {
      // Keep a local fallback even when desktop persistence is temporarily unavailable.
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function buildRtmpUrl(destination: BroadcastDestination) {
  const server = destination.server.trim().replace(/\/+$/, "");
  const key = destination.streamKey.trim().replace(/^\/+/, "");
  return server && key ? `${server}/${key}` : "";
}
