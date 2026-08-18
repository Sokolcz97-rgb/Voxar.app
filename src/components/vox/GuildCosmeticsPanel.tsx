import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCosmetics } from "@/contexts/CosmeticsContext";
import { getCosmetic } from "@/lib/cosmetics";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Loader2, Sparkles } from "lucide-react";

type Guild = { id: string; name: string; icon_url: string | null; cosmetic_id: string | null };

/** Nasazování kosmetických rámečků na servery (sektory) uvnitř aplikace. */
export function GuildCosmeticsPanel() {
  const { user } = useAuth();
  const { myItems, loadingMine } = useCosmetics();
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: memberships } = await supabase
      .from("vox_guild_members").select("guild_id").eq("user_id", user.id);
    const ids = (memberships ?? []).map((m: { guild_id: string }) => m.guild_id);
    if (!ids.length) { setGuilds([]); setLoading(false); return; }
    const { data } = await supabase
      .from("vox_guilds").select("id,name,icon_url,cosmetic_id").in("id", ids).order("created_at");
    setGuilds(((data ?? []) as unknown) as Guild[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const apply = async (guildId: string, cosmeticId: string | null) => {
    setBusy(guildId);
    const { error } = await supabase.rpc("vox_set_guild_cosmetic" as never, {
      _guild: guildId, _cosmetic: cosmeticId,
    } as never);
    setBusy(null);
    if (error) {
      toast({ title: "Nepodařilo se uložit", description: error.message, variant: "destructive" });
      return;
    }
    setGuilds((prev) => prev.map((g) => (g.id === guildId ? { ...g, cosmetic_id: cosmeticId } : g)));
    toast({ title: cosmeticId ? "Rámeček nahozen" : "Rámeček sundán" });
  };

  const owned = myItems.filter((i) => i.quantity > 0);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-sm tracking-[0.2em] uppercase text-primary text-glow flex items-center gap-2">
          <Sparkles className="h-4 w-4" /> Rámečky serverů
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Vlastněné rámečky můžeš nahodit na kterýkoliv sektor, kde jsi členem — nebo je kdykoliv vyměnit či sundat.
        </p>
      </div>

      {loadingMine || loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : owned.length === 0 ? (
        <p className="text-xs text-muted-foreground">Zatím nevlastníš žádné rámečky.</p>
      ) : guilds.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nejsi členem žádného sektoru.</p>
      ) : (
        <ul className="space-y-3">
          {guilds.map((g) => {
            const active = getCosmetic(g.cosmetic_id);
            return (
              <li key={g.id} className="border border-primary/20 bg-[hsl(222_42%_9%)]/70 p-4 hud-panel-chamfer">
                <div className="flex items-center gap-3">
                  <div className={cn("hex-ring w-12 h-12 shrink-0", g.cosmetic_id === "supporter_gold" && "cosmetic-hex-supporter")}>
                    <div className="hex-frame w-full h-full flex items-center justify-center overflow-hidden bg-secondary/80 text-primary/80 text-xs font-display font-bold">
                      {g.icon_url
                        ? <img src={g.icon_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        : g.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-xs tracking-[0.18em] uppercase truncate">{g.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {active ? `Nasazeno: ${active.name}` : "Bez rámečku"}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {owned.map((item) => {
                    const def = getCosmetic(item.cosmetic_id);
                    if (!def) return null;
                    const isOn = g.cosmetic_id === def.id;
                    return (
                      <button
                        key={def.id}
                        disabled={busy === g.id}
                        onClick={() => apply(g.id, isOn ? null : def.id)}
                        className={cn(
                          "hud-btn-hex h-10 px-5 flex items-center gap-2 font-display text-[10px] tracking-[0.24em] uppercase transition-colors disabled:opacity-50",
                          isOn
                            ? "bg-[hsl(45_60%_12%)] border border-yellow-400/60 text-yellow-300 hover:bg-yellow-500/15"
                            : "bg-[hsl(222_42%_9%)] border border-primary/45 text-primary hover:bg-primary/12 hover:border-primary/80",
                        )}
                      >
                        {busy === g.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        {isOn ? "Sundat" : "Nahodit"} · {def.name}
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
