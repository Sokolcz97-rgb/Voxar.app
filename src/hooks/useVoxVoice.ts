import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface RemotePeer {
  userId: string;
  stream: MediaStream | null;
  level: number;
}

const ICE = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

/**
 * WebRTC mesh voice room powered by Supabase Realtime broadcast for signaling.
 * Handles join/leave, offer/answer/ice exchange, mute/deafen.
 */
export function useVoxVoice(channelId: string | null) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [remotes, setRemotes] = useState<Record<string, RemotePeer>>({});
  const [selfLevel, setSelfLevel] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());

  const updateRemote = (userId: string, patch: Partial<RemotePeer>) => {
    setRemotes((prev) => ({ ...prev, [userId]: { userId, stream: null, level: 0, ...prev[userId], ...patch } }));
  };

  const removeRemote = (userId: string) => {
    setRemotes((prev) => {
      const n = { ...prev };
      delete n[userId];
      return n;
    });
  };

  const meterStream = (stream: MediaStream, cb: (l: number) => void) => {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    const ctx = audioContextRef.current;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
      cb(peak / 128);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  };

  const createPeer = useCallback((remoteUserId: string, initiator: boolean) => {
    if (peersRef.current[remoteUserId]) return peersRef.current[remoteUserId];
    const pc = new RTCPeerConnection(ICE);
    peersRef.current[remoteUserId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
    }

    pc.ontrack = (ev) => {
      const [stream] = ev.streams;
      updateRemote(remoteUserId, { stream });
      // playback element
      let audio = document.getElementById(`vox-audio-${remoteUserId}`) as HTMLAudioElement | null;
      if (!audio) {
        audio = document.createElement("audio");
        audio.id = `vox-audio-${remoteUserId}`;
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
      audio.srcObject = stream;
      audio.muted = deafened;
      meterStream(stream, (l) => updateRemote(remoteUserId, { level: l }));
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice",
          payload: { from: user!.id, to: remoteUserId, candidate: ev.candidate },
        });
      }
    };

    if (initiator) {
      (async () => {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current?.send({
          type: "broadcast",
          event: "offer",
          payload: { from: user!.id, to: remoteUserId, sdp: offer },
        });
      })();
    }

    return pc;
  }, [user, deafened]);

  const join = useCallback(async () => {
    if (!user || !channelId || connected) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;
      meterStream(stream, setSelfLevel);
    } catch (e) {
      console.error("Mikrofon nedostupný", e);
      return;
    }

    // Register in DB (visible to other clients even without listening on broadcast)
    await supabase.from("vox_voice_participants").upsert({
      channel_id: channelId,
      user_id: user.id,
      session_id: sessionIdRef.current,
      is_muted: false,
      is_deafened: false,
    });

    const ch = supabase.channel(`vox_voice_${channelId}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;

    ch.on("broadcast", { event: "join" }, ({ payload }) => {
      if (payload.from === user.id) return;
      // Existing peer initiates offer to newcomer if our id < their id (deterministic)
      if (user.id < payload.from) createPeer(payload.from, true);
    });
    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.to !== user.id) return;
      const pc = createPeer(payload.from, false);
      await pc.setRemoteDescription(payload.sdp);
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      ch.send({ type: "broadcast", event: "answer", payload: { from: user.id, to: payload.from, sdp: ans } });
    });
    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.to !== user.id) return;
      const pc = peersRef.current[payload.from];
      if (pc) await pc.setRemoteDescription(payload.sdp);
    });
    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (payload.to !== user.id) return;
      const pc = peersRef.current[payload.from];
      if (pc) { try { await pc.addIceCandidate(payload.candidate); } catch {} }
    });
    ch.on("broadcast", { event: "leave" }, ({ payload }) => {
      const pc = peersRef.current[payload.from];
      if (pc) { pc.close(); delete peersRef.current[payload.from]; }
      removeRemote(payload.from);
      const audio = document.getElementById(`vox-audio-${payload.from}`);
      audio?.remove();
    });

    await ch.subscribe();
    ch.send({ type: "broadcast", event: "join", payload: { from: user.id } });
    setConnected(true);
  }, [user, channelId, connected, createPeer]);

  const leave = useCallback(async () => {
    if (!user || !channelId) return;
    channelRef.current?.send({ type: "broadcast", event: "leave", payload: { from: user.id } });
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    document.querySelectorAll("[id^='vox-audio-']").forEach((el) => el.remove());
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (channelRef.current) await supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setRemotes({});
    setSelfLevel(0);
    setConnected(false);
    await supabase.from("vox_voice_participants").delete().eq("channel_id", channelId).eq("user_id", user.id);
  }, [user, channelId]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const nm = !m;
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !nm));
      if (user && channelId) {
        supabase.from("vox_voice_participants")
          .update({ is_muted: nm })
          .eq("channel_id", channelId).eq("user_id", user.id).then(() => {});
      }
      return nm;
    });
  }, [user, channelId]);

  const toggleDeafen = useCallback(() => {
    setDeafened((d) => {
      const nd = !d;
      document.querySelectorAll<HTMLAudioElement>("[id^='vox-audio-']").forEach((a) => (a.muted = nd));
      if (nd && !muted) toggleMute();
      if (user && channelId) {
        supabase.from("vox_voice_participants")
          .update({ is_deafened: nd })
          .eq("channel_id", channelId).eq("user_id", user.id).then(() => {});
      }
      return nd;
    });
  }, [muted, toggleMute, user, channelId]);

  useEffect(() => () => { void leave(); }, [leave]);

  return { connected, muted, deafened, remotes, selfLevel, join, leave, toggleMute, toggleDeafen };
}
