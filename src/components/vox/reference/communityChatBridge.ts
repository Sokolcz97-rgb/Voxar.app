import { useSyncExternalStore } from "react";
import type { VoxChannel } from "../ChannelSidebar";

export interface CommunityChatBridgeState {
  guildName: string;
  guildIconUrl?: string | null;
  channels: VoxChannel[];
  onSelectChannel: (channel: VoxChannel) => void;
  onShowRules?: () => void;
}

let snapshot: CommunityChatBridgeState | null = null;
const listeners = new Set<() => void>();

export function setCommunityChatBridge(next: CommunityChatBridgeState | null) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function useCommunityChatBridge() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
