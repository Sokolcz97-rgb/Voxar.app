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
    <div className="flex-1 flex flex-col bg-[hsl(222_35%_4%)]">
      <div className="h-12 px-4 flex items-center gap-2 border-b border-border/50 shadow-sm">
        <Volume2 className="w-5 h-5 text-muted-foreground" />
        <span className="font-semibold">{channel.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">{participants.length} v místnosti</span>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {participants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Volume2 className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Zatím tu nikdo není</h3>
              <p className="text-sm text-muted-foreground">Buď první, kdo se připojí do <b>{channel.name}</b>.</p>
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
                  "aspect-square rounded-xl bg-secondary/70 border-2 flex flex-col items-center justify-center gap-3 p-4 transition-all",
                  speaking ? "border-emerald-400 shadow-[0_0_20px_hsl(160_84%_45%/0.4)]" : "border-transparent"
                )}>
                  <div className={cn(
                    "w-20 h-20 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center text-lg font-bold",
                    speaking && "ring-4 ring-emerald-400/40"
                  )}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt={name} className="w-full h-full object-cover" />
                      : name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="text-sm font-medium truncate max-w-full">{name}{isMe && " (ty)"}</div>
                  <div className="w-full h-1.5 rounded-full bg-background/60 overflow-hidden">
                    <div
                      className={cn("h-full transition-[width] duration-75", p.is_muted ? "bg-destructive/70" : "bg-emerald-400")}
                      style={{ width: `${p.is_muted ? 0 : pct}%` }}
                    />
                  </div>
                  {p.is_muted && <MicOff className="w-4 h-4 text-destructive" />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border/50 flex items-center justify-center gap-3">
        {!voice.connected ? (
          <Button onClick={voice.join} size="lg" className="gap-2 bg-emerald-500 hover:bg-emerald-600 text-white">
            <Phone className="w-4 h-4" /> Připojit se k hlasu
          </Button>
        ) : (
          <>
            <Button onClick={voice.toggleMute} size="lg" variant={voice.muted ? "destructive" : "secondary"} className="gap-2">
              {voice.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {voice.muted ? "Zapnout mikrofon" : "Ztlumit"}
            </Button>
            <Button onClick={voice.leave} size="lg" variant="destructive" className="gap-2">
              <PhoneOff className="w-4 h-4" /> Odpojit
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
