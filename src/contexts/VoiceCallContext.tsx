import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useVoxVoice } from "@/hooks/useVoxVoice";
import type { VoxChannel } from "@/components/vox/ChannelSidebar";
import { RoomAudioRenderer, RoomContext } from "@livekit/components-react";

type VoiceApi = ReturnType<typeof useVoxVoice>;

interface VoiceCallCtx {
  channel: VoxChannel | null;
  api: VoiceApi;
  joinChannel: (ch: VoxChannel) => Promise<void>;
  leaveChannel: () => Promise<void>;
}

const Ctx = createContext<VoiceCallCtx | null>(null);

/**
 * Global, route-independent LiveKit room session.
 * Mounted above the router so the SFU connection and media tracks survive navigation.
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
    <RoomContext.Provider value={api.room}>
      <Ctx.Provider value={{ channel, api, joinChannel, leaveChannel }}>
        {children}
        <RoomAudioRenderer room={api.room} muted={api.deafened} />
      </Ctx.Provider>
    </RoomContext.Provider>
  );
}

export function useVoiceCall() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useVoiceCall must be used inside VoiceCallProvider");
  return ctx;
}
