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
    ? (showSpeaking ? "Mluví" : connectedChannelName)
    : status;

  return (
    <div className="vox-self-panel vox-self-panel-v19 border-t border-primary/15 bg-transparent">
      <span className="vox-self-panel-edge" aria-hidden="true" />
      {connectedChannelName && (
        <div className="vox-self-call-state px-3 py-1.5 border-b border-primary/15 flex items-center gap-2 bg-emerald-500/10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_hsl(160_84%_45%)]" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-emerald-400 font-display font-semibold uppercase tracking-[0.22em]">Hlas připojen</div>
            <div className="text-xs text-muted-foreground truncate font-display">{connectedChannelName}</div>
          </div>
          <Button size="icon" variant="ghost" className="vox-self-action h-7 w-7 hover:bg-destructive/20 hover:text-destructive" onClick={onLeaveVoice} title="Odpojit hlas">
            <PhoneOff className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
      <div className="vox-self-panel-row h-16 px-2 flex items-center gap-1.5">
        <div className="vox-self-panel-identity flex items-center gap-2 flex-1 min-w-0 px-0.5">
          <div className="vox-self-avatar-wrap relative shrink-0">
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
            <span
              className={cn(
                "absolute -right-0.5 bottom-0 w-2.5 h-2.5 rounded-full border-2 border-[#031827] shadow-[0_0_7px_rgba(52,226,168,0.55)]",
                showSpeaking ? "bg-emerald-300 animate-pulse" : "bg-emerald-400",
              )}
              aria-label={showSpeaking ? "Mluví" : status}
              title={showSpeaking ? "Mluví" : status}
            />
          </div>

          <div className="vox-self-panel-copy min-w-0 flex-1">
            <div className="vox-self-panel-name text-[13px] font-display font-semibold truncate text-glow">{displayName}</div>
            <div className="vox-self-panel-status text-[10px] text-muted-foreground truncate flex items-center gap-1.5">
              {showSpeaking && <span className="holo-eq"><span/><span/><span/><span/></span>}
              <span className={cn("truncate", showSpeaking && "text-emerald-400")}>{subtitle}</span>
            </div>
            {!connectedChannelName && <div className="vox-self-panel-tagline">Tvoříme další zážitek.</div>}
          </div>
        </div>
        <div className="vox-self-panel-actions flex items-center gap-0.5 shrink-0">
          <Button size="icon" variant="ghost" className={cn("vox-self-action h-7 w-7 hover:text-primary hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)]", muted && "text-destructive")} onClick={onToggleMute} title={muted ? "Zapnout mikrofon" : "Ztlumit mikrofon"}>
            {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className={cn("vox-self-action h-7 w-7 hover:text-primary hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)]", deafened && "text-destructive")} onClick={onToggleDeafen} title={deafened ? "Zapnout zvuk" : "Vypnout zvuk"}>
            {deafened ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
          </Button>
          <Button size="icon" variant="ghost" className="vox-self-action h-7 w-7 hover:text-primary hover:shadow-[0_0_10px_hsl(var(--primary)/0.4)]" onClick={onOpenSettings} title="Nastavení">
            <Settings className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
