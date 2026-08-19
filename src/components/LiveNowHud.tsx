import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Radio, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLiveStreams, type LiveStream } from "@/hooks/useLiveStreams";

const BRAND: Record<LiveStream["platform"], string> = {
  twitch: "#9146FF",
  youtube: "#FF0033",
  kick: "#53FC18",
};

/**
 * Cyber HUD notification: slides in when a tracked streamer goes live.
 * Purely presentational — data comes from the existing live_streams_cache feed.
 */
export function LiveNowHud() {
  const { streams } = useLiveStreams();
  const seen = useRef<Set<string> | null>(null);
  const [alert, setAlert] = useState<LiveStream | null>(null);

  useEffect(() => {
    const live = streams.filter((s) => s.is_live);
    if (seen.current === null) {
      seen.current = new Set(live.map((s) => s.id));
      return;
    }
    const fresh = live.find((s) => !seen.current!.has(s.id));
    live.forEach((s) => seen.current!.add(s.id));
    streams.filter((s) => !s.is_live).forEach((s) => seen.current!.delete(s.id));
    if (fresh) setAlert(fresh);
  }, [streams]);

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 12000);
    return () => clearTimeout(t);
  }, [alert]);

  if (!alert) return null;
  const brand = BRAND[alert.platform];
  const label = alert.display_name || alert.handle;

  return (
    <div className="fixed bottom-6 left-6 z-[70] w-[320px] max-w-[calc(100vw-3rem)] animate-in slide-in-from-left-6 fade-in duration-300">
      <div className="web-panel web-panel-accent p-3 pr-8 relative">
        <button
          type="button"
          onClick={() => setAlert(null)}
          aria-label="Zavřít upozornění"
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="text-[10px] uppercase tracking-[0.3em] flex items-center gap-1.5" style={{ color: brand }}>
          <Radio className="h-3 w-3 animate-pulse" /> Live now
        </p>
        <Link to="/live" className="flex items-center gap-3 mt-2 group">
          <Avatar className="h-10 w-10 ring-2" style={{ borderColor: brand }}>
            <AvatarImage src={alert.avatar_url ?? undefined} />
            <AvatarFallback>{label.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-display font-bold truncate group-hover:text-primary transition-colors">
              {label}
            </p>
            <p className="text-xs text-muted-foreground truncate">{alert.title || alert.game_name || "právě vysílá"}</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
