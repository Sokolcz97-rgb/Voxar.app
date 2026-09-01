import { useCosmeticRings } from "@/hooks/useCosmeticRing";
import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2, MicOff, PhoneOff, Phone, Eye, EyeOff, Maximize2, Users } from "lucide-react";
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

function VideoTile({
  stream,
  label,
  mirrored,
  className,
  onExpand,
  spotlighted,
}: {
  stream: MediaStream;
  label: string;
  mirrored?: boolean;
  className?: string;
  onExpand?: () => void;
  spotlighted?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div
      className={cn(
        "relative bg-[hsl(222_40%_5%)] border overflow-hidden group",
        "[clip-path:polygon(14px_0,100%_0,100%_calc(100%-14px),calc(100%-14px)_100%,0_100%,0_14px)]",
        spotlighted ? "border-emerald-400/60 shadow-[0_0_28px_hsl(160_84%_50%/0.25)]" : "border-primary/30",
        className,
      )}
    >
      {/* Local element is always muted — prevents microphone echo. */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={cn("w-full h-full object-cover", mirrored && "scale-x-[-1]")}
      />
      {onExpand && !spotlighted && (
        <button
          type="button"
          onClick={onExpand}
          title="Zobrazit na hlavní ploše"
          className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center border border-primary/40 bg-[hsl(222_42%_5%/0.8)] text-primary opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/15"
        >
          <Maximize2 className="w-3 h-3" />
        </button>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-[hsl(222_42%_5%/0.85)] flex items-center gap-1.5">
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
  const [profiles, setProfiles] = useState<Record<string, { display_name?: string | null; avatar_url?: string | null }>>({});
  const [spotlight, setSpotlight] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
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
      setProfiles((prev) => ({ ...prev, ...profMap }));
      setRows(data.map((d: any) => ({ ...d, ...profMap[d.user_id] })));
    };
    load();
    const purge = window.setInterval(load, 15000);
    const ch = supabase.channel(`vox_vp_${channel.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_voice_participants", filter: `channel_id=eq.${channel.id}` }, load)
      .subscribe();
    return () => { mounted = false; window.clearInterval(purge); supabase.removeChannel(ch); };
  }, [channel.id]);

  // Roster = union of live SFU presence and metadata rows. Never drop someone
  // just because one of the two sources lags behind — that hid participants.
  const participants: Participant[] = useMemo(() => {
    const map = new Map<string, Participant>();
    for (const r of rows) map.set(r.user_id, r);
    if (joinedHere) {
      api.presentIds.forEach((id) => {
        if (!map.has(id)) {
          map.set(id, { user_id: id, is_muted: false, is_deafened: false, ...(profiles[id] || {}) });
        }
      });
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.user_id === user?.id ? -1 : b.user_id === user?.id ? 1 : (a.display_name || a.user_id).localeCompare(b.display_name || b.user_id)),
    );
  }, [rows, joinedHere, api.presentIds, profiles, user?.id]);

  // Fetch profiles for SFU-only identities that have no metadata row yet.
  useEffect(() => {
    const missing = participants.filter((p) => !p.display_name && !profiles[p.user_id]).map((p) => p.user_id);
    if (!missing.length) return;
    let mounted = true;
    void (async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", missing);
      if (!mounted || !data) return;
      setProfiles((prev) => ({ ...prev, ...Object.fromEntries(data.map((p: any) => [p.user_id, p])) }));
    })();
    return () => { mounted = false; };
  }, [participants, profiles]);

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
    return p?.display_name || profiles[uid]?.display_name || (uid === user?.id ? "TY" : uid.slice(0, 8));
  };

  const remoteVideos = joinedHere
    ? Object.values(api.remotes)
        .filter((r: any) => r.stream && r.stream.getVideoTracks().length > 0)
        .map((r: any) => ({ id: r.userId as string, stream: r.stream as MediaStream }))
    : [];
  const allTiles = [
    ...(joinedHere && api.localVideoStream
      ? [{ id: user?.id || "self", stream: api.localVideoStream, label: "TY", mirrored: api.videoOn && !api.screenOn }]
      : []),
    ...remoteVideos.map((r) => ({ id: r.id, stream: r.stream, label: nameOf(r.id), mirrored: false })),
  ];
  const videoIds = new Set(allTiles.map((t) => t.id));
  const tiles = allTiles.filter((t) => !hidden[t.id]);

  useEffect(() => {
    if (spotlight && !tiles.some((t) => t.id === spotlight)) setSpotlight(null);
  }, [spotlight, tiles]);

  const main = spotlight ? tiles.find((t) => t.id === spotlight) : tiles[0];
  const strip = tiles.filter((t) => t.id !== main?.id);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="h-12 px-4 flex items-center gap-2.5 border-b border-primary/20 bg-primary/5">
        <Volume2 className="w-4 h-4 text-primary text-glow" />
        <span className="font-display tracking-widest uppercase text-sm text-primary text-glow">{channel.name}</span>
        <span className="ml-auto text-[10px] font-display tracking-widest uppercase text-muted-foreground">
          VOICE LINK // {participants.length} ENTIT
        </span>
      </div>

      {/* Roster strip — vždy vidíš celou relaci, i když nikdo nevysílá obraz. */}
      {participants.length > 0 && (
        <div className="shrink-0 border-b border-primary/15 bg-[hsl(222_42%_5%/0.5)] px-3 py-2">
          <div className="flex items-center gap-2 mb-1.5">
            <Users className="w-3 h-3 text-primary/70" />
            <span className="text-[9px] font-display uppercase tracking-[0.28em] text-primary/70">
              // RELACE · {participants.length}
            </span>
            <span className="flex-1 h-px bg-gradient-to-r from-primary/30 to-transparent" />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto hud-scrollbar pb-0.5">
            {participants.map((p) => {
              const isMe = p.user_id === user?.id;
              const level = isMe ? api.selfLevel : (api.remotes[p.user_id]?.level ?? 0);
              const speaking = joinedHere && level > 0.08 && !p.is_muted;
              const name = p.display_name || profiles[p.user_id]?.display_name || (isMe ? "TY" : p.user_id.slice(0, 8));
              const hasVideo = videoIds.has(p.user_id);
              const isHidden = !!hidden[p.user_id];
              return (
                <div
                  key={p.user_id}
                  className={cn(
                    "shrink-0 flex items-center gap-2 pl-1.5 pr-2 py-1 border transition-colors",
                    "[clip-path:polygon(8px_0,100%_0,100%_calc(100%-8px),calc(100%-8px)_100%,0_100%,0_8px)]",
                    speaking
                      ? "border-emerald-400/60 bg-emerald-500/10"
                      : "border-primary/25 bg-[hsl(222_42%_7%/0.7)]",
                  )}
                >
                  <div className="w-6 h-6 overflow-hidden border border-primary/30 flex items-center justify-center text-[9px] font-display">
                    {(p.avatar_url || profiles[p.user_id]?.avatar_url)
                      ? <img src={(p.avatar_url || profiles[p.user_id]?.avatar_url) as string} alt={name} className="w-full h-full object-cover" />
                      : name.slice(0, 2).toUpperCase()}
                  </div>
                  <span className={cn("text-[10px] font-display tracking-wide truncate max-w-[110px]", speaking ? "text-emerald-300" : "text-foreground/85")}>
                    {name}
                  </span>
                  {p.is_muted && <MicOff className="w-3 h-3 text-destructive" />}
                  {hasVideo && (
                    <>
                      <button
                        type="button"
                        title={isHidden ? "Zobrazit náhled" : "Skrýt náhled"}
                        onClick={() => setHidden((h) => ({ ...h, [p.user_id]: !isHidden }))}
                        className={cn("transition-colors", isHidden ? "text-muted-foreground hover:text-primary" : "text-emerald-300 hover:text-emerald-200")}
                      >
                        {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      {!isHidden && (
                        <button
                          type="button"
                          title="Na hlavní plochu"
                          onClick={() => setSpotlight(p.user_id)}
                          className={cn("transition-colors", spotlight === p.user_id ? "text-emerald-300" : "text-primary/70 hover:text-primary")}
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto hud-scrollbar p-4 sm:p-5">
        {main && (
          <div className="mb-5 flex flex-col lg:flex-row gap-3 items-start">
            <VideoTile
              stream={main.stream}
              label={main.label}
              mirrored={main.mirrored}
              spotlighted
              className="w-full lg:flex-1 aspect-video max-h-[48vh]"
            />
            {strip.length > 0 && (
              <div className="flex lg:flex-col gap-2 w-full lg:w-44 overflow-x-auto lg:overflow-visible">
                {strip.map((t) => (
                  <VideoTile
                    key={t.id}
                    stream={t.stream}
                    label={t.label}
                    mirrored={t.mirrored}
                    onExpand={() => setSpotlight(t.id)}
                    className="w-40 lg:w-full aspect-video shrink-0"
                  />
                ))}
              </div>
            )}
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
          <div className="flex flex-wrap gap-3">
            {participants.map((p) => {
              const isMe = p.user_id === user?.id;
              const level = isMe ? api.selfLevel : (api.remotes[p.user_id]?.level ?? 0);
              const speaking = joinedHere && level > 0.08 && !p.is_muted;
              const name = p.display_name || profiles[p.user_id]?.display_name || (isMe ? "TY" : p.user_id.slice(0, 8));
              const avatar = p.avatar_url || profiles[p.user_id]?.avatar_url;
              const pct = Math.min(100, Math.round(level * 180));
              const hasVideo = videoIds.has(p.user_id);
              return (
                <div key={p.user_id} className={cn(
                  "holo-pod w-[136px] p-3 flex flex-col items-center gap-2 transition-all",
                  speaking && "shadow-[0_0_22px_hsl(160_84%_50%/0.4)]"
                )}>
                  <div
                    className={cn("rank-ring w-14 h-14", speaking && "speaking-ring", cosmeticRings[p.user_id] || "")}
                    style={{ ["--rank-color" as any]: speaking ? "hsl(160 84% 50%)" : "hsl(var(--primary))" }}
                  >
                    <div className="rank-inner overflow-hidden flex items-center justify-center text-sm font-display font-bold">
                      {avatar
                        ? <img loading="lazy" decoding="async" src={avatar} alt={name} className="w-full h-full object-cover" />
                        : name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="font-display tracking-wider text-[11px] truncate max-w-full text-foreground">
                    {name}{isMe && <span className="text-primary"> // TY</span>}
                  </div>
                  <div className="w-full h-1 bg-background/60 overflow-hidden border border-primary/20">
                    <div
                      className={cn("h-full transition-[width] duration-75", p.is_muted ? "bg-destructive/70" : "bg-emerald-400")}
                      style={{ width: `${p.is_muted ? 0 : pct}%` }}
                    />
                  </div>
                  <div className="flex items-center gap-2 h-4">
                    {p.is_muted && (
                      <span className="flex items-center gap-1 text-[9px] font-display tracking-widest uppercase text-destructive">
                        <MicOff className="w-3 h-3" /> MUTE
                      </span>
                    )}
                    {hasVideo && (
                      <button
                        type="button"
                        onClick={() => (hidden[p.user_id]
                          ? setHidden((h) => ({ ...h, [p.user_id]: false }))
                          : setSpotlight(p.user_id))}
                        title={hidden[p.user_id] ? "Zobrazit náhled" : "Zobrazit video na hlavní ploše"}
                        className="flex items-center gap-1 text-[9px] font-display tracking-widest uppercase text-emerald-300 hover:text-emerald-200"
                      >
                        {hidden[p.user_id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} VIDEO
                      </button>
                    )}
                  </div>
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
