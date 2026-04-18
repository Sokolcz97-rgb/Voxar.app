import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";

const AdminNovinky = () => {
  const [count, setCount] = useState<number | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

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
    const t = toast.loading("Synchronizuji s IGDB…");
    try {
      const { data, error } = await supabase.functions.invoke("sync-game-releases");
      if (error) throw error;
      toast.success(`Synchronizováno: ${data?.synced ?? 0} her`, { id: t });
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
        <h1 className="font-display font-black text-4xl mt-2 mb-8">Novinky · IGDB sync</h1>

        <Card className="glass border-border p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm text-muted-foreground">Her v databázi</div>
              <div className="font-display font-bold text-2xl">{count ?? "—"}</div>
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Poslední sync</div>
            <div className="font-mono text-sm">
              {lastFetched ? new Date(lastFetched).toLocaleString("cs-CZ") : "Nikdy"}
            </div>
          </div>
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">
              Automatická synchronizace běží denně v 04:00 UTC. Můžeš ji spustit i ručně.
            </p>
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
