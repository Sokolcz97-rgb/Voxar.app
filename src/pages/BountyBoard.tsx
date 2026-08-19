import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCosmetics } from "@/contexts/CosmeticsContext";
import { useCosmeticStyles } from "@/hooks/useCosmeticStyles";
import { COSMETICS } from "@/lib/cosmetics";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  Target, Loader2, ShieldCheck, Plus, CheckCircle2, Trash2, Users, Gift, Lock,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

interface Bounty {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  reward_label: string;
  reward_cosmetic_id: string | null;
  slots: number;
  status: string;
  created_at: string;
}

interface Contract {
  id: string;
  bounty_id: string;
  user_id: string;
  status: string;
  accepted_at: string;
  profile?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

const DIFFICULTY: Record<string, { label: string; cls: string }> = {
  trivial: { label: "Trivial", cls: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10" },
  standard: { label: "Standard", cls: "text-primary border-primary/40 bg-primary/10" },
  elite: { label: "Elite", cls: "text-amber-400 border-amber-400/40 bg-amber-400/10" },
  legendary: { label: "Legendary", cls: "text-fuchsia-400 border-fuchsia-400/40 bg-fuchsia-400/10" },
};

const BountyBoard = () => {
  const { user, isAdmin } = useAuth();
  const { refreshMine } = useCosmetics();
  const { styles } = useCosmeticStyles();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", description: "", difficulty: "standard",
    reward_label: "Digitální odměna", reward_cosmetic_id: "none", slots: "0",
  });
  const [creating, setCreating] = useState(false);

  const rewardOptions = useMemo(
    () => [
      ...COSMETICS.map((c) => ({ id: c.id, name: c.name })),
      ...styles.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name })),
    ],
    [styles],
  );

  const load = useCallback(async () => {
    const [{ data: b }, { data: c }] = await Promise.all([
      supabase.from("bounties").select("*").order("created_at", { ascending: false }),
      supabase.from("bounty_contracts").select("*").order("accepted_at", { ascending: false }),
    ]);
    const rows = (c ?? []) as Contract[];
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", ids);
      const byId = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      rows.forEach((r) => { r.profile = byId.get(r.user_id) ?? null; });
    }
    setBounties((b ?? []) as Bounty[]);
    setContracts(rows);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const accept = async (bounty: Bounty) => {
    if (!user) { toast({ title: "Přihlas se pro přijetí kontraktu", variant: "destructive" }); return; }
    setBusy(bounty.id);
    const { error } = await supabase
      .from("bounty_contracts")
      .insert({ bounty_id: bounty.id, user_id: user.id, status: "accepted" });
    setBusy(null);
    if (error) { toast({ title: "Kontrakt se nepodařilo přijmout", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Kontrakt přijat", description: bounty.title });
    void load();
  };

  const abandon = async (contractId: string) => {
    setBusy(contractId);
    await supabase.from("bounty_contracts").delete().eq("id", contractId);
    setBusy(null);
    void load();
  };

  const complete = async (contractId: string) => {
    setBusy(contractId);
    const { error } = await supabase.rpc("bounty_complete", { _contract_id: contractId });
    setBusy(null);
    if (error) { toast({ title: "Chyba", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Kontrakt splněn", description: "Odměna byla přidána do inventáře." });
    await refreshMine();
    void load();
  };

  const createBounty = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    const { error } = await supabase.from("bounties").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      difficulty: form.difficulty,
      reward_label: form.reward_label.trim() || "Digitální odměna",
      reward_cosmetic_id: form.reward_cosmetic_id === "none" ? null : form.reward_cosmetic_id,
      slots: Number(form.slots) || 0,
      created_by: user?.id ?? null,
    });
    setCreating(false);
    if (error) { toast({ title: "Chyba", description: error.message, variant: "destructive" }); return; }
    setForm({ title: "", description: "", difficulty: "standard", reward_label: "Digitální odměna", reward_cosmetic_id: "none", slots: "0" });
    toast({ title: "Kontrakt vypsán" });
    void load();
  };

  const removeBounty = async (id: string) => {
    await supabase.from("bounties").delete().eq("id", id);
    void load();
  };

  const toggleStatus = async (b: Bounty) => {
    await supabase.from("bounties").update({ status: b.status === "open" ? "closed" : "open" }).eq("id", b.id);
    void load();
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <SEO
        title="Bounty Board — kontrakty komunity | StudioVoxario"
        description="Přijmi komunitní kontrakty, splň úkoly a získej digitální odměny do svého inventáře."
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-40" />
      <Navbar />

      <main className="container pt-8 pb-24">
        <div className="web-alert p-4 mb-8">
          <p className="text-[10px] uppercase tracking-[0.32em] text-primary">System // contract registry</p>
          <h1 className="font-display font-black text-3xl md:text-4xl mt-1">
            <span className="web-title-metal">Bounty Board</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Vypsané komunitní kontrakty. Přijmi zakázku, splň ji a po schválení operátorem se odměna
            automaticky zapíše do tvého inventáře.
          </p>
        </div>

        {isAdmin && (
          <div className="web-panel web-panel-accent p-5 mb-8">
            <h2 className="font-display font-bold flex items-center gap-2 mb-4">
              <ShieldCheck className="h-4 w-4 text-primary" /> Vypsat nový kontrakt
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Název</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nahlas chybu na webu" />
              </div>
              <div>
                <Label>Popis odměny</Label>
                <Input value={form.reward_label} onChange={(e) => setForm({ ...form, reward_label: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <Label>Zadání</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
              </div>
              <div>
                <Label>Obtížnost</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIFFICULTY).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rámeček jako odměna</Label>
                <Select value={form.reward_cosmetic_id} onValueChange={(v) => setForm({ ...form, reward_cosmetic_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Bez rámečku</SelectItem>
                    {rewardOptions.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Limit míst (0 = neomezeno)</Label>
                <Input type="number" min={0} value={form.slots} onChange={(e) => setForm({ ...form, slots: e.target.value })} />
              </div>
            </div>
            <Button onClick={createBounty} disabled={creating || !form.title.trim()} className="web-btn web-btn-primary mt-4">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Vypsat kontrakt
            </Button>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : bounties.length === 0 ? (
          <div className="web-panel p-10 text-center">
            <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Momentálně nejsou vypsané žádné kontrakty.</p>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-5">
            {bounties.map((b) => {
              const mine = contracts.find((c) => c.bounty_id === b.id && c.user_id === user?.id);
              const list = contracts.filter((c) => c.bounty_id === b.id);
              const full = b.slots > 0 && list.length >= b.slots && !mine;
              const diff = DIFFICULTY[b.difficulty] ?? DIFFICULTY.standard;
              return (
                <article key={b.id} className="web-panel web-stat p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={cn("uppercase text-[10px] tracking-widest", diff.cls)}>
                          {diff.label}
                        </Badge>
                        {b.status !== "open" && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            <Lock className="h-3 w-3 mr-1" /> Uzavřeno
                          </Badge>
                        )}
                        {mine && (
                          <Badge className="bg-primary/20 text-primary text-[10px] uppercase tracking-widest">
                            {mine.status === "completed" ? "Splněno" : "Přijato"}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-display font-black text-lg mt-2 truncate">{b.title}</h3>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => toggleStatus(b)} title="Otevřít/uzavřít">
                          <Lock className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => removeBounty(b.id)} title="Smazat">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {b.description && (
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{b.description}</p>
                  )}

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <Gift className="h-3.5 w-3.5" /> {b.reward_label}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {list.length}{b.slots > 0 ? ` / ${b.slots}` : ""}
                    </span>
                  </div>

                  {list.length > 0 && (
                    <ul className="mt-4 space-y-2 border-t border-primary/15 pt-3">
                      {list.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 text-xs">
                          <UserAvatar
                            url={c.profile?.avatar_url}
                            name={c.profile?.display_name || c.profile?.username}
                            userId={c.user_id}
                            className="h-6 w-6"
                          />
                          <span className="truncate">{c.profile?.display_name || c.profile?.username || "Hráč"}</span>
                          <span className={cn(
                            "ml-auto uppercase tracking-widest text-[10px]",
                            c.status === "completed" ? "text-emerald-400" : "text-muted-foreground",
                          )}>
                            {c.status === "completed" ? "Splněno" : "Aktivní"}
                          </span>
                          {isAdmin && c.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              disabled={busy === c.id}
                              onClick={() => complete(c.id)}
                            >
                              {busy === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-auto pt-4">
                    {mine ? (
                      mine.status === "completed" ? (
                        <Button disabled className="web-btn w-full">Kontrakt uzavřen</Button>
                      ) : (
                        <Button variant="outline" className="web-btn w-full" disabled={busy === mine.id} onClick={() => abandon(mine.id)}>
                          Vzdát se kontraktu
                        </Button>
                      )
                    ) : (
                      <Button
                        className="web-btn web-btn-primary w-full"
                        disabled={busy === b.id || b.status !== "open" || full}
                        onClick={() => accept(b)}
                      >
                        {busy === b.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Target className="h-4 w-4 mr-2" />}
                        {full ? "Obsazeno" : b.status !== "open" ? "Uzavřeno" : "Přijmout kontrakt"}
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default BountyBoard;
