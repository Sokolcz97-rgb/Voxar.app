import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RefreshCw, Database } from "lucide-react";
import { toast } from "sonner";

type Platform = { id: number; label: string };

const PLATFORMS: Platform[] = [
  { id: 6, label: "PC (Steam, Epic, GOG, Ubisoft, EA)" },
  { id: 167, label: "PlayStation 5" },
  { id: 48, label: "PlayStation 4" },
  { id: 169, label: "Xbox Series X|S" },
  { id: 49, label: "Xbox One" },
  { id: 130, label: "Nintendo Switch" },
  { id: 508, label: "Nintendo Switch 2" },
  { id: 14, label: "Mac" },
  { id: 3, label: "Linux" },
  { id: 39, label: "iOS" },
  { id: 34, label: "Android" },
];

const DEFAULT_SELECTED = [6, 167, 48, 169, 49, 130, 508];

const AdminNovinky = () => {
  const [count, setCount] = useState<number | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<number[]>(DEFAULT_SELECTED);
  const [daysBack, setDaysBack] = useState("30");
  const [daysForward, setDaysForward] = useState("365");

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

  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const syncNow = async () => {
    if (selected.length === 0) {
      toast.error("Vyber alespoň jednu platformu");
      return;
    }
    setSyncing(true);
    const t = toast.loading("Synchronizuji s IGDB…");
    try {
      const { data, error } = await supabase.functions.invoke("sync-game-releases", {
        body: {
          platforms: selected,
          days_back: parseInt(daysBack, 10) || 30,
          days_forward: parseInt(daysForward, 10) || 365,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Synchronizováno: ${data?.synced ?? 0} her (${data?.release_dates ?? 0} vydání)`,
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
        <h1 className="font-display font-black text-4xl mt-2 mb-8">Novinky · IGDB sync</h1>

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
              Platformy k synchronizaci
            </Label>
            <div className="grid sm:grid-cols-2 gap-2">
              {PLATFORMS.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 p-2 rounded-md border border-border hover:bg-primary/5 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selected.includes(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              PC pokrývá Steam, Epic Games Store, Ubisoft Connect, EA App, GOG a další launchery — IGDB
              označí konkrétní obchody automaticky.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Dny zpět (nedávno vydané)
              </Label>
              <Input
                value={daysBack}
                onChange={(e) => setDaysBack(e.target.value.replace(/\D/g, ""))}
                placeholder="30"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Dny dopředu (nadcházející)
              </Label>
              <Input
                value={daysForward}
                onChange={(e) => setDaysForward(e.target.value.replace(/\D/g, ""))}
                placeholder="365"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-3">
              Automatický sync běží denně v 04:00 UTC s výchozím nastavením. Tady ho můžeš spustit ručně
              s vlastním rozsahem.
            </p>
            <Button onClick={syncNow} disabled={syncing} className="w-full">
              <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Synchronizuji…" : `Spustit sync teď (${selected.length} platforem)`}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default AdminNovinky;
