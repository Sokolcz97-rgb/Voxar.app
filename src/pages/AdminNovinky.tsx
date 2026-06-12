import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RefreshCw, Database, Flame, Tag } from "lucide-react";
import { toast } from "sonner";

const SORT_OPTIONS = [
  { value: "DealRating", label: "Deal Rating (doporučeno)" },
  { value: "Savings", label: "Největší slevy" },
  { value: "Price", label: "Nejnižší cena" },
  { value: "Recent", label: "Nejnovější dealy" },
  { value: "Release", label: "Datum vydání" },
  { value: "Reviews", label: "Nejlepší hodnocení" },
];

const AdminNovinky = () => {
  const [count, setCount] = useState<number | null>(null);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pages, setPages] = useState(3);
  const [sortBy, setSortBy] = useState("DealRating");
  const [onSaleOnly, setOnSaleOnly] = useState(true);

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
    const t = toast.loading("Tahám dealy z CheapShark…");
    try {
      const { data, error } = await supabase.functions.invoke("sync-cheapshark-releases", {
        body: {
          pages,
          sort_by: sortBy,
          on_sale_only: onSaleOnly,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Synchronizováno: ${data?.synced ?? 0} her (${data?.considered ?? 0} dealů)`,
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
      <Navbar />
      <main className="container py-10 animate-fade-in max-w-3xl">
        <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Administrace</p>
        <h1 className="font-display font-black text-4xl mt-2 mb-2">Novinky · CheapShark sync</h1>
        <p className="text-sm text-muted-foreground mb-8">
          Zdrojem je <a href="https://apidocs.cheapshark.com" target="_blank" rel="noreferrer" className="text-primary hover:underline">CheapShark API</a> —
          dealy a slevy napříč Steam, GOG, Epic, Humble, Fanatical a desítkami dalších obchodů. Bez API klíče.
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

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Řazení dealů
              </Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Počet stránek (60 dealů na stránku, max 10)
              </Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={pages}
                onChange={(e) => setPages(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              />
            </div>

            <label className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-primary/5 cursor-pointer transition-colors">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <span className="text-sm">Pouze hry aktuálně ve slevě</span>
              </div>
              <Switch checked={onSaleOnly} onCheckedChange={setOnSaleOnly} />
            </label>
          </div>

          <div className="pt-4 border-t border-border space-y-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-md bg-primary/5 border border-primary/20">
              <Flame className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Sync přepíše existující katalog. Hry napříč obchody se sloučí — pro každou se uloží
                nejlepší deal a seznam všech obchodů, kde je dostupná.
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
