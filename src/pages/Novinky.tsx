import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, ExternalLink, Search, Flame } from "lucide-react";

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
  "Steam",
  "Epic Games Store",
  "GOG",
  "Xbox Marketplace",
  "Playstation Store US",
  "PlayStation 5",
  "Xbox Series X|S",
  "Nintendo Switch",
];

const fmtDate = (iso: string | null, human: string | null) => {
  if (!iso) return human ?? "TBA";
  const d = new Date(iso);
  return d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" });
};

const Novinky = () => {
  const [items, setItems] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState<string>("all");
  const [sort, setSort] = useState<"date_asc" | "date_desc" | "hype">("date_asc");

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
      const gs = r.genres.length ? r.genres : ["Ostatní"];
      for (const g of gs) {
        if (!map.has(g)) map.set(g, []);
        map.get(g)!.push(r);
      }
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Novinky</p>
          <h1 className="font-display font-black text-4xl md:text-5xl mt-2">
            Nadcházející herní vydání
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Co se chystá na Steamu, Epic Games Store, Ubisoft Connect, EA App, PlayStationu, Xboxu a Switchi.
            Data z IGDB · {items.length} her · {allGenres.length} žánrů
          </p>
        </div>

        <Card className="glass border-border p-4 mb-6">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat hru…"
                className="pl-9"
              />
            </div>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue placeholder="Platforma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny platformy</SelectItem>
                {PLATFORM_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_asc">Nejdřív vyjdou (vzestupně)</SelectItem>
                <SelectItem value="date_desc">Nejnovější vydání první</SelectItem>
                <SelectItem value="hype">Nejvíc očekávané (hype)</SelectItem>
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
              Žádné hry neodpovídají filtru. Pokud je seznam prázdný, admin musí spustit synchronizaci v
              <span className="text-primary"> /admin/novinky</span>.
            </p>
          </Card>
        ) : (
          <div className="space-y-10">
            {byGenre.map(([genre, list]) => (
              <section key={genre}>
                <div className="flex items-baseline gap-3 mb-4">
                  <h2 className="font-display font-bold text-2xl">{genre}</h2>
                  <span className="text-xs text-muted-foreground">{list.length} her</span>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {list.slice(0, 12).map((r) => (
                    <ReleaseCard key={`${genre}-${r.id}`} r={r} />
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

const ReleaseCard = ({ r }: { r: Release }) => (
  <Card className="glass border-border overflow-hidden flex flex-col group hover:border-primary/50 transition-all">
    <div className="aspect-[3/4] bg-muted relative overflow-hidden">
      {r.cover_url ? (
        <img
          src={r.cover_url}
          alt={r.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <div className="w-full h-full grid place-items-center text-muted-foreground text-xs">
          Bez obrázku
        </div>
      )}
      {r.is_released && (
        <Badge className="absolute top-2 left-2 bg-green-600 text-white">Vyšlo</Badge>
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
          Detail na IGDB <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  </Card>
);

export default Novinky;
