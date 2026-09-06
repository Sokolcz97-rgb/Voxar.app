export type VoxUtilityMode = "events" | "files" | "store" | "remove-bg";
export type VoxCommunityContext = { guildId: string | null; isAdmin: boolean };

const CONTEXT_EVENT = "voxar:community-context";
const UTILITY_EVENT = "voxar:utility";
const CHANNEL_EVENT = "voxar:channel-open";

let communityContext: VoxCommunityContext = { guildId: null, isAdmin: false };

export function publishVoxCommunityContext(next: VoxCommunityContext) {
  communityContext = next;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CONTEXT_EVENT, { detail: next }));
}

export function getVoxCommunityContext() {
  return communityContext;
}

export function subscribeVoxCommunityContext(listener: (context: VoxCommunityContext) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<VoxCommunityContext>).detail);
  window.addEventListener(CONTEXT_EVENT, handler);
  return () => window.removeEventListener(CONTEXT_EVENT, handler);
}

export function openVoxUtility(mode: VoxUtilityMode | null) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(UTILITY_EVENT, { detail: mode }));
}

export function subscribeVoxUtility(listener: (mode: VoxUtilityMode | null) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => listener((event as CustomEvent<VoxUtilityMode | null>).detail);
  window.addEventListener(UTILITY_EVENT, handler);
  return () => window.removeEventListener(UTILITY_EVENT, handler);
}

export function openVoxChannel(channelId: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHANNEL_EVENT, { detail: channelId }));
}

export function subscribeVoxChannel(listener: (channelId: string) => void) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => listener(String((event as CustomEvent<string>).detail || ""));
  window.addEventListener(CHANNEL_EVENT, handler);
  return () => window.removeEventListener(CHANNEL_EVENT, handler);
}
