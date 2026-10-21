import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Check, Download, HardDrive, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ShopItem } from "@/hooks/useShop";
import { downloadShopFile, formatBytes, formatRemaining } from "@/lib/shopFiles";

export type Period = "month" | "year";

/** Zvolený tarif při nákupu předplatného (nebo zaplacení připravené platby za obnovení). */
export type BuyPlan = { period: Period; autoRenew: boolean; renewalId?: string | null; amount?: number | null };

type MyDownload = {
  item_id: string;
  expires_at: string;
  active: boolean;
  period: Period | null;
  auto_renew: boolean;
  pending_purchase: string | null;
  pending_amount: number | null;
  pending_period: Period | null;
};

export const planPrice = (item: ShopItem, period: Period) =>
  period === "year" && item.price_year_czk ? item.price_year_czk : item.price_czk;

/** Data pro platební dialog u předplatného. */
export function subscriptionCheckout(item: ShopItem, plan: BuyPlan) {
  const label = plan.period === "year" ? "roční" : "měsíční";
  return {
    title: plan.renewalId ? `${item.title} – obnovení (${label})` : `${item.title} – ${label} předplatné`,
    amount: plan.amount ?? planPrice(item, plan.period),
    note: `${item.title} ${label}`,
    kind: "software" as const,
    itemId: item.id,
    cosmeticId: null,
    period: plan.period,
    autoRenew: plan.autoRenew,
    renewalId: plan.renewalId ?? null,
  };
}

/** Předplatné: měsíční nebo roční tarif, automatické obnovení a stažení přiloženého souboru. */
export function SoftwareTab({ items, onBuy }: { items: ShopItem[]; onBuy: (item: ShopItem, plan: BuyPlan) => void }) {
  const { user } = useAuth();
  const [mine, setMine] = useState<Record<string, MyDownload>>({});
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [choice, setChoice] = useState<Record<string, Period>>({});
  const [renew, setRenew] = useState<Record<string, boolean>>({});
  const [toggling, setToggling] = useState<string | null>(null);
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

  const setAutoRenew = async (item: ShopItem, on: boolean, period: Period) => {
    setToggling(item.id);
    const { error } = await supabase.rpc("shop_set_auto_renew", { p_item: item.id, p_on: on, p_period: period });
    setToggling(null);
    if (error) {
      toast.error("Nastavení se nepodařilo uložit.");
      return;
    }
    toast.success(on ? "Automatické obnovení zapnuto." : "Automatické obnovení vypnuto.");
    void load();
  };

  if (items.length === 0) return <p className="text-muted-foreground">Zatím tu není žádné předplatné.</p>;

  return (
    <div className="grid sm:grid-cols-2 gap-5">
      {items.map((item) => {
        const own = mine[item.id];
        const active = own?.active && new Date(own.expires_at).getTime() > Date.now();
        const busy = item.id in progress;
        const hasYear = !!item.price_year_czk;
        const period: Period = hasYear ? choice[item.id] ?? own?.period ?? "month" : "month";
        const autoRenew = renew[item.id] ?? own?.auto_renew ?? true;
        const yearSaving = hasYear ? Math.max(0, Math.round(100 - (item.price_year_czk! / (item.price_czk * 12)) * 100)) : 0;
        return (
          <Card key={item.id} className="glass border-border p-6 flex flex-col">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-lg">{item.title}</h3>
                {item.file_version && <p className="text-xs text-muted-foreground">verze {item.file_version}</p>}
                {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
              </div>
              <Badge variant="secondary">od {item.price_czk} Kč / měs.</Badge>
            </div>

            <div className={`mt-4 grid gap-2 ${hasYear ? "grid-cols-2" : "grid-cols-1"}`}>
              {(hasYear ? (["month", "year"] as Period[]) : (["month"] as Period[])).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setChoice((c) => ({ ...c, [item.id]: p }))}
                  className={`border p-3 text-left transition-colors ${
                    period === p ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="block text-xs uppercase tracking-wide text-muted-foreground">
                    {p === "year" ? "Roční" : "Měsíční"}
                  </span>
                  <span className="block font-bold text-lg">
                    {planPrice(item, p)} Kč
                    <span className="text-xs font-normal text-muted-foreground"> / {p === "year" ? "rok" : "měsíc"}</span>
                  </span>
                  {p === "year" && yearSaving > 0 && (
                    <span className="block text-xs text-primary">ušetříš {yearSaving} %</span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
              {item.file_size ? <span className="flex items-center gap-1.5"><HardDrive className="h-4 w-4" /> {formatBytes(item.file_size)}</span> : null}
            </div>
            {item.features?.length > 0 && (
              <ul className="mt-3 space-y-1.5 text-sm">
                {item.features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto pt-6 space-y-2">
              {own?.pending_purchase && (
                <div className="border border-primary/40 bg-primary/5 p-3 space-y-2">
                  <p className="text-sm">
                    Připravená platba za obnovení: <b>{own.pending_amount} Kč</b> ({own.pending_period === "year" ? "rok" : "měsíc"})
                  </p>
                  <Button
                    className="w-full"
                    onClick={() =>
                      onBuy(item, {
                        period: own.pending_period ?? "month",
                        autoRenew: true,
                        renewalId: own.pending_purchase,
                        amount: own.pending_amount,
                      })
                    }
                  >
                    <RefreshCw className="h-4 w-4 mr-2" /> Zaplatit obnovení
                  </Button>
                </div>
              )}

              {active ? (
                <>
                  <Button className="w-full" disabled={busy || !item.file_parts?.length} onClick={() => download(item)}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    {busy ? `Stahuji… ${Math.round((progress[item.id] ?? 0) * 100)} %` : `Stáhnout ${item.file_name ?? ""}`}
                  </Button>
                  {busy && <Progress value={(progress[item.id] ?? 0) * 100} />}
                  <p className="text-xs text-muted-foreground text-center">
                    {own.period === "year" ? "Roční" : "Měsíční"} předplatné aktivní – vyprší za {formatRemaining(own.expires_at)} (
                    {new Date(own.expires_at).toLocaleString("cs-CZ")})
                  </p>
                  <label className="flex items-center justify-between gap-3 border border-border p-3 text-sm">
                    <span>
                      Automatické obnovení
                      <span className="block text-xs text-muted-foreground">
                        {own.auto_renew
                          ? `3 dny před koncem připravíme platbu za další ${period === "year" ? "rok" : "měsíc"}.`
                          : "Vypnuto – předplatné po skončení nebude pokračovat."}
                      </span>
                    </span>
                    <Switch
                      checked={own.auto_renew}
                      disabled={toggling === item.id}
                      onCheckedChange={(v) => void setAutoRenew(item, v, period)}
                    />
                  </label>
                  {own.auto_renew && hasYear && own.period !== period && (
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => void setAutoRenew(item, true, period)}>
                      Další období obnovovat jako {period === "year" ? "roční" : "měsíční"}
                    </Button>
                  )}
                  {!own.pending_purchase && (
                    <Button variant="outline" className="w-full" onClick={() => onBuy(item, { period, autoRenew: own.auto_renew })}>
                      Prodloužit hned ({planPrice(item, period)} Kč)
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <label className="flex items-center justify-between gap-3 border border-border p-3 text-sm">
                    <span>
                      Automaticky obnovovat
                      <span className="block text-xs text-muted-foreground">Před koncem ti připravíme platbu a upozorníme tě.</span>
                    </span>
                    <Switch checked={autoRenew} onCheckedChange={(v) => setRenew((r) => ({ ...r, [item.id]: v }))} />
                  </label>
                  {!own?.pending_purchase && (
                    <Button className="w-full" onClick={() => onBuy(item, { period, autoRenew })}>
                      Předplatit {period === "year" ? "na rok" : "na měsíc"} – {planPrice(item, period)} Kč
                    </Button>
                  )}
                  {own && !own.active && (
                    <p className="text-xs text-muted-foreground text-center">
                      Tvoje předplatné vypršelo {new Date(own.expires_at).toLocaleString("cs-CZ")}.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground text-center">
                    Po ověření platby se předplatné aktivuje a objeví se tu tlačítko ke stažení.
                  </p>
                </>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
