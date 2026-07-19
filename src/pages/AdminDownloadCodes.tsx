import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Copy, Trash2, RefreshCw, KeyRound, Wand2 } from "lucide-react";

type Code = {
  id: string;
  code: string;
  label: string | null;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  active: boolean;
  created_at: string;
};

function generateCode(len = 12) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => alphabet[n % alphabet.length]).join("");
}

export default function AdminDownloadCodes() {
  const { toast } = useToast();
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCode, setNewCode] = useState(generateCode());
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("download_access_codes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    setCodes((data as Code[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!newCode.trim()) return;
    const payload: any = {
      code: newCode.trim(),
      label: label.trim() || null,
      max_uses: maxUses ? Number(maxUses) : null,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    };
    const { error } = await supabase.from("download_access_codes").insert(payload);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Kód vytvořen", description: newCode });
    setNewCode(generateCode());
    setLabel("");
    setMaxUses("");
    setExpiresAt("");
    load();
  };

  const toggle = async (c: Code) => {
    await supabase.from("download_access_codes").update({ active: !c.active }).eq("id", c.id);
    load();
  };

  const remove = async (c: Code) => {
    if (!confirm(`Smazat kód ${c.code}?`)) return;
    await supabase.from("download_access_codes").delete().eq("id", c.id);
    load();
  };

  const copy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Zkopírováno", description: code });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Přístupové kódy ke stažení</h1>
            <p className="text-sm text-muted-foreground">
              Generujte kódy, které odemknou stránku <code>/desktop</code>.
            </p>
          </div>
        </div>

        <Card className="p-5 mb-6 space-y-4">
          <h2 className="font-semibold">Vytvořit nový kód</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Kód / heslo</Label>
              <div className="flex gap-2 mt-1">
                <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                <Button type="button" variant="outline" size="icon" onClick={() => setNewCode(generateCode())}>
                  <Wand2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Popisek (např. „promo pro streamery")</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Max. počet použití (prázdné = neomezeno)</Label>
              <Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Platnost do (prázdné = trvale)</Label>
              <Input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="mt-1" />
            </div>
          </div>
          <Button onClick={create}>Vytvořit kód</Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Existující kódy</h2>
            <Button variant="ghost" size="sm" onClick={load}>
              <RefreshCw className="w-4 h-4 mr-2" /> Obnovit
            </Button>
          </div>
          {loading ? (
            <p className="text-sm text-muted-foreground">Načítám…</p>
          ) : codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím žádný kód.</p>
          ) : (
            <div className="space-y-2">
              {codes.map((c) => {
                const expired = c.expires_at && new Date(c.expires_at) < new Date();
                const exhausted = c.max_uses != null && c.uses >= c.max_uses;
                const usable = c.active && !expired && !exhausted;
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                    <code className="font-mono text-sm bg-muted px-2 py-1 rounded">{c.code}</code>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{c.label || <span className="text-muted-foreground">—</span>}</div>
                      <div className="text-xs text-muted-foreground">
                        Použití: {c.uses}{c.max_uses ? ` / ${c.max_uses}` : ""} ·{" "}
                        {c.expires_at ? `platí do ${new Date(c.expires_at).toLocaleString("cs-CZ")}` : "bez expirace"}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${usable ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                      {usable ? "aktivní" : expired ? "expirovaný" : exhausted ? "vyčerpaný" : "vypnutý"}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => copy(c.code)} title="Kopírovat">
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggle(c)}>
                      {c.active ? "Vypnout" : "Zapnout"}
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(c)} title="Smazat">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
