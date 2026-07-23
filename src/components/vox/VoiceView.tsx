import { useEffect, useState } from "react";
import { Volume2, Mic, MicOff, PhoneOff, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { VoxChannel } from "./ChannelSidebar";
import { useVoxVoice } from "@/hooks/useVoxVoice";
import { useAuth } from "@/contexts/AuthContext";

interface Participant {
  user_id: string;
  is_muted: boolean;
  is_deafened: boolean;
  display_name?: string | null;
  avatar_url?: string | null;
}

interface Props {
  channel: VoxChannel;
  onConnectionChange?: (connectedChannel: VoxChannel | null, api: ReturnType<typeof useVoxVoice>) => void;
}

export function VoiceView({ channel, onConnectionChange }: Props) {
  const { user } = useAuth();
  const voice = useVoxVoice(channel.id);
  const [participants, setParticipants] = useState<Participant[]>([]);

  useEffect(() => {
    onConnectionChange?.(voice.connected ? channel : null, voice);
  }, [voice.connected]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("vox_voice_participants")
        .select("user_id, is_muted, is_deafened")
        .eq("channel_id", channel.id);
      if (!data || !mounted) return;
      const ids = data.map((d: any) => d.user_id);
      const { data: profs } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const profMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
      setParticipants(data.map((d: any) => ({ ...d, ...profMap[d.user_id] })));
    };
    load();
    const ch = supabase.channel(`vox_vp_${channel.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_voice_participants", filter: `channel_id=eq.${channel.id}` }, load)
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [channel.id]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="h-12 px-4 flex items-center gap-2.5 border-b border-primary/20 bg-primary/5">
        <Volume2 className="w-4 h-4 text-primary text-glow" />
        <span className="font-display tracking-widest uppercase text-sm text-primary text-glow">{channel.name}</span>
        <span className="ml-auto text-[10px] font-display tracking-widest uppercase text-muted-foreground">
          VOICE LINK // {participants.length} ENTIT
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-6 holo-scroll">
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {participants.map((p) => {
              const isMe = p.user_id === user?.id;
              const level = isMe ? voice.selfLevel : (voice.remotes[p.user_id]?.level ?? 0);
              const speaking = level > 0.08 && !p.is_muted;
              const name = p.display_name || p.user_id.slice(0, 8);
              const pct = Math.min(100, Math.round(level * 180));
              return (
                <div key={p.user_id} className={cn(
                  "holo-pod aspect-square p-4 flex flex-col items-center justify-center gap-3 transition-all",
                  speaking && "shadow-[0_0_28px_hsl(160_84%_50%/0.5)]"
                )}>
                  <div
                    className={cn("rank-ring w-20 h-20", speaking && "speaking-ring")}
                    style={{ ["--rank-color" as any]: speaking ? "hsl(160 84% 50%)" : "hsl(var(--primary))" }}
                  >
                    <div className="rank-ring-inner overflow-hidden flex items-center justify-center text-lg font-display font-bold">
                      {p.avatar_url
                        ? <img src={p.avatar_url} alt={name} className="w-full h-full object-cover" />
                        : name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="font-display tracking-wider text-xs truncate max-w-full text-foreground">
                    {name}{isMe && <span className="text-primary"> // TY</span>}
                  </div>
                  <div className="w-full h-1 rounded-full bg-background/60 overflow-hidden border border-primary/20">
                    <div
                      className={cn("h-full transition-[width] duration-75", p.is_muted ? "bg-destructive/70" : "bg-emerald-400 shadow-[0_0_8px_hsl(160_84%_50%/0.8)]")}
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

      <div className="p-4 border-t border-primary/15 flex items-center justify-center gap-3">
        {!voice.connected ? (
          <Button
            onClick={voice.join}
            size="lg"
            className="gap-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-400/50 shadow-[0_0_18px_hsl(160_84%_50%/0.5)] font-display tracking-widest uppercase text-xs"
          >
            <Phone className="w-4 h-4" /> PŘIPOJIT LINK
          </Button>
        ) : (
          <>
            <Button
              onClick={voice.toggleMute}
              size="lg"
              variant={voice.muted ? "destructive" : "secondary"}
              className="gap-2 font-display tracking-widest uppercase text-xs cyber-btn"
            >
              {voice.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {voice.muted ? "MIC OFF" : "MIC ON"}
            </Button>
            <Button
              onClick={voice.leave}
              size="lg"
              className="gap-2 bg-destructive/20 hover:bg-destructive/40 text-destructive border border-destructive/50 shadow-[0_0_14px_hsl(var(--destructive)/0.5)] font-display tracking-widest uppercase text-xs"
            >
              <PhoneOff className="w-4 h-4" /> ODPOJIT
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
