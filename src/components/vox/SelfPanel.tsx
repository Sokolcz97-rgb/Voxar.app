import { Mic, MicOff, Headphones, HeadphoneOff, Settings, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  displayName: string;
  avatarUrl?: string | null;
  status?: string;
  muted: boolean;
  deafened: boolean;
  connectedChannelName: string | null;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onLeaveVoice: () => void;
  onOpenSettings: () => void;
}

export function SelfPanel({
  displayName, avatarUrl, status = "Online", muted, deafened,
  connectedChannelName, onToggleMute, onToggleDeafen, onLeaveVoice, onOpenSettings,
}: Props) {
  return (
    <div className="border-t border-primary/15 bg-transparent">
      {connectedChannelName && (
        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2 bg-emerald-500/10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] text-emerald-400 font-semibold uppercase tracking-wide">Hlas připojen</div>
            <div className="text-xs text-muted-foreground truncate">{connectedChannelName}</div>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/20 hover:text-destructive" onClick={onLeaveVoice} title="Odpojit hlas">
            <PhoneOff className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
      <div className="h-14 px-2 flex items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0 px-1">
          <div
            className="rank-ring shrink-0"
            style={{ ["--rank-color" as any]: "hsl(184 100% 54%)" }}
          >
            <div className="rank-inner w-8 h-8 flex items-center justify-center text-xs font-semibold">
              {avatarUrl
                ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                : displayName.slice(0, 2).toUpperCase()}
            </div>
          </div>

          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            <div className="text-[11px] text-muted-foreground truncate">{status}</div>
          </div>
        </div>
        <Button size="icon" variant="ghost" className={cn("h-8 w-8", muted && "text-destructive")} onClick={onToggleMute} title={muted ? "Zapnout mikrofon" : "Ztlumit mikrofon"}>
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="ghost" className={cn("h-8 w-8", deafened && "text-destructive")} onClick={onToggleDeafen} title={deafened ? "Zapnout zvuk" : "Vypnout zvuk"}>
          {deafened ? <HeadphoneOff className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onOpenSettings} title="Nastavení">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
