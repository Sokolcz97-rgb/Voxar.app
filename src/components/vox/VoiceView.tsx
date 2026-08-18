import { useCosmeticRings } from "@/hooks/useCosmeticRing";
import { useEffect, useRef, useState } from "react";
import { Volume2, MicOff, PhoneOff, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { VoxChannel } from "./ChannelSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useVoiceCall } from "@/contexts/VoiceCallContext";
import { CallDock } from "./CallDock";
import { toast } from "@/hooks/use-toast";

interface Participant {
  user_id: string;
  is_muted: boolean;
  is_deafened: boolean;
  display_name?: string | null;
  avatar_url?: string | null;
}

/** Grid column count based on participant tiles (1x1, 2x2, 3x3 …). */
function gridCols(n: number) {
  if (n <= 1) return "grid-cols-1";
  if (n <= 4) return "grid-cols-1 sm:grid-cols-2";
  if (n <= 9) return "grid-cols-2 lg:grid-cols-3";
  return "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

function VideoTile({ stream, label, mirrored }: { stream: MediaStream; label: string; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative aspect-video bg-[hsl(222_40%_5%)] border border-primary/30 overflow-hidden [clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)]">
      {/* Local element is always muted — prevents microphone echo. */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={cn("w-full h-full object-cover", mirrored && "scale-x-[-1]")}
      />
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-[hsl(222_42%_5%/0.8)] flex items-center gap-1.5">
        <span className="w-1 h-1 bg-emerald-400" />
        <span className="text-[9px] font-display tracking-[0.24em] uppercase text-primary/90 truncate">{label}</span>
      </div>
    </div>
  );
}

export function VoiceView({ channel }: { channel: VoxChannel }) {
  const { user } = useAuth();
  const { channel: activeChannel, api, joinChannel, leaveChannel } = useVoiceCall();
  const [rows, setRows] = useState<Participant[]>([]);
  const joinedHere = api.connected && activeChannel?.id === channel.id;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      await (supabase.rpc as any)("vox_voice_purge_stale", { _channel: channel.id });
      const { data } = await supabase
        .from("vox_voice_participants")
        .select("user_id, is_muted, is_deafened")
        .eq("channel_id", channel.id);
      if (!data || !mounted) return;
      const ids = data.map((d: any) => d.user_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
      setRows(data.map((d: any) => ({ ...d, ...profMap[d.user_id] })));
    };
    load();
    const purge = window.setInterval(load, 30000);
    const ch = supabase.channel(`vox_vp_${channel.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_voice_participants", filter: `channel_id=eq.${channel.id}` }, load)
      .subscribe();
    return () => { mounted = false; window.clearInterval(purge); supabase.removeChannel(ch); };
  }, [channel.id]);

  // Inside the active room, LiveKit is authoritative. Outside it, the short-lived
  // metadata rows provide sidebar/view previews and are purged by heartbeat.
  const participants = joinedHere
    ? rows.filter((participant) => api.presentIds.has(participant.user_id))
    : rows;
  const cosmeticRings = useCosmeticRings(participants.map((participant) => participant.user_id));


  const handleJoin = async () => {
    try {
      await joinChannel(channel);
    } catch (e) {
      toast({
        title: "Připojení selhalo",
        description: (e as Error)?.message || "Nepodařilo se navázat hlasové spojení.",
        variant: "destructive",
      });
    }
  };

  const nameOf = (uid: string) => {
    const p = participants.find((x) => x.user_id === uid);
    return p?.display_name || uid.slice(0, 8);
  };


  const remoteVideos = joinedHere
    ? Object.values(api.remotes)
        .filter((r: any) => r.stream && r.stream.getVideoTracks().length > 0)
        .map((r: any) => ({ id: r.userId as string, stream: r.stream as MediaStream }))
    : [];
  const videoTiles = [
    ...(joinedHere && api.localVideoStream
      ? [{ id: "self", stream: api.localVideoStream, label: "TY", mirrored: api.videoOn && !api.screenOn }]
      : []),
    ...remoteVideos.map((r) => ({ id: r.id, stream: r.stream, label: nameOf(r.id), mirrored: false })),
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="h-12 px-4 flex items-center gap-2.5 border-b border-primary/20 bg-primary/5">
        <Volume2 className="w-4 h-4 text-primary text-glow" />
        <span className="font-display tracking-widest uppercase text-sm text-primary text-glow">{channel.name}</span>
        <span className="ml-auto text-[10px] font-display tracking-widest uppercase text-muted-foreground">
          VOICE LINK // {participants.length} ENTIT
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {videoTiles.length > 0 && (
          <div className={cn("grid gap-3 mb-6", gridCols(videoTiles.length))}>
            {videoTiles.map((t) => (
              <VideoTile key={t.id} stream={t.stream} label={t.label} mirrored={t.mirrored} />
            ))}
          </div>
        )}

        {participants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <div className="hex-frame w-24 h-24 flex items-center justify-center bg-primary/10">
              <Volume2 className="w-10 h-10 text-primary text-glow" />
            </div>
            <div>
              <h3 className="font-display tracking-widest uppercase text-sm text-primary text-glow">Kanál je prázdný</h3>
              <p className="text-xs text-muted-foreground mt-1 tracking-wide">
                Buď první entita v <b className="text-foreground">{channel.name}</b>.
              </p>
            </div>
          </div>
        ) : (
          <div className={cn("grid gap-4 max-w-5xl mx-auto", gridCols(participants.length))}>
            {participants.map((p) => {
              const isMe = p.user_id === user?.id;
              const level = isMe ? api.selfLevel : (api.remotes[p.user_id]?.level ?? 0);
              const speaking = joinedHere && level > 0.08 && !p.is_muted;
              const name = p.display_name || p.user_id.slice(0, 8);
              const pct = Math.min(100, Math.round(level * 180));
              return (
                <div key={p.user_id} className={cn(
                  "holo-pod aspect-square p-4 flex flex-col items-center justify-center gap-3 transition-all",
                  speaking && "shadow-[0_0_28px_hsl(160_84%_50%/0.5)]"
                )}>
                  <div
                    className={cn("rank-ring w-20 h-20", speaking && "speaking-ring", cosmeticRings[p.user_id] || "")}
                    style={{ ["--rank-color" as any]: speaking ? "hsl(160 84% 50%)" : "hsl(var(--primary))" }}
                  >
                    <div className="rank-inner overflow-hidden flex items-center justify-center text-lg font-display font-bold">
                      {p.avatar_url
                        ? <img loading="lazy" decoding="async" src={p.avatar_url} alt={name} className="w-full h-full object-cover" />
                        : name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="font-display tracking-wider text-xs truncate max-w-full text-foreground">
                    {name}{isMe && <span className="text-primary"> // TY</span>}
                  </div>
                  <div className="w-full h-1 rounded-full bg-background/60 overflow-hidden border border-primary/20">
                    <div
                      className={cn("h-full transition-[width] duration-75", p.is_muted ? "bg-destructive/70" : "bg-emerald-400")}
                      style={{ width: `${p.is_muted ? 0 : pct}%` }}
                    />
                  </div>
                  {p.is_muted && (
                    <div className="flex items-center gap-1 text-[10px] font-display tracking-widest uppercase text-destructive">
                      <MicOff className="w-3 h-3" /> MUTED
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-primary/15">
        {joinedHere ? (
          <CallDock />
        ) : (
          <div className="p-4 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={api.connecting}
              onClick={handleJoin}
              className={cn(
                "group relative px-8 py-3 rounded-none bg-[hsl(222_45%_5%/0.85)] border border-primary/50",
                "font-display tracking-[0.28em] uppercase text-xs text-primary",
                "[clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)]",
                "transition-all duration-150 flex items-center gap-2.5",
                "hover:border-primary hover:bg-primary/10 hover:shadow-[0_0_22px_hsl(var(--primary)/0.5)] hover:text-glow",
                "disabled:opacity-60 disabled:cursor-wait",
              )}
            >
              <Phone className={cn("w-4 h-4", api.connecting && "animate-pulse")} />
              {api.connecting ? "// NAVAZUJI SPOJENÍ…" : "// PŘIPOJIT LINK"}
            </button>
            {api.connected && (
              <Button
                onClick={() => void leaveChannel()}
                size="lg"
                className="gap-2 bg-destructive/15 hover:bg-destructive/30 text-destructive border border-destructive/50 font-display tracking-widest uppercase text-xs"
              >
                <PhoneOff className="w-4 h-4" /> ODPOJIT
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
