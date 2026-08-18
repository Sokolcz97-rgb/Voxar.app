import { useCosmeticRing } from "@/hooks/useCosmeticRing";
import { Mic, MicOff, Headphones, HeadphoneOff, Settings, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  displayName: string;
  avatarUrl?: string | null;
  status?: string;
  muted: boolean;
  deafened: boolean;
  speaking?: boolean;
  connectedChannelName: string | null;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onLeaveVoice: () => void;
  onOpenSettings: () => void;
}

export function SelfPanel({
  displayName, avatarUrl, status = "Online", muted, deafened, speaking,
  connectedChannelName, onToggleMute, onToggleDeafen, onLeaveVoice, onOpenSettings,
}: Props) {
  const { user } = useAuth();
  const cosmeticRing = useCosmeticRing(user?.id);
  const showSpeaking = speaking && !muted;
  const subtitle = connectedChannelName
    ? (showSpeaking ? "Speaking" : connectedChannelName)
    : status;

  return (
    <div className="border-t border-primary/15 bg-transparent">
      {connectedChannelName && (
        <div className="px-3 py-1.5 border-b border-primary/15 flex items-center gap-2 bg-emerald-500/10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(160_84%_45%)]" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-emerald-400 font-display font-semibold uppercase tracking-[0.22em]">Hlas připojen</div>
            <div className="text-xs text-muted-foreground truncate font-display">{connectedChannelName}</div>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive" onClick={onLeaveVoice} title="Odpojit hlas">
            <PhoneOff className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
      <div className="h-16 px-2 flex items-center gap-2">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 px-1">
          <div
            className={cn("rank-ring shrink-0", showSpeaking && "speaking-ring", cosmeticRing)}
            style={{ ["--rank-color" as any]: "hsl(184 100% 54%)" }}
          >
            <div className="rank-inner w-9 h-9 flex items-center justify-center text-xs font-display font-bold">
              {avatarUrl
                ? <img loading="lazy" decoding="async" src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                : displayName.slice(0, 2).toUpperCase()}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-display font-semibold truncate text-glow">{displayName}</div>
            <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
              {showSpeaking && <span className="holo-eq"><span/><span/><span/><span/></span>}
              <span className={cn("truncate", showSpeaking && "text-emerald-400")}>{subtitle}</span>
            </div>
          </div>
        </div>
        <Button size="icon" variant="ghost" className={cn("h-8 w-8 hover:text-primary hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)]", muted && "text-destructive")} onClick={onToggleMute} title={muted ? "Zapnout mikrofon" : "Ztlumit mikrofon"}>
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="ghost" className={cn("h-8 w-8 hover:text-primary hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)]", deafened && "text-destructive")} onClick={onToggleDeafen} title={deafened ? "Zapnout zvuk" : "Vypnout zvuk"}>
          {deafened ? <HeadphoneOff className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-primary hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)]" onClick={onOpenSettings} title="Nastavení">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
