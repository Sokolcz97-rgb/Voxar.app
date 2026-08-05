import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, ExternalLink, Search, Flame, Gamepad2 } from "lucide-react";
import { PageHero } from "@/components/PageHero";

import { SEO } from "@/components/SEO";

type Release = {
  id: string;
  igdb_id: number;
  name: string;
  summary: string | null;
  cover_url: string | null;
  release_date: string | null;
  release_human: string | null;
  platforms: string[];
  genres: string[];
  hype: number | null;
  url: string | null;
  is_released: boolean;
};

const PLATFORM_OPTIONS = [
  "PC",
  "PlayStation 5",
  "PlayStation 4",
  "Xbox Series X|S",
  "Xbox One",
  "Nintendo Switch",
  "Nintendo Switch 2",
  "iOS",
  "Android",
];

const Novinky = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [sort, setSort] = useState<"date_asc" | "date_desc" | "hype">("date_asc");

  const fmtDate = (iso: string | null, human: string | null) => {
    if (!iso) return human ?? t("novinky.tba");
    const d = new Date(iso);
    const locale = i18n.language === "cs" ? "cs-CZ" : "en-US";
    return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("game_releases")
        .select("*")
        .order("release_date", { ascending: true })
        .limit(500);
      setItems((data ?? []) as Release[]);
      setLoading(false);
    })();
  }, []);

  const allGenres = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.genres.forEach((g) => s.add(g)));
    return [...s].sort();
  }, [items]);

  const filtered = useMemo(() => {
    let arr = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter((i) => i.name.toLowerCase().includes(q));
    }
    if (platform !== "all") {
      arr = arr.filter((i) => i.platforms.includes(platform));
    }
    if (sort === "date_asc") {
      arr = [...arr].sort((a, b) =>
        (a.release_date ?? "9999").localeCompare(b.release_date ?? "9999"),
      );
    } else if (sort === "date_desc") {
      arr = [...arr].sort((a, b) =>
        (b.release_date ?? "0").localeCompare(a.release_date ?? "0"),
      );
    } else {
      arr = [...arr].sort((a, b) => (b.hype ?? 0) - (a.hype ?? 0));
    }
    return arr;
  }, [items, search, platform, sort]);

  // Group by genre — game appears in each of its genres
  const byGenre = useMemo(() => {
    const map = new Map<string, Release[]>();
    for (const r of filtered) {
      const gs = r.genres.length ? r.genres : [t("novinky.genreOther")];
      for (const g of gs) {
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(r);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered, t]);

  return (
    <div className="min-h-screen relative">
      <SEO
        title={t("novinky.seoTitle")}
        description={t("novinky.seoDesc")}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: t("novinky.seoTitle"),
          description: t("novinky.seoDesc"),
          url: "https://studiovoxario.com/novinky",
        }}
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <PageHero
          eyebrow={t("novinky.tagline")}
          title={t("novinky.title")}
          icon={Gamepad2}
          description={
            <>
              {t("novinky.subtitle")}
              <br />
              <span className="text-foreground/70">
                {t("novinky.metaCount", { games: items.length, genres: allGenres.length })}
              </span>
            </>
          }
        />



        <Card className="glass border-border p-4 mb-6">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("novinky.searchPlaceholder")}
                className="pl-9"
              />
            </div>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue placeholder={t("novinky.platform")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("novinky.allPlatforms")}</SelectItem>
                {PLATFORM_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_asc">{t("novinky.sortDateAsc")}</SelectItem>
                <SelectItem value="date_desc">{t("novinky.sortDateDesc")}</SelectItem>
                <SelectItem value="hype">{t("novinky.sortHype")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="glass border-border p-10 text-center">
            <p className="text-muted-foreground">
              {t("novinky.emptyFilter")}
              <span className="text-primary"> /admin/novinky</span>.
            </p>
          </Card>
        ) : (
          <div className="space-y-10">
            {byGenre.map(([genre, list]) => (
              <section key={genre}>
                <div className="flex items-baseline gap-3 mb-4">
                  <h2 className="font-display font-bold text-2xl">{genre}</h2>
                  <span className="text-xs text-muted-foreground">
                    {list.length} {t("novinky.gamesShort")}
                  </span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {list.slice(0, 12).map((r) => (
                    <ReleaseCard key={`${genre}-${r.id}`} r={r} fmtDate={fmtDate} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const ReleaseCard = ({
  r,
  fmtDate,
}: {
  r: Release;
  fmtDate: (iso: string | null, human: string | null) => string;
}) => {
  const { t } = useTranslation();
  return (
  <Card className="glass border-border overflow-hidden flex flex-col group hover:border-primary/50 transition-all">
    <div className="aspect-[3/4] bg-muted relative overflow-hidden">
      {r.cover_url ? (
        <img
          src={r.cover_url}
          alt={r.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">
          {t("novinky.noImage")}
        </div>
      )}
      {r.is_released && (
        <Badge className="absolute top-2 left-2 bg-accent text-accent-foreground">{t("novinky.released")}</Badge>
      )}
      {(r.hype ?? 0) > 50 && (
        <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground gap-1">
          <Flame className="h-3 w-3" />{r.hype}
        </Badge>
      )}
    </div>
    <div className="p-3 flex-1 flex flex-col">
      <h3 className="font-display font-bold text-sm line-clamp-2">{r.name}</h3>
      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
        <CalendarDays className="h-3 w-3" />
        {fmtDate(r.release_date, r.release_human)}
      </div>
      {r.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {r.platforms.slice(0, 3).map((p) => (
            <Badge key={p} variant="outline" className="text-[10px] px-1.5 py-0">
              {p}
            </Badge>
          ))}
        </div>
      )}
      {r.url && (
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          {t("novinky.detailIgdb")} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  </Card>
  );
};

export default Novinky;
