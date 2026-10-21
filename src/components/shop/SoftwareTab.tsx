import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Clock, Download, HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ShopItem } from "@/hooks/useShop";
import { downloadShopFile, formatBytes, formatDuration, formatRemaining } from "@/lib/shopFiles";

type MyDownload = { item_id: string; expires_at: string; active: boolean };

/** Předplatné: časově omezený přístup ke stažení přiloženého souboru (Setup / instalátor). */
export function SoftwareTab({ items, onBuy }: { items: ShopItem[]; onBuy: (item: ShopItem) => void }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<Record<string, MyDownload>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    if (!user) {
      setMine({});
      return;
    }
    const { data } = await supabase.rpc("shop_my_downloads");
    const map: Record<string, MyDownload> = {};
    for (const d of (data ?? []) as MyDownload[]) map[d.item_id] = d;
    setMine(map);
  }, [user]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => setTick((x) => x + 1), 30_000);
    return () => window.clearInterval(t);
  }, [load]);

  const download = async (item: ShopItem) => {
    setProgress((p) => ({ ...p, [item.id]: 0 }));
    try {
      await downloadShopFile(item, (k) => setProgress((p) => ({ ...p, [item.id]: k })));
      toast.success("Stahování dokončeno.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Stažení se nezdařilo.");
      void load();
    } finally {
      setProgress((p) => {
        const next = { ...p };
        delete next[item.id];
        return next;
      });
    }
  };

  if (items.length === 0) return <p className="text-muted-foreground">Zatím tu není žádné předplatné.</p>;

  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {items.map((item) => {
        const own = mine[item.id];
        const active = own?.active && new Date(own.expires_at).getTime() > Date.now();
        const busy = item.id in progress;
        return (
          <Card key={item.id} className="glass border-border p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-lg">{item.title}</h3>
                {item.file_version && <p className="text-xs text-muted-foreground">verze {item.file_version}</p>}
                {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
              </div>
              <Badge variant="secondary">{item.price_czk} Kč</Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Předplatné na {formatDuration(item.access_minutes)}</span>
              {item.file_size ? <span className="flex items-center gap-1.5"><HardDrive className="h-4 w-4" /> {formatBytes(item.file_size)}</span> : null}
            </div>
            {item.features?.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {item.features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-auto pt-6 space-y-2">
              {active ? (
                <>
                  <Button className="w-full" disabled={busy || !item.file_parts?.length} onClick={() => download(item)}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    {busy ? `Stahuji… ${Math.round((progress[item.id] ?? 0) * 100)} %` : `Stáhnout ${item.file_name ?? ""}`}
                  </Button>
                  {busy && <Progress value={(progress[item.id] ?? 0) * 100} />}
                  <p className="text-xs text-muted-foreground text-center">
                    Předplatné aktivní – vyprší za {formatRemaining(own.expires_at)} ({new Date(own.expires_at).toLocaleString("cs-CZ")})
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => onBuy(item)}>Prodloužit předplatné</Button>
                </>
              ) : (
                <>
                  <Button className="w-full" onClick={() => onBuy(item)}>Předplatit</Button>
                  {own && !own.active && <p className="text-xs text-muted-foreground text-center">Tvoje předplatné vypršelo {new Date(own.expires_at).toLocaleString("cs-CZ")}.</p>}
                  <p className="text-xs text-muted-foreground text-center">Po ověření platby se předplatné aktivuje a objeví se tu tlačítko ke stažení.</p>
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
