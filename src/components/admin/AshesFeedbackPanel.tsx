import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bug, Check, Lightbulb, MessageSquare, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: number;
  character_name: string | null;
  kind: string;
  text: string;
  context: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
};

const KIND = {
  bug: { label: "Chyba", icon: Bug },
  idea: { label: "Nápad", icon: Lightbulb },
  other: { label: "Jiné", icon: MessageSquare },
} as const;

/** Hlášení z Ashes of Eryon (klávesa F1 ve hře) – pro uzavřený test. */
export function AshesFeedbackPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("ashes_feedback").select("*").order("created_at", { ascending: false }).limit(100);
    if (!showDone) q = q.eq("resolved", false);
    const { data, error } = await q;
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Row[]);
  }, [showDone]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (id: number) => {
    const { error } = await supabase.from("ashes_feedback").update({ resolved: true }).eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => (showDone ? r.map((x) => (x.id === id ? { ...x, resolved: true } : x)) : r.filter((x) => x.id !== id)));
  };

  return (
    <Card className="glass border-border p-5 mb-8">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h2 className="font-display font-bold text-xl">Ashes of Eryon – hlášení z testu (F1)</h2>
        <Badge variant="secondary">{rows.length}</Badge>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Jen nevyřešená" : "Zobrazit i vyřešená"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Načítám…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Žádná hlášení. Hráči je posílají ve hře klávesou F1.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const k = KIND[r.kind as keyof typeof KIND] ?? KIND.other;
            const ctx = r.context ?? {};
            const meta = ["version", "region", "level", "faction", "gpu", "fps"]
              .filter((key) => ctx[key] !== undefined && ctx[key] !== "")
              .map((key) => `${key}: ${String(ctx[key])}`)
              .join(" · ");
            return (
              <div key={r.id} className={`border border-border p-3 ${r.resolved ? "opacity-50" : ""}`}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <k.icon className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{k.label}</span>
                  <span className="text-muted-foreground">· {r.character_name ?? "bez postavy"} · {new Date(r.created_at).toLocaleString("cs-CZ")}</span>
                  {!r.resolved && (
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void resolve(r.id)}>
                      <Check className="h-4 w-4 mr-1" /> Vyřešeno
                    </Button>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm">{r.text}</p>
                {meta && <p className="mt-2 text-xs text-muted-foreground break-all">{meta}{ctx.x !== undefined ? ` · poloha ${String(ctx.x)}, ${String(ctx.z)}` : ""}</p>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
