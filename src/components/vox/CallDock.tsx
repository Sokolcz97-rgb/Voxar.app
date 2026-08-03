import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Video, VideoOff, MonitorUp, MonitorX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceCall } from "@/contexts/VoiceCallContext";

/**
 * Static, docked call controls. Never floats over the UI — it lives at the
 * bottom of the left column (and inside the active voice view).
 */
export function CallDock({ compact = false }: { compact?: boolean }) {
  const { channel, api, leaveChannel } = useVoiceCall();
  if (!api.connected || !channel) return null;

  const btn =
    "h-8 px-2.5 flex items-center justify-center gap-1.5 text-[9px] font-display tracking-[0.18em] uppercase border transition-colors [clip-path:polygon(7px_0,100%_0,100%_calc(100%-7px),calc(100%-7px)_100%,0_100%,0_7px)]";

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-primary/15">
        <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse" />
        <span className="font-display text-[9px] tracking-[0.26em] uppercase text-emerald-300 truncate">
          LINK · {channel.name}
        </span>
      </div>
      <div className={cn("p-2 grid gap-1.5", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
        <button
          onClick={api.toggleMute}
          className={cn(btn, api.muted
            ? "border-destructive/50 text-destructive bg-destructive/10"
            : "border-primary/35 text-primary hover:bg-primary/10")}
        >
          {api.muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          MIC
        </button>
        <button
          onClick={api.toggleDeafen}
          className={cn(btn, api.deafened
            ? "border-destructive/50 text-destructive bg-destructive/10"
            : "border-primary/35 text-primary hover:bg-primary/10")}
        >
          {api.deafened ? <HeadphoneOff className="w-3.5 h-3.5" /> : <Headphones className="w-3.5 h-3.5" />}
          AUDIO
        </button>
        <button
          onClick={api.toggleVideo}
          className={cn(btn, api.videoOn
            ? "border-emerald-400/50 text-emerald-300 bg-emerald-500/10"
            : "border-primary/35 text-primary hover:bg-primary/10")}
        >
          {api.videoOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
          KAMERA
        </button>
        <button
          onClick={api.toggleScreen}
          className={cn(btn, api.screenOn
            ? "border-emerald-400/50 text-emerald-300 bg-emerald-500/10"
            : "border-primary/35 text-primary hover:bg-primary/10")}
        >
          {api.screenOn ? <MonitorX className="w-3.5 h-3.5" /> : <MonitorUp className="w-3.5 h-3.5" />}
          SDÍLET
        </button>
        <button
          onClick={() => void leaveChannel()}
          className={cn(btn, "col-span-2 sm:col-span-1 border-destructive/50 text-destructive hover:bg-destructive/15")}
        >
          <PhoneOff className="w-3.5 h-3.5" /> ODPOJIT
        </button>
      </div>
    </div>
  );
}
