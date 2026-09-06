import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useVoxVoice } from "@/hooks/useVoxVoice";
import type { VoxChannel } from "@/components/vox/ChannelSidebar";
import { RoomAudioRenderer, RoomContext } from "@livekit/components-react";

type VoiceApi = ReturnType<typeof useVoxVoice>;

type PendingJoin = {
  channelId: string;
  started: boolean;
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason?: unknown) => void;
};

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
  const pendingJoinRef = useRef<PendingJoin | null>(null);

  useEffect(() => {
    const pending = pendingJoinRef.current;
    if (!channel || !pending || pending.started || pending.channelId !== channel.id) return;

    pending.started = true;
    void api.join().then(() => {
      if (pendingJoinRef.current !== pending) return;
      pendingJoinRef.current = null;
      pending.resolve();
    }).catch((error) => {
      const stillCurrent = pendingJoinRef.current === pending;
      if (stillCurrent) {
        pendingJoinRef.current = null;
        setChannel((current) => current?.id === pending.channelId ? null : current);
      }
      pending.reject(error);
    });
  }, [channel, api.join]);

  useEffect(() => () => {
    const pending = pendingJoinRef.current;
    pendingJoinRef.current = null;
    pending?.reject(new Error("Hlasové připojení bylo ukončeno."));
  }, []);

  const joinChannel = useCallback(async (ch: VoxChannel) => {
    const existingPending = pendingJoinRef.current;
    if (existingPending?.channelId === ch.id) return existingPending.promise;

    if (channel?.id === ch.id) {
      if (api.connected) return;
      try {
        await api.join();
      } catch (error) {
        setChannel((current) => current?.id === ch.id ? null : current);
        throw error;
      }
      return;
    }

    if (existingPending) {
      pendingJoinRef.current = null;
      existingPending.reject(new Error("Hlasové připojení bylo nahrazeno jiným kanálem."));
      if (existingPending.started) await api.leave().catch(() => undefined);
    } else if (api.connected || api.connecting) {
      await api.leave();
    }

    let resolveJoin!: () => void;
    let rejectJoin!: (reason?: unknown) => void;
    const promise = new Promise<void>((resolve, reject) => {
      resolveJoin = resolve;
      rejectJoin = reject;
    });

    pendingJoinRef.current = {
      channelId: ch.id,
      started: false,
      promise,
      resolve: resolveJoin,
      reject: rejectJoin,
    };
    setChannel(ch);
    return promise;
  }, [channel?.id, api.connected, api.connecting, api.join, api.leave]);

  const leaveChannel = useCallback(async () => {
    const pending = pendingJoinRef.current;
    pendingJoinRef.current = null;
    pending?.reject(new Error("Hlasové připojení bylo zrušeno."));
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
