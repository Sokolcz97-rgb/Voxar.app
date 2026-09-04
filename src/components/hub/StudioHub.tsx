import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Network, LogOut, Users, Swords, ScrollText, Package, Loader2, ArrowUpRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCosmetics } from "@/contexts/CosmeticsContext";
import { useCosmeticStyles } from "@/hooks/useCosmeticStyles";
import { getCosmetic } from "@/lib/cosmetics";
import { UserAvatar } from "@/components/UserAvatar";
import { cn } from "@/lib/utils";

type FeedItem = { id: string; title: string; slug: string; categorySlug: string; author: string; avatar: string | null; createdAt: string };
type LfgItem = { id: string; userId: string; name: string; avatar: string | null; game: string; color: string; note: string | null };
type BountyItem = { id: string; title: string; reward: string; difficulty: string; slots: number; taken: number };

const relative = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "právě teď";
  if (m < 60) return `před ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `před ${h} h`;
  return `před ${Math.round(h / 24)} d`;
};

function Pod({
  icon: Icon, label, gold, count, onOpen, children,
}: {
  icon: typeof Users; label: string; gold?: boolean; count?: number | null;
  onOpen: () => void; children: React.ReactNode;
}) {
  return (
    <div className="holo-pod pod-center p-5 flex flex-col gap-4 min-h-0">
      <div className="flex items-center gap-3">
        <Icon className={cn("w-5 h-5", gold ? "text-gold" : "text-primary")} />
        <span className="font-display text-sm uppercase tracking-wider">{label}</span>
        {typeof count === "number" && (
          <span className="font-mono text-[10px] px-1.5 py-0.5 border border-primary/30 text-primary/80">{count}</span>
        )}
        <button
          type="button"
          onClick={onOpen}
          className="ml-auto text-muted-foreground/60 hover:text-primary transition-colors"
          aria-label={`Otevřít ${label}`}
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">{children}</div>
    </div>
  );
}

const Empty = ({ text }: { text: string }) => (
  <p className="font-mono text-[11px] text-muted-foreground/60 uppercase tracking-widest">{text}</p>
);

export function StudioHub({ onReturn }: { onReturn: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { myItems, loadingMine } = useCosmetics();
  const { styles } = useCosmeticStyles();

  const [loading, setLoading] = useState(true);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [lfg, setLfg] = useState<LfgItem[]>([]);
  const [bounties, setBounties] = useState<BountyItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const nowIso = new Date().toISOString();
      const [threadsRes, lfgRes, bountyRes, contractRes] = await Promise.all([
        supabase.from("forum_threads").select("id,title,slug,category_id,user_id,created_at").order("created_at", { ascending: false }).limit(8),
        supabase.from("lfg_requests").select("id,user_id,game_id,note,created_at").gt("expires_at", nowIso).order("created_at", { ascending: false }).limit(8),
        supabase.from("bounties").select("id,title,reward_label,difficulty,slots,status").eq("status", "open").order("created_at", { ascending: false }).limit(8),
        supabase.from("bounty_contracts").select("bounty_id"),
      ]);

      const threads = threadsRes.data ?? [];
      const lfgRows = lfgRes.data ?? [];
      const userIds = Array.from(new Set([...threads.map((t) => t.user_id), ...lfgRows.map((r) => r.user_id)]));
      const catIds = Array.from(new Set(threads.map((t) => t.category_id)));
      const gameIds = Array.from(new Set(lfgRows.map((r) => r.game_id)));

      const [profRes, catRes, gameRes] = await Promise.all([
        userIds.length ? supabase.from("profiles").select("user_id,display_name,username,avatar_url").in("user_id", userIds) : Promise.resolve({ data: [] as any[] }),
        catIds.length ? supabase.from("forum_categories").select("id,slug").in("id", catIds) : Promise.resolve({ data: [] as any[] }),
        gameIds.length ? supabase.from("games").select("id,name,color_tag").in("id", gameIds) : Promise.resolve({ data: [] as any[] }),
      ]);

      if (cancelled) return;

      const profs = new Map((profRes.data ?? []).map((p: any) => [p.user_id, p]));
      const cats = new Map((catRes.data ?? []).map((c: any) => [c.id, c.slug]));
      const games = new Map((gameRes.data ?? []).map((g: any) => [g.id, g]));
      const takenBy = new Map<string, number>();
      for (const c of contractRes.data ?? []) takenBy.set(c.bounty_id, (takenBy.get(c.bounty_id) ?? 0) + 1);

      setFeed(threads.map((t) => ({
        id: t.id, title: t.title, slug: t.slug,
        categorySlug: cats.get(t.category_id) ?? "",
        author: profs.get(t.user_id)?.display_name || profs.get(t.user_id)?.username || "Uživatel",
        avatar: profs.get(t.user_id)?.avatar_url ?? null,
        createdAt: t.created_at,
      })));

      setLfg(lfgRows.map((r) => ({
        id: r.id, userId: r.user_id,
        name: profs.get(r.user_id)?.display_name || profs.get(r.user_id)?.username || "Hráč",
        avatar: profs.get(r.user_id)?.avatar_url ?? null,
        game: games.get(r.game_id)?.name ?? "Neznámá hra",
        color: games.get(r.game_id)?.color_tag ?? "#22d3ee",
        note: r.note,
      })));

      setBounties((bountyRes.data ?? []).map((b: any) => ({
        id: b.id, title: b.title, reward: b.reward_label, difficulty: b.difficulty,
        slots: b.slots, taken: takenBy.get(b.id) ?? 0,
      })));

      setLoading(false);
    };

    load();

    const channel = supabase
      .channel(`studio-hub-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lfg_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "bounties" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "forum_threads" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const messageUser = async (targetId: string) => {
    if (!user) return navigate("/auth");
    const { data, error } = await supabase.rpc("get_or_create_conversation", { _other_user: targetId });
    if (error) return;
    navigate(`/messages?c=${data}`);
  };

  return (
    <div className="hud-root hud-shell h-screen w-screen overflow-hidden text-foreground flex flex-col">
      <button
        type="button"
        onClick={onReturn}
        className={cn(
          "fixed top-4 left-4 z-50 flex items-center gap-2 px-4 h-10",
          "bg-secondary/60 hover:bg-destructive/20 text-muted-foreground hover:text-destructive",
          "border border-primary/20 hover:border-destructive/50",
          "text-xs font-mono uppercase tracking-widest transition-all duration-200 hud-cut"
        )}
      >
        <LogOut className="w-4 h-4" />
        <span>Return to Hub</span>
      </button>

      <header className="shrink-0 pt-16 pb-6 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <Network className="w-7 h-7 text-gold text-glow" />
          <h1 className="font-display text-2xl tracking-[0.22em] uppercase text-glow">StudioVoxario Hub</h1>
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          Community command center // live data
        </p>
      </header>

      <main className="flex-1 min-h-0 px-6 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Pod icon={Users} label="Community Feed" count={feed.length} onOpen={() => navigate("/forum")}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
            : feed.length === 0 ? <Empty text="Zatím žádná témata" />
            : feed.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate(`/forum/${t.categorySlug}/${t.slug}`)}
                className="w-full text-left p-2 border border-primary/15 hover:border-primary/50 bg-background/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserAvatar url={t.avatar} name={t.author} className="h-6 w-6" />
                  <span className="font-mono text-[11px] text-muted-foreground truncate">{t.author}</span>
                  <span className="font-mono text-[10px] text-muted-foreground/50 ml-auto">{relative(t.createdAt)}</span>
                </div>
                <p className="text-xs mt-1 line-clamp-2">{t.title}</p>
              </button>
            ))}
        </Pod>

        <Pod icon={Swords} label="LFG Radar" gold count={lfg.length} onOpen={() => navigate("/servery")}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-gold" />
            : lfg.length === 0 ? <Empty text="Nikdo teď nehledá parťáka" />
            : lfg.map((r) => (
              <div key={r.id} className="p-2 border border-gold/20 bg-background/30">
                <div className="flex items-center gap-2">
                  <UserAvatar url={r.avatar} name={r.name} className="h-6 w-6" />
                  <span className="font-mono text-[11px] truncate">{r.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
                  <span className="text-[11px] text-muted-foreground truncate">{r.game}</span>
                </div>
                {r.note && <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-2">{r.note}</p>}
                {r.userId !== user?.id && (
                  <button
                    type="button"
                    onClick={() => messageUser(r.userId)}
                    className="mt-2 w-full font-mono text-[10px] uppercase tracking-widest border border-gold/40 text-gold/90 hover:bg-gold/10 py-1 transition-colors"
                  >
                    Připojit se
                  </button>
                )}
              </div>
            ))}
        </Pod>

        <Pod icon={ScrollText} label="Contracts" count={bounties.length} onOpen={() => navigate("/kontrakty")}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
            : bounties.length === 0 ? <Empty text="Žádné otevřené kontrakty" />
            : bounties.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => navigate("/kontrakty")}
                className="w-full text-left p-2 border border-primary/15 hover:border-primary/50 bg-background/30 transition-colors"
              >
                <p className="text-xs line-clamp-2">{b.title}</p>
                <div className="flex items-center gap-2 mt-1 font-mono text-[10px] uppercase tracking-wider">
                  <span className="text-gold/80">{b.reward}</span>
                  <span className="text-muted-foreground/60">{b.difficulty}</span>
                  <span className="ml-auto text-muted-foreground/60">{b.taken}/{b.slots}</span>
                </div>
              </button>
            ))}
        </Pod>

        <Pod icon={Package} label="Inventory" gold count={user ? myItems.length : null} onOpen={() => navigate(user ? "/profile" : "/auth")}>
          {!user ? <Empty text="Přihlas se pro zobrazení inventáře" />
            : loadingMine ? <Loader2 className="w-4 h-4 animate-spin text-gold" />
            : myItems.length === 0 ? <Empty text="Inventář je prázdný" />
            : myItems.map((item) => {
              const builtin = getCosmetic(item.cosmetic_id);
              const uploaded = styles.find((s) => s.id === item.cosmetic_id);
              const name = builtin?.name ?? uploaded?.name ?? item.cosmetic_id;
              return (
                <div key={item.id} className="p-2 border border-gold/20 bg-background/30 flex items-center gap-2">
                  <span className="text-xs truncate flex-1">{name}</span>
                  {item.equipped && (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-gold/90 border border-gold/40 px-1">
                      Nasazeno
                    </span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground/60">x{item.quantity}</span>
                </div>
              );
            })}
        </Pod>
      </main>
    </div>
  );
}
