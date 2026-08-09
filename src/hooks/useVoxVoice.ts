import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { localAudio } from "@/lib/localAudio";
import { toast } from "@/hooks/use-toast";
import {
  readVideoPrefs, writeVideoPrefs, presetOf, isDesktopCapture, selectCaptureSource,
  type QualityKey,
} from "@/lib/videoQuality";



interface RemotePeer {
  userId: string;
  stream: MediaStream | null;
  level: number;
}

interface PendingIceCandidate {
  candidate: RTCIceCandidateInit;
  connectionId?: string;
}

const ICE = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};

const VOICE_PREF_KEY = "sv.voicePrefs";

interface VoicePrefs {
  inputDeviceId?: string;
  outputDeviceId?: string;
  inputGainDb?: number;      // -30..+20 dB, default 0
  autoDetect?: boolean;       // Automatic voice detection (VAD)
  vadThresholdDb?: number;    // e.g. -50 dB
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
}

function readVoicePrefs(): VoicePrefs {
  try { return JSON.parse(localStorage.getItem(VOICE_PREF_KEY) || "{}"); } catch { return {}; }
}

/**
 * WebRTC mesh voice room powered by Supabase Realtime broadcast for signaling.
 * Handles join/leave, offer/answer/ice exchange, mute/deafen.
 * Applies per-user voice prefs (device, gain in dB, VAD, DSP toggles).
 */
export function useVoxVoice(channelId: string | null) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [remotes, setRemotes] = useState<Record<string, RemotePeer>>({});
  const [selfLevel, setSelfLevel] = useState(0);
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());
  const [videoOn, setVideoOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);

  const rawStreamRef = useRef<MediaStream | null>(null);        // raw mic (for metering)
  const localStreamRef = useRef<MediaStream | null>(null);      // processed (published to peers)
  const camStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const extraTracksRef = useRef<MediaStreamTrack[]>([]);        // camera / screen video published to peers
  const gainNodeRef = useRef<GainNode | null>(null);
  const vadGainRef = useRef<GainNode | null>(null);
  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const metersRef = useRef<Array<() => void>>([]);
  const remoteMetersRef = useRef<Record<string, () => void>>({});
  const pendingIceRef = useRef<Record<string, PendingIceCandidate[]>>({});
  const peerConnectionIdsRef = useRef<Record<string, string>>({});
  const reconnectTimersRef = useRef<Record<string, number>>({});
  const dropTimersRef = useRef<Record<string, number>>({});
  const connectedRef = useRef(false);
  const joiningRef = useRef(false);
  const mutedRef = useRef(false);
  const deafenedRef = useRef(false);
  const accessTokenRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      accessTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => sub.subscription.unsubscribe();
  }, []);

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

  const ensureCtx = async () => {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) throw new Error("AudioContext není v tomto prohlížeči dostupný");
    if (!audioContextRef.current) audioContextRef.current = new AudioCtor();
    if (audioContextRef.current.state === "suspended") {
      try { await audioContextRef.current.resume(); } catch {}
    }
    return audioContextRef.current;
  };

  const meterStream = (stream: MediaStream, cb: (l: number) => void) => {
    const ctx = audioContextRef.current;
    if (!ctx || ctx.state === "closed") return () => {};
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let raf = 0;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
      cb(peak / 128);
      raf = requestAnimationFrame(tick);
    };
    tick();
    const stop = () => { alive = false; cancelAnimationFrame(raf); try { src.disconnect(); } catch {} };
    metersRef.current.push(stop);
    return stop;
  };

  const playRemoteAudio = (audio: HTMLAudioElement) => {
    audio.play().catch(() => {
      window.setTimeout(() => {
        audio.play().catch(() => {});
      }, 600);
    });
  };

  const stopRemotePeer = (remoteUserId: string, removeQueuedIce = true) => {
    window.clearTimeout(reconnectTimersRef.current[remoteUserId]);
    delete reconnectTimersRef.current[remoteUserId];
    window.clearTimeout(dropTimersRef.current[remoteUserId]);
    delete dropTimersRef.current[remoteUserId];
    const pc = peersRef.current[remoteUserId];
    if (pc) {
      try { pc.ontrack = null; pc.onicecandidate = null; pc.onconnectionstatechange = null; pc.oniceconnectionstatechange = null; pc.close(); } catch {}
      delete peersRef.current[remoteUserId];
    }
    remoteMetersRef.current[remoteUserId]?.();
    delete remoteMetersRef.current[remoteUserId];
    delete peerConnectionIdsRef.current[remoteUserId];
    if (removeQueuedIce) delete pendingIceRef.current[remoteUserId];
    removeRemote(remoteUserId);
    document.getElementById(`vox-audio-${remoteUserId}`)?.remove();
  };

  const flushPendingIce = async (remoteUserId: string, pc: RTCPeerConnection) => {
    if (!pc.remoteDescription) return;
    const connectionId = peerConnectionIdsRef.current[remoteUserId];
    const pending = pendingIceRef.current[remoteUserId] ?? [];
    pendingIceRef.current[remoteUserId] = [];
    for (const item of pending) {
      if (item.connectionId && connectionId && item.connectionId !== connectionId) continue;
      try { await pc.addIceCandidate(new RTCIceCandidate(item.candidate)); } catch {}
    }
  };

  const addOrQueueIce = async (remoteUserId: string, candidate: RTCIceCandidateInit, connectionId?: string) => {
    const pc = peersRef.current[remoteUserId];
    const currentConnectionId = peerConnectionIdsRef.current[remoteUserId];
    if (connectionId && currentConnectionId && connectionId !== currentConnectionId) return;
    if (!pc || !pc.remoteDescription) {
      pendingIceRef.current[remoteUserId] = [...(pendingIceRef.current[remoteUserId] ?? []), { candidate, connectionId }];
      return;
    }
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
  };

  /** Ghost guard: if a peer never recovers, purge it from UI + DB. */
  const cancelHardDrop = (remoteUserId: string) => {
    window.clearTimeout(dropTimersRef.current[remoteUserId]);
    delete dropTimersRef.current[remoteUserId];
  };

  const scheduleHardDrop = (remoteUserId: string, delay = 10000) => {
    if (dropTimersRef.current[remoteUserId]) return;
    dropTimersRef.current[remoteUserId] = window.setTimeout(() => {
      delete dropTimersRef.current[remoteUserId];
      const pc = peersRef.current[remoteUserId];
      const s = pc?.iceConnectionState;
      if (s === "connected" || s === "completed") return;
      stopRemotePeer(remoteUserId);
      if (channelId) {
        void supabase.from("vox_voice_participants").delete()
          .eq("channel_id", channelId).eq("user_id", remoteUserId);
      }
    }, delay);
  };

  const requestPeerReconnect = (remoteUserId: string, delay = 1200) => {
    if (reconnectTimersRef.current[remoteUserId]) return;
    reconnectTimersRef.current[remoteUserId] = window.setTimeout(() => {
      delete reconnectTimersRef.current[remoteUserId];
      if (!connectedRef.current || !channelRef.current || !user) return;
      stopRemotePeer(remoteUserId);
      if (user.id < remoteUserId) {
        createPeer(remoteUserId, true);
      } else {
        channelRef.current.send({
          type: "broadcast",
          event: "renegotiate",
          payload: { from: user.id, to: remoteUserId },
        });
      }
    }, delay);
  };

  const createPeer = useCallback((remoteUserId: string, initiator: boolean, connectionId = crypto.randomUUID()) => {
    if (peersRef.current[remoteUserId]) return peersRef.current[remoteUserId];
    const pc = new RTCPeerConnection(ICE);
    peersRef.current[remoteUserId] = pc;
    peerConnectionIdsRef.current[remoteUserId] = connectionId;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));
    }
    // Publish camera / screen video tracks (if any) on the same stream id.
    extraTracksRef.current.forEach((t) => {
      try { pc.addTrack(t, localStreamRef.current ?? new MediaStream([t])); } catch { /* noop */ }
    });

    pc.ontrack = (ev) => {
      const stream = ev.streams[0] ?? new MediaStream([ev.track]);
      // Safety: never play back our own stream (would cause echo).
      if (remoteUserId === user?.id) return;
      // Druhá pojistka: kdyby přišel zpět náš vlastní lokální stream/track.
      const localStream = localStreamRef.current;
      const isLocalStream =
        !!localStream &&
        (stream.id === localStream.id || localStream.getTracks().some((t) => t.id === ev.track.id));
      if (isLocalStream) return;
      updateRemote(remoteUserId, { stream });
      let audio = document.getElementById(`vox-audio-${remoteUserId}`) as HTMLAudioElement | null;
      if (!audio) {
        audio = document.createElement("audio");
        audio.id = `vox-audio-${remoteUserId}`;
        audio.autoplay = true;
        (audio as any).playsInline = true;
        document.body.appendChild(audio);
      }
      if (audio.srcObject !== stream) audio.srcObject = stream;
      const userMuted = localAudio.isMuted(remoteUserId);
      audio.muted = deafenedRef.current || userMuted;
      audio.volume = Math.max(0, Math.min(1, localAudio.getVolume(remoteUserId)));
      playRemoteAudio(audio);


      ev.track.onunmute = () => playRemoteAudio(audio!);
      remoteMetersRef.current[remoteUserId]?.();
      remoteMetersRef.current[remoteUserId] = meterStream(stream, (l) => updateRemote(remoteUserId, { level: l }));
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice",
          payload: { from: user!.id, to: remoteUserId, candidate: ev.candidate.toJSON(), connectionId: peerConnectionIdsRef.current[remoteUserId] },
        });
      }
    };

    const watchConnection = () => {
      if (pc.connectionState === "connected") {
        window.clearTimeout(reconnectTimersRef.current[remoteUserId]);
        delete reconnectTimersRef.current[remoteUserId];
        return;
      }
      if (pc.connectionState === "failed") { requestPeerReconnect(remoteUserId, 500); scheduleHardDrop(remoteUserId); }
      if (pc.connectionState === "disconnected") { requestPeerReconnect(remoteUserId, 3500); scheduleHardDrop(remoteUserId); }
      if (pc.connectionState === "closed") stopRemotePeer(remoteUserId);
    };
    pc.onconnectionstatechange = watchConnection;
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") cancelHardDrop(remoteUserId);
      if (s === "failed") { requestPeerReconnect(remoteUserId, 500); scheduleHardDrop(remoteUserId); }
      if (s === "disconnected") { requestPeerReconnect(remoteUserId, 3500); scheduleHardDrop(remoteUserId); }
      if (s === "closed") stopRemotePeer(remoteUserId);
    };

    if (initiator) {
      (async () => {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        channelRef.current?.send({
          type: "broadcast",
          event: "offer",
          payload: { from: user!.id, to: remoteUserId, sdp: pc.localDescription?.toJSON() ?? offer, connectionId },
        });
      })();
    }

    return pc;
  }, [user]);

  const waitForSubscribed = (ch: NonNullable<typeof channelRef.current>) => new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Hlasová signalizace se nepřipojila včas")), 10000);
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        window.clearTimeout(timeout);
        resolve();
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        window.clearTimeout(timeout);
        reject(new Error(`Hlasová signalizace selhala: ${status}`));
      }
    });
  });

  const join = useCallback(async () => {
    if (!user || !channelId || connectedRef.current || joiningRef.current) return;
    joiningRef.current = true;
    const prefs = readVoicePrefs();
    try {
      // Autoplay policy: unlock/resume audio strictly from the user's Join click.
      await ensureCtx();
      const raw = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: prefs.inputDeviceId ? { exact: prefs.inputDeviceId } : undefined,
          // Force DSP on to prevent echo loop — remote audio picked up by mic must be cancelled.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      rawStreamRef.current = raw;

      // IMPORTANT: publish the raw mic track directly to peers.
      // Routing mic through WebAudio (MediaStreamDestination) breaks the
      // browser's echo canceller (AEC needs a direct mic->PC path).
      localStreamRef.current = raw;

      // For VAD/metering we need a track that is ALWAYS enabled — otherwise
      // when VAD closes the published track (enabled=false), the analyser
      // reads silence, RMS stays 0, and the gate never re-opens (deadlock).
      // Clone the mic track: clones share the underlying source but have an
      // independent `enabled` flag.
      const monitorTracks = raw.getAudioTracks().map((t) => t.clone());
      monitorTracks.forEach((t) => (t.enabled = true));
      const monitorStream = new MediaStream(monitorTracks);

      const ctx = audioContextRef.current ?? await ensureCtx();
      const src = ctx.createMediaStreamSource(monitorStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let raf = 0;
      let alive = true;

      const auto = prefs.autoDetect ?? true;
      const thresholdLin = Math.pow(10, (prefs.vadThresholdDb ?? -50) / 20);
      let openUntil = 0;

      // Start with published track ENABLED so first speech isn't clipped.
      raw.getAudioTracks().forEach((t) => (t.enabled = true));

      const tick = () => {
        if (!alive) return;
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        setSelfLevel(rms);

        if (auto && !mutedRef.current) {
          const now = performance.now();
          if (rms > thresholdLin) openUntil = now + 400;
          const shouldOpen = now < openUntil;
          raw.getAudioTracks().forEach((t) => {
            if (t.enabled !== shouldOpen) t.enabled = shouldOpen;
          });
        } else if (!auto && !mutedRef.current) {
          // Always-on when VAD is off
          raw.getAudioTracks().forEach((t) => { if (!t.enabled) t.enabled = true; });
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
      metersRef.current.push(() => {
        alive = false;
        cancelAnimationFrame(raf);
        try { src.disconnect(); } catch {}
        monitorTracks.forEach((t) => { try { t.stop(); } catch {} });
      });
    } catch (e) {
      console.error("Mikrofon nedostupný", e);
      joiningRef.current = false;
      return;
    }

    const ch = supabase.channel(`vox_voice_${channelId}`, { config: { broadcast: { self: false } } });
    channelRef.current = ch;

    ch.on("broadcast", { event: "join" }, ({ payload }) => {
      if (payload.from === user.id) return;
      if (user.id < payload.from) createPeer(payload.from, true);
    });
    ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
      if (payload.to !== user.id) return;
      if (payload.connectionId && peerConnectionIdsRef.current[payload.from] && peerConnectionIdsRef.current[payload.from] !== payload.connectionId) {
        stopRemotePeer(payload.from, false);
      }
      const pc = createPeer(payload.from, false, payload.connectionId);
      if (pc.signalingState !== "stable") {
        try { await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit); } catch {}
      }
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      await flushPendingIce(payload.from, pc);
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      ch.send({ type: "broadcast", event: "answer", payload: { from: user.id, to: payload.from, sdp: pc.localDescription?.toJSON() ?? ans, connectionId: peerConnectionIdsRef.current[payload.from] } });
    });
    ch.on("broadcast", { event: "answer" }, async ({ payload }) => {
      if (payload.to !== user.id) return;
      const pc = peersRef.current[payload.from];
      if (!pc) return;
      if (payload.connectionId && peerConnectionIdsRef.current[payload.from] !== payload.connectionId) return;
      if (pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushPendingIce(payload.from, pc);
      }
    });
    ch.on("broadcast", { event: "ice" }, async ({ payload }) => {
      if (payload.to !== user.id) return;
      await addOrQueueIce(payload.from, payload.candidate, payload.connectionId);
    });
    ch.on("broadcast", { event: "renegotiate" }, ({ payload }) => {
      if (payload.to !== user.id || user.id > payload.from) return;
      stopRemotePeer(payload.from);
      createPeer(payload.from, true);
    });
    ch.on("broadcast", { event: "leave" }, ({ payload }) => {
      stopRemotePeer(payload.from);
    });

    // Realtime presence = source of truth for who is actually in the room.
    // A dropped socket fires `leave` within seconds, so ghosts get purged.
    ch.on("presence", { event: "leave" }, ({ leftPresences }: any) => {
      (leftPresences ?? []).forEach((p: any) => {
        const uid = p?.user_id as string | undefined;
        if (!uid || uid === user.id) return;
        stopRemotePeer(uid);
        void supabase.from("vox_voice_participants").delete()
          .eq("channel_id", channelId).eq("user_id", uid);
      });
    });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ user_id?: string }>();
      const present = new Set<string>();
      Object.values(state).flat().forEach((p: any) => p?.user_id && present.add(p.user_id));
      setPresentIds(present);
      Object.keys(peersRef.current).forEach((uid) => {
        if (!present.has(uid)) stopRemotePeer(uid);
      });
    });

    try {
      await waitForSubscribed(ch);
      await ch.track({ user_id: user.id, session_id: sessionIdRef.current });
      await supabase.from("vox_voice_participants").upsert({
        channel_id: channelId,
        user_id: user.id,
        session_id: sessionIdRef.current,
        is_muted: false,
        is_deafened: false,
      });
      const { data: existing } = await supabase
        .from("vox_voice_participants")
        .select("user_id")
        .eq("channel_id", channelId)
        .neq("user_id", user.id);
      (existing ?? []).forEach((row: { user_id: string }) => {
        if (user.id < row.user_id) createPeer(row.user_id, true);
      });
      await ch.send({ type: "broadcast", event: "join", payload: { from: user.id } });
    
    } catch (e) {
      console.error("Hlasová signalizace selhala", e);
      await leaveCleanupOnly();
      joiningRef.current = false;
      return;
    }
    connectedRef.current = true;
    setConnected(true);
    joiningRef.current = false;
  }, [user, channelId, createPeer]);

  const leaveCleanupOnly = async () => {
    Object.keys(peersRef.current).forEach((remoteUserId) => stopRemotePeer(remoteUserId));
    Object.values(reconnectTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    reconnectTimersRef.current = {};
    Object.values(dropTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    dropTimersRef.current = {};
    pendingIceRef.current = {};
    peerConnectionIdsRef.current = {};
    document.querySelectorAll("[id^='vox-audio-']").forEach((el) => el.remove());
    metersRef.current.forEach((stop) => { try { stop(); } catch {} });
    metersRef.current = [];
    Object.values(remoteMetersRef.current).forEach((stop) => { try { stop(); } catch {} });
    remoteMetersRef.current = {};
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    if (localStreamRef.current !== rawStreamRef.current) localStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    screenStreamRef.current = null;
    extraTracksRef.current = [];
    setLocalVideoStream(null);
    setVideoOn(false);
    setScreenOn(false);
    rawStreamRef.current = null;
    localStreamRef.current = null;
    gainNodeRef.current = null;
    vadGainRef.current = null;
    if (audioContextRef.current) { try { await audioContextRef.current.close(); } catch {} audioContextRef.current = null; }
    if (channelRef.current) await supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setRemotes({});
    setSelfLevel(0);
    setPresentIds(new Set());
  };

  const leave = useCallback(async () => {
    if (!user || !channelId) return;
    connectedRef.current = false;
    joiningRef.current = false;
    channelRef.current?.send({ type: "broadcast", event: "leave", payload: { from: user.id } });
    try { await channelRef.current?.untrack(); } catch { /* noop */ }
    await leaveCleanupOnly();
    setConnected(false);
    await supabase.from("vox_voice_participants").delete().eq("channel_id", channelId).eq("user_id", user.id);
  }, [user, channelId]);

  // Tab close / reload: fire a synchronous keepalive DELETE so the row never
  // outlives the socket, plus a best-effort broadcast leave for instant UI removal.
  useEffect(() => {
    if (!user || !channelId) return;
    const handleDisconnect = () => {
      if (!connectedRef.current) return;
      try {
        channelRef.current?.send({ type: "broadcast", event: "leave", payload: { from: user.id } });
        void channelRef.current?.untrack();
      } catch { /* noop */ }
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const token = accessTokenRef.current;
      if (!url || !key || !token) return;
      try {
        fetch(
          `${url}/rest/v1/vox_voice_participants?channel_id=eq.${channelId}&user_id=eq.${user.id}`,
          {
            method: "DELETE",
            keepalive: true,
            headers: { apikey: key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          },
        ).catch(() => {});
      } catch { /* noop */ }
    };
    window.addEventListener("beforeunload", handleDisconnect);
    window.addEventListener("pagehide", handleDisconnect);
    return () => {
      window.removeEventListener("beforeunload", handleDisconnect);
      window.removeEventListener("pagehide", handleDisconnect);
    };
  }, [user, channelId]);



  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const nm = !m;
      mutedRef.current = nm;
      rawStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !nm));
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
      deafenedRef.current = nd;
      document.querySelectorAll<HTMLAudioElement>("[id^='vox-audio-']").forEach((a) => {
        const uid = a.id.replace("vox-audio-", "");
        a.muted = nd || localAudio.isMuted(uid);
      });
      if (nd && !muted) toggleMute();
      if (user && channelId) {
        supabase.from("vox_voice_participants")
          .update({ is_deafened: nd })
          .eq("channel_id", channelId).eq("user_id", user.id).then(() => {});
      }
      return nd;
    });
  }, [muted, toggleMute, user, channelId]);

  /** Force a fresh offer/answer round on every peer so new tracks get published. */
  const renegotiateAll = useCallback(() => {
    if (!user) return;
    Object.keys(peersRef.current).forEach((rid) => {
      if (user.id < rid) {
        stopRemotePeer(rid, false);
        createPeer(rid, true);
      } else {
        channelRef.current?.send({ type: "broadcast", event: "renegotiate", payload: { from: user.id, to: rid } });
      }
    });
  }, [user, createPeer]);

  const syncLocalVideo = () => {
    const tracks = extraTracksRef.current;
    setLocalVideoStream(tracks.length ? new MediaStream(tracks) : null);
  };

  const addVideoTracks = (tracks: MediaStreamTrack[]) => {
    extraTracksRef.current = [...extraTracksRef.current, ...tracks];
    syncLocalVideo();
    renegotiateAll();
  };

  const removeVideoTracks = (tracks: MediaStreamTrack[]) => {
    const ids = new Set(tracks.map((t) => t.id));
    extraTracksRef.current = extraTracksRef.current.filter((t) => !ids.has(t.id));
    tracks.forEach((t) => { try { t.stop(); } catch { /* noop */ } });
    syncLocalVideo();
    renegotiateAll();
  };

  const stopVideo = useCallback(() => {
    const s = camStreamRef.current;
    camStreamRef.current = null;
    setVideoOn(false);
    if (s) removeVideoTracks(s.getVideoTracks());
  }, [renegotiateAll]);

  const startVideo = useCallback(async (quality?: QualityKey) => {
    if (camStreamRef.current || !connectedRef.current) return;
    const prefs = readVideoPrefs();
    const p = presetOf(quality ?? prefs.camQuality);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: p.width, max: p.width },
          height: { ideal: p.height, max: p.height },
          frameRate: { ideal: prefs.camFps, max: prefs.camFps },
        },
        audio: false,
      });
      camStreamRef.current = s;
      s.getVideoTracks().forEach((t) => { t.onended = () => stopVideo(); });
      setVideoOn(true);
      addVideoTracks(s.getVideoTracks());
    } catch (e) {
      const err = e as Error;
      console.error("Kamera nedostupná", err);
      toast({
        title: "Kamera nedostupná",
        description: err?.message || "Zařízení se nepodařilo otevřít.",
        variant: "destructive",
      });
    }
  }, [renegotiateAll, stopVideo]);

  const toggleVideo = useCallback(() => {
    if (camStreamRef.current) stopVideo(); else void startVideo();
  }, [startVideo, stopVideo]);

  const stopScreen = useCallback(() => {
    const s = screenStreamRef.current;
    screenStreamRef.current = null;
    setScreenOn(false);
    if (s) removeVideoTracks(s.getTracks());
  }, [renegotiateAll]);

  /**
   * Screen share. In Electron we capture a concrete source (whole desktop or a
   * single window / game) picked in the in-app HUD picker; on the web we fall
   * back to the browser's own getDisplayMedia chooser.
   */
  const startScreen = useCallback(async (sourceId?: string, quality?: QualityKey) => {
    if (screenStreamRef.current || !connectedRef.current) return null;

    // 1. Secure context (HTTPS / localhost) is mandatory for capture APIs.
    if (!window.isSecureContext) {
      console.error("Screen sharing blocked: Not a secure context (HTTPS required).");
      toast({
        title: "Sdílení obrazovky selhalo",
        description: "Sdílení obrazovky vyžaduje zabezpečené připojení (HTTPS nebo localhost).",
        variant: "destructive",
      });
      return null;
    }

    // 2. Browser / device support.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      console.error("Screen sharing blocked: getDisplayMedia is not supported.");
      toast({
        title: "Sdílení obrazovky selhalo",
        description: "Váš prohlížeč nepodporuje sdílení obrazovky (nepodporováno na mobilních zařízeních).",
        variant: "destructive",
      });
      return null;
    }

    const prefs = readVideoPrefs();
    const p = presetOf(quality ?? prefs.screenQuality);
    const fps = prefs.screenFps;
    const legacyDesktop = async (id: string) =>
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: id,
            maxWidth: p.width,
            maxHeight: p.height,
            maxFrameRate: fps,
          },
        },
      } as unknown as MediaStreamConstraints);

    try {
      let s: MediaStream | null = null;
      const video = {
        cursor: "always",
        width: { ideal: p.width, max: p.width },
        height: { ideal: p.height, max: p.height },
        frameRate: { ideal: fps, max: fps },
      } as MediaTrackConstraints;

      // 3. Request the screen stream (Electron: resolve the picked source first).
      if (sourceId && isDesktopCapture()) {
        await selectCaptureSource(sourceId);
        try {
          s = await navigator.mediaDevices.getDisplayMedia({ video, audio: false });
        } catch (inner) {
          const n = (inner as Error)?.name;
          if (n === "NotAllowedError" || n === "AbortError") throw inner;
          s = await legacyDesktop(sourceId);
        }
      } else {
        s = await navigator.mediaDevices.getDisplayMedia({ video, audio: false });
      }

      console.log("Screen share started successfully.");
      screenStreamRef.current = s;

      // 4. Native "Stop sharing" button.
      s.getVideoTracks().forEach((t) => {
        t.onended = () => {
          console.log("Screen sharing stopped by user via browser UI.");
          stopScreen();
        };
      });

      setScreenOn(true);
      addVideoTracks(s.getVideoTracks());
      return s;
    } catch (e) {
      // 5. Granular error handling.
      const err = e as Error;
      if (err?.name === "NotAllowedError" || err?.name === "AbortError") {
        console.warn("User denied / cancelled screen sharing permission.");
      } else if (err?.name === "NotFoundError") {
        console.error("No screen track found to share.");
        toast({
          title: "Sdílení obrazovky selhalo",
          description: "Nebyla nalezena žádná obrazovka ke sdílení.",
          variant: "destructive",
        });
      } else {
        console.error("Unknown screen share error:", err);
        toast({
          title: "Sdílení obrazovky selhalo",
          description: err?.message || "Neznámý problém",
          variant: "destructive",
        });
      }
      return null;
    }
  }, [renegotiateAll, stopScreen]);


  const toggleScreen = useCallback(() => {
    if (screenStreamRef.current) stopScreen(); else void startScreen();
  }, [startScreen, stopScreen]);

  /** Live-switch camera resolution without dropping the call. */
  const applyCamQuality = useCallback(async (key: QualityKey) => {
    writeVideoPrefs({ camQuality: key });
    const track = camStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const p = presetOf(key);
    const prefs = readVideoPrefs();
    try {
      await track.applyConstraints({
        width: { ideal: p.width, max: p.width },
        height: { ideal: p.height, max: p.height },
        frameRate: { ideal: prefs.camFps, max: prefs.camFps },
      });
    } catch {
      stopVideo();
      void startVideo(key);
    }
  }, [startVideo, stopVideo]);



  // Re-apply per-user local audio prefs (volume/mute) when they change.
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll<HTMLAudioElement>("[id^='vox-audio-']").forEach((a) => {
        const uid = a.id.replace("vox-audio-", "");
        a.muted = deafenedRef.current || localAudio.isMuted(uid);
        a.volume = Math.max(0, Math.min(1, localAudio.getVolume(uid)));
      });
    };
    apply();
    return localAudio.subscribe(apply);
  }, [remotes]);

  // Unmount-only cleanup. Must NOT depend on `leave` — its identity changes on
  // every channel/state change, which previously tore down the live call while
  // the user was simply navigating between channels.
  const leaveRef = useRef(leave);
  leaveRef.current = leave;
  useEffect(() => () => { void leaveRef.current(); }, []);


  return {
    connected, muted, deafened, remotes, selfLevel, presentIds, join, leave, toggleMute, toggleDeafen,
    videoOn, screenOn, localVideoStream, toggleVideo, toggleScreen,
    startVideo, stopVideo, startScreen, stopScreen, applyCamQuality,
  };

}
