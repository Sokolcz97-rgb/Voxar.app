import { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ShopItem } from "@/hooks/useShop";

type Holder = {
  user_id: string;
  email: string | null;
  name: string | null;
  purchased_at: string;
  updates_until: string;
  revoked_at: string | null;
  granted: boolean;
  note: string | null;
};
type Found = { user_id: string; email: string; name: string };

const fmt = (d: string) => new Date(d).toLocaleDateString("cs-CZ");

/** Správce: přidělit / prodloužit / odebrat licenci (např. sobě, testerům, jako dárek). */
export function LicenseAdminDialog({ item, onClose }: { item: ShopItem | null; onClose: () => void }) {
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<Found | null>(null);
  const [days, setDays] = useState(365);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("shop_admin_licenses", { p_item: item.id });
    setLoading(false);
    if (error) toast.error(error.message);
    setHolders((data ?? []) as Holder[]);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    setQuery("");
    setFound([]);
    setPicked(null);
    setNote("");
    setDays(item.license_updates_days ?? 365);
    void load();
  }, [item, load]);

  const search = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    const { data, error } = await supabase.rpc("shop_admin_find_user", { p_query: query.trim() });
    setSearching(false);
    if (error) return toast.error(error.message);
    setFound((data ?? []) as Found[]);
    if (!data?.length) toast("Nikoho takového jsme nenašli.");
  };

  const grant = async (userId: string, d: number, label: string) => {
    if (!item) return;
    setBusy(userId);
    const { data, error } = await supabase.rpc("shop_admin_grant_license", {
      p_user: userId,
      p_item: item.id,
      p_days: d,
      p_note: note.trim() || null,
    });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`${label} – aktualizace do ${fmt(String(data))}.`);
    setPicked(null);
    setFound([]);
    setQuery("");
    void load();
  };

  const revoke = async (h: Holder) => {
    if (!item) return;
    setBusy(h.user_id);
    const { error } = await supabase.rpc("shop_admin_revoke_license", { p_user: h.user_id, p_item: item.id });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success("Licence odebrána.");
    void load();
  };

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" /> Licence – {item?.title}
          </DialogTitle>
          <DialogDescription>
            Přiděl licenci komukoli (sobě, testerům, jako dárek). Platí stejně jako koupená – v aplikaci i ke stažení.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border border-primary/30 p-3">
          <Label>Přidělit licenci</Label>
          <div className="flex gap-2">
            <Input
              value={query}
              placeholder="E-mail, uživatelské jméno nebo přezdívka"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void search()}
            />
            <Button variant="outline" onClick={() => void search()} disabled={searching || query.trim().length < 2}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {found.length > 0 && (
            <div className="space-y-1">
              {found.map((f) => (
                <button
                  key={f.user_id}
                  type="button"
                  onClick={() => setPicked(f)}
                  className={`w-full text-left border px-3 py-2 text-sm ${picked?.user_id === f.user_id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"}`}
                >
                  <span className="font-medium">{f.name}</span> <span className="text-muted-foreground">· {f.email}</span>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Aktualizace (dní)</Label>
              <Input type="number" min={0} value={days} onChange={(e) => setDays(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div className="space-y-1.5">
              <Label>Poznámka (nepovinné)</Label>
              <Input value={note} placeholder="např. tester, dárek" onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" disabled={!picked || busy !== null} onClick={() => picked && void grant(picked.user_id, days, "Licence přidělena")}>
            <Plus className="h-4 w-4 mr-1" /> {picked ? `Přidělit licenci: ${picked.name}` : "Vyber uživatele"}
          </Button>
        </div>

        <div className="space-y-2">
          <Label>Držitelé licence ({holders.filter((h) => !h.revoked_at).length})</Label>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : holders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Zatím nikdo.</p>
          ) : (
            holders.map((h) => {
              const active = new Date(h.updates_until).getTime() > Date.now();
              return (
                <div key={h.user_id} className={`border border-border p-3 text-sm flex flex-wrap items-center gap-3 ${h.revoked_at ? "opacity-50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {h.name ?? h.user_id.slice(0, 8)}{" "}
                      {h.granted ? <Badge variant="outline">přidělená</Badge> : <Badge variant="secondary">koupená</Badge>}
                      {h.revoked_at && <Badge variant="destructive" className="ml-1">odebraná</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {h.email} · od {fmt(h.purchased_at)} · aktualizace {active ? "do" : "skončily"} {fmt(h.updates_until)}
                      {h.note ? ` · ${h.note}` : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" disabled={busy === h.user_id} onClick={() => void grant(h.user_id, 365, h.revoked_at ? "Licence obnovena" : "Aktualizace prodlouženy")}>
                    {h.revoked_at ? "Obnovit" : "+ 1 rok"}
                  </Button>
                  {!h.revoked_at && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={busy === h.user_id} onClick={() => void revoke(h)} title="Odebrat licenci">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
