import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useVoxVoice } from "@/hooks/useVoxVoice";
import type { VoxChannel } from "@/components/vox/ChannelSidebar";

type VoiceApi = ReturnType<typeof useVoxVoice>;

interface VoiceCallCtx {
  channel: VoxChannel | null;
  api: VoiceApi;
  joinChannel: (ch: VoxChannel) => Promise<void>;
  leaveChannel: () => Promise<void>;
}

const Ctx = createContext<VoiceCallCtx | null>(null);

/**
 * Global, route-independent voice session.
 * Mounted above the router so WebRTC peers, signaling and audio elements
 * survive navigation between channels, pages and views.
 */
export function VoiceCallProvider({ children }: { children: ReactNode }) {
  const [channel, setChannel] = useState<VoxChannel | null>(null);
  const api = useVoxVoice(channel?.id ?? null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (channel && pendingRef.current) {
      pendingRef.current = false;
      void api.join();
    }
  }, [channel, api.join]);

  const joinChannel = useCallback(async (ch: VoxChannel) => {
    if (channel?.id === ch.id) {
      if (!api.connected) await api.join();
      return;
    }
    if (api.connected) await api.leave();
    pendingRef.current = true;
    setChannel(ch);
  }, [channel?.id, api.connected, api.join, api.leave]);

  const leaveChannel = useCallback(async () => {
    pendingRef.current = false;
    await api.leave();
    setChannel(null);
  }, [api.leave]);

  return (
    <Ctx.Provider value={{ channel: api.connected ? channel : channel, api, joinChannel, leaveChannel }}>
      {children}
    </Ctx.Provider>
  );
}

export function useVoiceCall() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVoiceCall must be used inside VoiceCallProvider");
  return ctx;
}
