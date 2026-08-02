import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Headphones, HeadphoneOff, PhoneOff, Video, VideoOff, MonitorUp, MonitorX, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceCall } from "@/contexts/VoiceCallContext";

function VideoTile({ stream, label, mirrored }: { stream: MediaStream; label: string; mirrored?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative bg-[hsl(222_40%_6%)] border border-primary/25 overflow-hidden [clip-path:polygon(12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%,0_12px)]">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={cn("w-full h-full object-cover aspect-video", mirrored && "scale-x-[-1]")}
      />
      <div className="absolute bottom-1 left-2 text-[9px] font-display tracking-[0.24em] uppercase text-primary/85">
        {label}
      </div>
    </div>
  );
}

/**
 * Persistent voice HUD. Rendered once above the router, so the call keeps
 * running (and stays controllable) across route / view changes.
 */
export function VoiceOverlay() {
  const { channel, api, leaveChannel } = useVoiceCall();
  const [collapsed, setCollapsed] = useState(false);

  if (!api.connected || !channel) return null;

  const remoteVideos = Object.values(api.remotes)
    .filter((r) => r.stream && r.stream.getVideoTracks().length > 0)
    .map((r) => ({ id: r.userId, stream: r.stream! }));
  const hasVideo = !!api.localVideoStream || remoteVideos.length > 0;

  const btn = "h-9 px-3 flex items-center gap-1.5 text-[10px] font-display tracking-[0.2em] uppercase border transition-colors [clip-path:polygon(8px_0,100%_0,100%_calc(100%-8px),calc(100%-8px)_100%,0_100%,0_8px)]";

  return (
    <div className="fixed bottom-4 left-4 z-50 w-[min(560px,calc(100vw-2rem))] pointer-events-auto">
      <div className="bg-[hsl(222_42%_7%/0.94)] border border-primary/30 backdrop-blur-md [clip-path:polygon(16px_0,100%_0,100%_calc(100%-16px),calc(100%-16px)_100%,0_100%,0_16px)]">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/20">
          <span className="w-1.5 h-1.5 bg-emerald-400 animate-pulse" />
          <span className="font-display text-[10px] tracking-[0.26em] uppercase text-primary">
            LINK · {channel.name}
          </span>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="ml-auto text-primary/70 hover:text-primary"
            aria-label={collapsed ? "Rozbalit" : "Sbalit"}
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {!collapsed && hasVideo && (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[46vh] overflow-y-auto">
            {api.localVideoStream && (
              <VideoTile stream={api.localVideoStream} label="TY" mirrored={api.videoOn && !api.screenOn} />
            )}
            {remoteVideos.map((r) => (
              <VideoTile key={r.id} stream={r.stream} label={r.id.slice(0, 6)} />
            ))}
          </div>
        )}

        {!collapsed && (
          <div className="p-3 flex flex-wrap items-center gap-2">
            <button
              onClick={api.toggleMute}
              className={cn(btn, api.muted
                ? "border-destructive/50 text-destructive bg-destructive/10"
                : "border-primary/35 text-primary hover:bg-primary/10")}
            >
              {api.muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              {api.muted ? "MIC OFF" : "MIC"}
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
              OBRAZOVKA
            </button>
            <button
              onClick={() => void leaveChannel()}
              className={cn(btn, "ml-auto border-destructive/50 text-destructive hover:bg-destructive/15")}
            >
              <PhoneOff className="w-3.5 h-3.5" /> ODPOJIT
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
