import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare } from "lucide-react";

type Thread = {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  updated_at: string;
  user_id: string;
};

export const RecommendedThreads = ({ userId }: { userId: string }) => {
  const { t, i18n } = useTranslation();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [categories, setCategories] = useState<Record<string, { slug: string; name: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // 1. categories where user has activity (threads or posts)
      const [myThreadsRes, myPostsRes, catsRes] = await Promise.all([
        supabase.from("forum_threads").select("category_id,id").eq("user_id", userId),
        supabase.from("forum_posts").select("thread_id").eq("user_id", userId),
        supabase.from("forum_categories").select("id,slug,name"),
      ]);

      if (cancelled) return;

      const catMap: Record<string, { slug: string; name: string }> = {};
      (catsRes.data ?? []).forEach((c: { id: string; slug: string; name: string }) => {
        catMap[c.id] = { slug: c.slug, name: c.name };
      });
      setCategories(catMap);

      const myThreadIds = new Set<string>();
      (myThreadsRes.data ?? []).forEach((r) => myThreadIds.add(r.id));
      (myPostsRes.data ?? []).forEach((r) => myThreadIds.add(r.thread_id));

      const activeCats = Array.from(
        new Set((myThreadsRes.data ?? []).map((r) => r.category_id)),
      );

      // If user has no activity yet, fall back to all categories
      const targetCats = activeCats.length ? activeCats : Object.keys(catMap);
      if (targetCats.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      // 2. fetch newest threads in those categories, exclude own + already-replied
      let query = supabase
        .from("forum_threads")
        .select("id,title,slug,category_id,updated_at,user_id")
        .in("category_id", targetCats)
        .neq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20);

      const { data } = await query;
      if (cancelled) return;

      const filtered = (data ?? []).filter((th) => !myThreadIds.has(th.id)).slice(0, 5);
      setThreads(filtered as Thread[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === "cs" ? "cs-CZ" : "en-US", {
      day: "2-digit",
      month: "2-digit",
    });

  return (
    <Card className="glass border-border p-6 mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("dashboard.recommended")}
        </h3>
        <Button asChild variant="ghost" size="sm">
          <Link to="/forum">{t("dashboard.viewAll")}</Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("dashboard.noRecommendations")}</p>
      ) : (
        <ul className="space-y-3">
          {threads.map((th) => {
            const cat = categories[th.category_id];
            const href = cat ? `/forum/${cat.slug}/${th.slug}` : "/forum";
            return (
              <li key={th.id} className="border-b border-border/50 pb-2 last:border-0">
                <Link to={href} className="block group">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium group-hover:text-primary transition-colors line-clamp-1">
                        {th.title}
                      </div>
                      {cat && (
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          <MessageSquare className="h-3 w-3" />
                          {cat.name}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(th.updated_at)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
