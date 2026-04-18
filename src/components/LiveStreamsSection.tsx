import { useLiveStreams, LiveStream } from "@/hooks/useLiveStreams";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tv, Eye, Radio } from "lucide-react";

const PLATFORM_META: Record<
  LiveStream["platform"],
  { label: string; brand: string; bg: string }
> = {
  twitch: { label: "Twitch", brand: "#9146FF", bg: "rgba(145,70,255,0.12)" },
  youtube: { label: "YouTube", brand: "#FF0033", bg: "rgba(255,0,51,0.12)" },
  kick: { label: "Kick", brand: "#53FC18", bg: "rgba(83,252,24,0.12)" },
};

const PLATFORM_ORDER: LiveStream["platform"][] = ["twitch", "youtube", "kick"];

function formatViewers(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function StreamCard({ s }: { s: LiveStream }) {
  const meta = PLATFORM_META[s.platform];
  const fallback = (s.display_name || s.handle || "?")
    .slice(0, 2)
    .toUpperCase();
  return (
    <a
      href={s.stream_url}
      target="_blank"
      rel="noreferrer"
      className="group block"
    >
      <Card className="glass border-border overflow-hidden hover:border-primary/60 transition-all hover:translate-y-[-2px] h-full">
        <div className="relative aspect-video bg-muted/40">
          {s.thumbnail_url ? (
            <img
              src={s.thumbnail_url}
              alt={s.title ?? s.handle}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Tv className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <Badge
            className="absolute top-2 left-2 gap-1 border-0 text-white font-bold uppercase tracking-wider text-[10px]"
            style={{ backgroundColor: meta.brand }}
          >
            <Radio className="h-3 w-3 animate-pulse" /> Live
          </Badge>
          <Badge
            variant="outline"
            className="absolute top-2 right-2 border-0 text-white"
            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          >
            <Eye className="h-3 w-3 mr-1" />
            {formatViewers(s.viewer_count)}
          </Badge>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-9 w-9 ring-2 ring-border">
              <AvatarImage src={s.avatar_url ?? undefined} />
              <AvatarFallback>{fallback}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold truncate group-hover:text-primary transition-colors">
                {s.display_name || s.handle}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {s.title || s.handle}
              </p>
              {s.game_name && (
                <p className="text-xs mt-1" style={{ color: meta.brand }}>
                  {s.game_name}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </a>
  );
}

export function LiveStreamsSection() {
  const { streams, loading } = useLiveStreams();

  if (loading) return null;

  // Group by platform
  const byPlatform: Record<LiveStream["platform"], LiveStream[]> = {
    twitch: [],
    youtube: [],
    kick: [],
  };
  streams.forEach((s) => byPlatform[s.platform].push(s));

  const totalLive = streams.length;

  return (
    <section className="container pb-32">
      <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">
            Live now
          </p>
          <h2 className="font-display font-black text-3xl md:text-4xl mt-2">
            Live streamy
          </h2>
        </div>
        {totalLive > 0 && (
          <Badge className="bg-destructive/20 text-destructive border-destructive/40 gap-2 px-3 py-1 text-sm">
            <Radio className="h-3 w-3 animate-pulse" />
            {totalLive} {totalLive === 1 ? "stream" : totalLive < 5 ? "streamy" : "streamů"} online
          </Badge>
        )}
      </div>

      {totalLive === 0 ? (
        <Card className="glass border-border p-10 text-center">
          <Tv className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            Aktuálně nikdo nestreamuje. Zkus to později!
          </p>
        </Card>
      ) : (
        <div className="space-y-10">
          {PLATFORM_ORDER.map((p) => {
            const list = byPlatform[p];
            if (list.length === 0) return null;
            const meta = PLATFORM_META[p];
            return (
              <div key={p}>
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-1 h-8 rounded-full"
                    style={{ backgroundColor: meta.brand }}
                  />
                  <h3
                    className="font-display font-bold text-xl"
                    style={{ color: meta.brand }}
                  >
                    {meta.label}
                  </h3>
                  <Badge
                    variant="outline"
                    className="border-0 font-bold"
                    style={{ backgroundColor: meta.bg, color: meta.brand }}
                  >
                    {list.length} live
                  </Badge>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {list.map((s) => (
                    <StreamCard key={s.id} s={s} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
