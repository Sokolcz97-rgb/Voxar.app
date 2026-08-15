import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type Participant,
  type RemoteParticipant,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  isDesktopCapture,
  presetOf,
  readVideoPrefs,
  selectCaptureSource,
  writeVideoPrefs,
  type QualityKey,
} from "@/lib/videoQuality";

interface RemotePeer {
  userId: string;
  stream: MediaStream | null;
  level: number;
}

interface LiveKitTokenResponse {
  url: string;
  token: string;
  room: string;
}

const TOKEN_TIMEOUT_MS = 12_000;
const CONNECT_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer = 0;
  return Promise.race([
    promise.finally(() => window.clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

function readVoicePrefs() {
  try {
    return JSON.parse(localStorage.getItem("sv.voicePrefs") || "{}") as {
      inputDeviceId?: string;
      outputDeviceId?: string;
      noiseSuppression?: boolean;
      echoCancellation?: boolean;
      autoGainControl?: boolean;
    };
  } catch {
    return {};
  }
}

function participantVideoStream(participant: Participant): MediaStream | null {
  const publications = [
    participant.getTrackPublication(Track.Source.ScreenShare),
    participant.getTrackPublication(Track.Source.Camera),
  ];
  const mediaTrack = publications.find((publication) => publication?.track?.mediaStreamTrack)?.track?.mediaStreamTrack;
  return mediaTrack ? new MediaStream([mediaTrack]) : null;
}

function messageOf(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Zkontrolujte připojení k síti a zkuste to znovu.";
}

/** LiveKit-backed, route-independent voice session adapter. */
export function useVoxVoice(channelId: string | null) {
  const { user } = useAuth();
  const roomRef = useRef<Room>();
  if (!roomRef.current) {
    roomRef.current = new Room({
      adaptiveStream: true,
      dynacast: true,
      disconnectOnPageLeave: true,
      videoCaptureDefaults: { resolution: VideoPresets.h1080.resolution },
      publishDefaults: { simulcast: true, dtx: true, red: true },
    });
  }
  const room = roomRef.current;
  const joiningRef = useRef(false);
  const joinedChannelRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null);
  const [remotes, setRemotes] = useState<Record<string, RemotePeer>>({});
  const [selfLevel, setSelfLevel] = useState(0);
  const [presentIds, setPresentIds] = useState<Set<string>>(new Set());

  const syncRoomState = useCallback(() => {
    const nextRemotes: Record<string, RemotePeer> = {};
    const ids = new Set<string>();
    if (room.state === ConnectionState.Connected && room.localParticipant.identity) {
      ids.add(room.localParticipant.identity);
    }
    room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      ids.add(participant.identity);
      nextRemotes[participant.identity] = {
        userId: participant.identity,
        stream: participantVideoStream(participant),
        level: participant.audioLevel,
      };
    });
    setPresentIds(ids);
    setRemotes(nextRemotes);
    setSelfLevel(room.localParticipant.audioLevel);
    const localVideo = participantVideoStream(room.localParticipant);
    setLocalVideoStream(localVideo);
    setVideoOn(Boolean(room.localParticipant.getTrackPublication(Track.Source.Camera) && !room.localParticipant.getTrackPublication(Track.Source.Camera)?.isMuted));
    setScreenOn(Boolean(room.localParticipant.getTrackPublication(Track.Source.ScreenShare) && !room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.isMuted));
  }, [room]);

  const deleteParticipantRow = useCallback(async () => {
    const joinedChannel = joinedChannelRef.current;
    if (!joinedChannel || !user) return;
    await supabase.from("vox_voice_participants").delete()
      .eq("channel_id", joinedChannel)
      .eq("user_id", user.id);
  }, [user]);

  useEffect(() => {
    const handleConnectionState = (state: ConnectionState) => {
      setConnecting(state === ConnectionState.Connecting || state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting);
      setConnected(state === ConnectionState.Connected);
      if (state === ConnectionState.Disconnected) {
        setPresentIds(new Set());
        setRemotes({});
      }
      syncRoomState();
    };
    const handleDisconnected = () => {
      joiningRef.current = false;
      setConnecting(false);
      setConnected(false);
      setMuted(false);
      setDeafened(false);
      setVideoOn(false);
      setScreenOn(false);
      setLocalVideoStream(null);
      void deleteParticipantRow();
      joinedChannelRef.current = null;
    };
    const handleMedia = () => syncRoomState();

    room
      .on(RoomEvent.ConnectionStateChanged, handleConnectionState)
      .on(RoomEvent.Disconnected, handleDisconnected)
      .on(RoomEvent.ParticipantConnected, handleMedia)
      .on(RoomEvent.ParticipantDisconnected, handleMedia)
      .on(RoomEvent.TrackSubscribed, handleMedia)
      .on(RoomEvent.TrackUnsubscribed, handleMedia)
      .on(RoomEvent.TrackMuted, handleMedia)
      .on(RoomEvent.TrackUnmuted, handleMedia)
      .on(RoomEvent.LocalTrackPublished, handleMedia)
      .on(RoomEvent.LocalTrackUnpublished, handleMedia)
      .on(RoomEvent.ActiveSpeakersChanged, handleMedia);

    return () => {
      room
        .off(RoomEvent.ConnectionStateChanged, handleConnectionState)
        .off(RoomEvent.Disconnected, handleDisconnected)
        .off(RoomEvent.ParticipantConnected, handleMedia)
        .off(RoomEvent.ParticipantDisconnected, handleMedia)
        .off(RoomEvent.TrackSubscribed, handleMedia)
        .off(RoomEvent.TrackUnsubscribed, handleMedia)
        .off(RoomEvent.TrackMuted, handleMedia)
        .off(RoomEvent.TrackUnmuted, handleMedia)
        .off(RoomEvent.LocalTrackPublished, handleMedia)
        .off(RoomEvent.LocalTrackUnpublished, handleMedia)
        .off(RoomEvent.ActiveSpeakersChanged, handleMedia);
    };
  }, [deleteParticipantRow, room, syncRoomState]);

  const leave = useCallback(async () => {
    joiningRef.current = false;
    setConnecting(false);
    const rowDelete = deleteParticipantRow();
    await room.disconnect(true);
    await rowDelete;
    joinedChannelRef.current = null;
    setConnected(false);
  }, [deleteParticipantRow, room]);

  const join = useCallback(async () => {
    if (!user || !channelId) throw new Error("Pro připojení je nutné přihlášení.");
    if (room.state === ConnectionState.Connected && joinedChannelRef.current === channelId) return;
    if (joiningRef.current) return;

    joiningRef.current = true;
    setConnecting(true);
    try {
      if (room.state !== ConnectionState.Disconnected) await room.disconnect(true);
      const tokenRequest = supabase.functions.invoke<LiveKitTokenResponse>("livekit-token", {
        body: { channel_id: channelId },
      });
      const { data, error } = await withTimeout(tokenRequest, TOKEN_TIMEOUT_MS, "Vydání přístupového tokenu vypršelo.");
      if (error) throw new Error(error.message || "Token pro hlasové spojení se nepodařilo vytvořit.");
      if (!data?.url || !data.token) throw new Error("Hlasová služba vrátila neplatné připojení.");

      await withTimeout(
        room.connect(data.url, data.token, { autoSubscribe: true }),
        CONNECT_TIMEOUT_MS,
        "Připojení k hlasové infrastruktuře vypršelo.",
      );
      await room.startAudio();

      const prefs = readVoicePrefs();
      if (prefs.outputDeviceId) await room.switchActiveDevice("audiooutput", prefs.outputDeviceId).catch(() => false);
      await room.localParticipant.setMicrophoneEnabled(true, {
        deviceId: prefs.inputDeviceId,
        echoCancellation: prefs.echoCancellation ?? true,
        noiseSuppression: prefs.noiseSuppression ?? true,
        autoGainControl: prefs.autoGainControl ?? true,
      });

      joinedChannelRef.current = channelId;
      const sessionId = crypto.randomUUID();
      const { error: rowError } = await supabase.from("vox_voice_participants").upsert({
        channel_id: channelId,
        user_id: user.id,
        session_id: sessionId,
        is_muted: false,
        is_deafened: false,
        last_seen: new Date().toISOString(),
      } as never);
      if (rowError) console.warn("Voice participant metadata sync failed", rowError.message);

      setMuted(false);
      setDeafened(false);
      setConnected(true);
      syncRoomState();
    } catch (error) {
      await room.disconnect(true).catch(() => undefined);
      joinedChannelRef.current = null;
      toast({
        title: "Připojení k hlasovému kanálu selhalo",
        description: messageOf(error),
        variant: "destructive",
      });
      throw error;
    } finally {
      joiningRef.current = false;
      setConnecting(false);
    }
  }, [channelId, room, syncRoomState, user]);

  useEffect(() => {
    if (!connected || !channelId) return;
    const beat = () => {
      void (supabase.rpc as any)("vox_voice_heartbeat", { _channel: channelId });
      void (supabase.rpc as any)("vox_voice_purge_stale", { _channel: channelId });
    };
    beat();
    const timer = window.setInterval(beat, 15_000);
    return () => window.clearInterval(timer);
  }, [channelId, connected]);

  const toggleMute = useCallback(async () => {
    const next = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
      if (user && joinedChannelRef.current) {
        await supabase.from("vox_voice_participants").update({ is_muted: next })
          .eq("channel_id", joinedChannelRef.current).eq("user_id", user.id);
      }
    } catch (error) {
      toast({ title: "Mikrofon nelze přepnout", description: messageOf(error), variant: "destructive" });
    }
  }, [muted, room, user]);

  const toggleDeafen = useCallback(async () => {
    const next = !deafened;
    setDeafened(next);
    if (next && !muted) await toggleMute();
    if (user && joinedChannelRef.current) {
      await supabase.from("vox_voice_participants").update({ is_deafened: next })
        .eq("channel_id", joinedChannelRef.current).eq("user_id", user.id);
    }
  }, [deafened, muted, toggleMute, user]);

  const stopVideo = useCallback(async () => {
    await room.localParticipant.setCameraEnabled(false);
    syncRoomState();
  }, [room, syncRoomState]);

  const startVideo = useCallback(async (quality?: QualityKey) => {
    const prefs = readVideoPrefs();
    const preset = presetOf(quality ?? prefs.camQuality);
    try {
      await room.localParticipant.setCameraEnabled(true, {
        resolution: { width: preset.width, height: preset.height, frameRate: prefs.camFps },
      });
      syncRoomState();
    } catch (error) {
      toast({ title: "Kamera nedostupná", description: messageOf(error), variant: "destructive" });
    }
  }, [room, syncRoomState]);

  const toggleVideo = useCallback(() => {
    void (videoOn ? stopVideo() : startVideo());
  }, [startVideo, stopVideo, videoOn]);

  const stopScreen = useCallback(async () => {
    await room.localParticipant.setScreenShareEnabled(false);
    syncRoomState();
  }, [room, syncRoomState]);

  const startScreen = useCallback(async (sourceId?: string, quality?: QualityKey) => {
    if (!window.isSecureContext) {
      toast({ title: "Sdílení obrazovky selhalo", description: "Sdílení vyžaduje HTTPS nebo localhost.", variant: "destructive" });
      return null;
    }
    const prefs = readVideoPrefs();
    const preset = presetOf(quality ?? prefs.screenQuality);
    try {
      if (sourceId && isDesktopCapture()) await selectCaptureSource(sourceId);
      const publication = await room.localParticipant.setScreenShareEnabled(true, {
        audio: false,
        video: true,
        resolution: { width: preset.width, height: preset.height, frameRate: prefs.screenFps },
        contentHint: "detail",
      });
      syncRoomState();
      const mediaTrack = publication?.track?.mediaStreamTrack;
      return mediaTrack ? new MediaStream([mediaTrack]) : null;
    } catch (error) {
      if ((error as Error)?.name !== "NotAllowedError" && (error as Error)?.name !== "AbortError") {
        toast({ title: "Sdílení obrazovky selhalo", description: messageOf(error), variant: "destructive" });
      }
      return null;
    }
  }, [room, syncRoomState]);

  const toggleScreen = useCallback(() => {
    void (screenOn ? stopScreen() : startScreen());
  }, [screenOn, startScreen, stopScreen]);

  const applyCamQuality = useCallback(async (quality: QualityKey) => {
    writeVideoPrefs({ camQuality: quality });
    const publication = room.localParticipant.getTrackPublication(Track.Source.Camera);
    const track = publication?.track;
    if (!(track instanceof LocalVideoTrack)) return;
    const preset = presetOf(quality);
    const prefs = readVideoPrefs();
    try {
      await track.restartTrack({ resolution: { width: preset.width, height: preset.height, frameRate: prefs.camFps } });
    } catch {
      await stopVideo();
      await startVideo(quality);
    }
    syncRoomState();
  }, [room, startVideo, stopVideo, syncRoomState]);

  useEffect(() => () => {
    void room.disconnect(true);
  }, [room]);

  return {
    room,
    connected,
    connecting,
    muted,
    deafened,
    remotes,
    selfLevel,
    presentIds,
    join,
    leave,
    toggleMute,
    toggleDeafen,
    videoOn,
    screenOn,
    localVideoStream,
    toggleVideo,
    toggleScreen,
    startVideo,
    stopVideo,
    startScreen,
    stopScreen,
    applyCamQuality,
  };
}