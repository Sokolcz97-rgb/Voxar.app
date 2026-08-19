import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { PageHero } from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { COSMETICS } from "@/lib/cosmetics";
import { useCosmeticStyles } from "@/hooks/useCosmeticStyles";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgeUploader } from "@/components/admin/BadgeUploader";
import { useSearchParams } from "react-router-dom";

type Profile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type Inv = Record<string, Record<string, number>>; // userId -> cosmeticId -> qty

const AdminCosmetics = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [inv, setInv] = useState<Inv>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>(COSMETICS[0]?.id ?? "");
  const [onlyOwners, setOnlyOwners] = useState(false);
  const { styles } = useCosmeticStyles();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "badges" ? "badges" : "assign";

  /** Vestavěné styly + badge nahrané v administraci */
  const allStyles = useMemo(
    () => [
      ...COSMETICS.map((c) => ({ id: c.id, name: c.name, description: c.description })),
      ...styles
        .filter((s) => s.active)
        .map((s) => ({ id: s.id, name: s.name, description: s.description ?? "" })),
    ],
    [styles],
  );

  const load = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("user_id,display_name,username,avatar_url").order("display_name"),
      supabase.from("user_cosmetics").select("user_id,cosmetic_id,quantity"),
    ]);
    setProfiles((p as Profile[]) ?? []);
    const map: Inv = {};
    (c ?? []).forEach((r: { user_id: string; cosmetic_id: string; quantity: number }) => {
      map[r.user_id] = { ...(map[r.user_id] ?? {}), [r.cosmetic_id]: r.quantity };
    });
    setInv(map);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  /** Binární přepnutí vlastnictví: 1 = má, 0 = nemá */
  const setOwnership = async (userId: string, cosmeticId: string, owned: boolean) => {
    const next = owned ? 1 : 0;
    setBusy(`${userId}:${cosmeticId}`);
    const { error } = await supabase
      .from("user_cosmetics")
      .upsert(
        { user_id: userId, cosmetic_id: cosmeticId, quantity: next, ...(next === 0 ? { equipped: false } : {}) },
        { onConflict: "user_id,cosmetic_id" },
      );
    setBusy(null);
    if (error) {
      toast({ title: "Nepodařilo se uložit", description: error.message, variant: "destructive" });
      return;
    }
    setInv((prev) => ({ ...prev, [userId]: { ...(prev[userId] ?? {}), [cosmeticId]: next } }));
    toast({ title: owned ? "Rámeček přidělen" : "Rámeček odebrán" });
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let list = profiles;
    if (s) {
      list = list.filter((p) =>
        `${p.display_name ?? ""} ${p.username ?? ""}`.toLowerCase().includes(s),
      );
    }
    if (onlyOwners) list = list.filter((p) => (inv[p.user_id]?.[selected] ?? 0) > 0);
    return list;
  }, [profiles, q, onlyOwners, inv, selected]);

  const ownersCount = useMemo(
    () => profiles.filter((p) => (inv[p.user_id]?.[selected] ?? 0) > 0).length,
    [profiles, inv, selected],
  );

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 max-w-4xl animate-fade-in">
        <PageHero
          eyebrow="Administrace"
          title="Kosmetika"
          description="Nahraj nové badge s automatickým odstraněním pozadí a přiděluj rámečky uživatelům."
          icon={Sparkles}
        />

        <Tabs
          value={tab}
          onValueChange={(v) => setParams(v === "badges" ? { tab: "badges" } : {}, { replace: true })}
        >
          <TabsList className="mb-6">
            <TabsTrigger value="assign">Přidělování</TabsTrigger>
            <TabsTrigger value="badges">Nahrát badge</TabsTrigger>
          </TabsList>

          <TabsContent value="badges">
            <BadgeUploader />
          </TabsContent>

          <TabsContent value="assign">
        {/* Náhledy hexagon stylů */}
        <Card className="glass border-border p-6 mb-6">
          <h3 className="font-display text-sm tracking-[0.2em] uppercase text-primary mb-4">
            Styly rámečků
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allStyles.map((c) => {
              const active = selected === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className={cn(
                    "text-left p-4 border transition-colors bg-card/40",
                    active
                      ? "border-yellow-400/70 bg-yellow-500/5"
                      : "border-border/60 hover:border-primary/60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar name="VX" cosmeticId={c.id} className="h-12 w-12" />
                    <div className="min-w-0">
                      <div className="font-display text-xs tracking-[0.18em] uppercase truncate">
                        {c.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {active ? "Vybráno" : "Kliknutím vybrat"}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 line-clamp-3">{c.description}</p>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="glass border-border p-6">
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <Input
              placeholder="Hledat uživatele…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-sm"
            />
            <Button
              variant={onlyOwners ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyOwners((v) => !v)}
            >
              Jen vlastníci ({ownersCount})
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">Žádní uživatelé.</p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => {
                const name = p.display_name || p.username || "Uživatel";
                const owned = (inv[p.user_id]?.[selected] ?? 0) > 0;
                const key = `${p.user_id}:${selected}`;
                return (
                  <li key={p.user_id} className="py-3 flex items-center gap-3 flex-wrap">
                    <UserAvatar
                      url={p.avatar_url}
                      name={name}
                      cosmeticId={owned ? selected : null}
                      className="h-9 w-9"
                    />
                    <span className="font-medium flex-1 min-w-[140px] truncate">{name}</span>
                    <Badge variant={owned ? "default" : "secondary"} className="min-w-8 justify-center">
                      {owned ? 1 : 0}
                    </Badge>
                    <Button
                      size="sm"
                      variant={owned ? "outline" : "default"}
                      disabled={busy === key}
                      onClick={() => setOwnership(p.user_id, selected, !owned)}
                    >
                      {busy === key ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : owned ? (
                        <X className="h-3.5 w-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      {owned ? "Vzít" : "Dát"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminCosmetics;
