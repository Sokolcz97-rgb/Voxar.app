import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RefreshCw, Database, Flame } from "lucide-react";
import { toast } from "sonner";

const AdminNovinky = () => {
  const [count, setCount] = useState<number | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [includeTopSellers, setIncludeTopSellers] = useState(true);
  const [includeSpecials, setIncludeSpecials] = useState(false);

  const load = async () => {
    const { count: c } = await supabase
      .from("game_releases")
      .select("*", { count: "exact", head: true });
    setCount(c ?? 0);

    const { data } = await supabase
      .from("game_releases")
      .select("fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(1);
    setLastFetched(data?.[0]?.fetched_at ?? null);
  };

  useEffect(() => { load(); }, []);

  const syncNow = async () => {
    setSyncing(true);
    const t = toast.loading("Tahám novinky ze Steamu…");
    try {
      const { data, error } = await supabase.functions.invoke("sync-steam-releases", {
        body: {
          include_top_sellers: includeTopSellers,
          include_specials: includeSpecials,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Synchronizováno: ${data?.synced ?? 0} her (z ${data?.considered ?? 0} kandidátů)`,
        { id: t },
      );
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Sync selhal", { id: t });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in max-w-3xl">
        <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Administrace</p>
        <h1 className="font-display font-black text-4xl mt-2 mb-2">Novinky · Steam sync</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Zdrojem je teď oficiální Steam Store API (bez API klíče). Pokrývá publikanty napříč PC scénou —
          nadcházející vydání, čerstvě vydané, top sellers.
        </p>

        <Card className="glass border-border p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground">Her v databázi</div>
              <div className="font-display font-bold text-2xl">{count ?? "—"}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-sm text-muted-foreground">Poslední sync</div>
              <div className="font-mono text-xs">
                {lastFetched ? new Date(lastFetched).toLocaleString("cs-CZ") : "Nikdy"}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-border">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Zahrnout sekce
            </Label>
            <label className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-primary/5 cursor-pointer transition-colors">
              <Checkbox checked disabled />
              <span className="text-sm">Coming Soon · New Releases (vždy)</span>
            </label>
            <label className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-primary/5 cursor-pointer transition-colors">
              <Checkbox
                checked={includeTopSellers}
                onCheckedChange={(v) => setIncludeTopSellers(!!v)}
              />
              <span className="text-sm">Top Sellers</span>
            </label>
            <label className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-primary/5 cursor-pointer transition-colors">
              <Checkbox
                checked={includeSpecials}
                onCheckedChange={(v) => setIncludeSpecials(!!v)}
              />
              <span className="text-sm">Specials (slevy)</span>
            </label>
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-md bg-primary/5 border border-primary/20">
              <Flame className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Sync přepíše existující katalog. Steam vrací ~60-90 her na sync; pro širší pokrytí spusť
                víckrát během dne (Steam rotuje featured).
              </span>
            </div>
            <Button onClick={syncNow} disabled={syncing} className="w-full">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Synchronizuji…" : "Spustit sync teď"}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default AdminNovinky;
