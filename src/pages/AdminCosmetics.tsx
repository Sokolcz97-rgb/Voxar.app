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
import { toast } from "@/hooks/use-toast";
import { Loader2, Minus, Plus, Sparkles } from "lucide-react";

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

  const adjust = async (userId: string, cosmeticId: string, delta: number) => {
    const current = inv[userId]?.[cosmeticId] ?? 0;
    const next = Math.max(0, current + delta);
    if (next === current) return;
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
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return profiles;
    return profiles.filter((p) =>
      `${p.display_name ?? ""} ${p.username ?? ""}`.toLowerCase().includes(s),
    );
  }, [profiles, q]);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 max-w-4xl animate-fade-in">
        <PageHero
          eyebrow="Administrace"
          title="Kosmetika"
          description="Přidávej nebo odebírej uživatelům kosmetické rámečky avatarů."
          icon={Sparkles}
        />

        <Card className="glass border-border p-6">
          <Input
            placeholder="Hledat uživatele…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-5 max-w-sm"
          />

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((p) => {
                const name = p.display_name || p.username || "Uživatel";
                return (
                  <li key={p.user_id} className="py-3 flex items-center gap-3 flex-wrap">
                    <UserAvatar url={p.avatar_url} name={name} userId={p.user_id} className="h-9 w-9" />
                    <span className="font-medium flex-1 min-w-[140px] truncate">{name}</span>
                    <div className="flex items-center gap-4 flex-wrap">
                      {COSMETICS.map((c) => {
                        const qty = inv[p.user_id]?.[c.id] ?? 0;
                        const key = `${p.user_id}:${c.id}`;
                        return (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{c.name}</span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              disabled={busy === key || qty === 0}
                              onClick={() => adjust(p.user_id, c.id, -1)}
                              aria-label="Odebrat"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Badge variant={qty > 0 ? "default" : "secondary"} className="min-w-8 justify-center">
                              {qty}
                            </Badge>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              disabled={busy === key}
                              onClick={() => adjust(p.user_id, c.id, 1)}
                              aria-label="Přidat"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AdminCosmetics;
