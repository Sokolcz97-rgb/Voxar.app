import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { MessageSquare, ChevronRight, Loader2, FolderTree } from "lucide-react";
import { PageHero } from "@/components/PageHero";

import { SEO } from "@/components/SEO";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
  thread_count?: number;
}

const Forum = () => {
  const { t } = useTranslation();
  const { settings } = useSiteSettings();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: cats } = await supabase
        .from("forum_categories")
        .select("*")
        .order("position");

      if (cats) {
        const withCounts = await Promise.all(
          (cats as Category[]).map(async (c) => {
            const { count } = await supabase
              .from("forum_threads")
              .select("*", { count: "exact", head: true })
              .eq("category_id", c.id);
            return { ...c, thread_count: count ?? 0 };
          })
        );
        setCategories(withCounts);
      }
      setLoading(false);
    })();
  }, []);

  const roots = categories.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => categories.filter((c) => c.parent_id === id);
  const totalCount = (c: Category) =>
    (c.thread_count ?? 0) + childrenOf(c.id).reduce((sum, s) => sum + (s.thread_count ?? 0), 0);

  return (
    <div className="min-h-screen relative">
      <SEO title={`${t("forum.title")} — ${settings.site_name}`} description={t("forum.subtitle")} />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />

      <main className="container py-10 animate-fade-in">
        <PageHero
          eyebrow={t("forum.tagline")}
          title={t("forum.title")}
          description={t("forum.subtitle")}
          icon={MessageSquare}
        />

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4">
            {roots.map((c, i) => {
              const subs = childrenOf(c.id);
              return (
                <div key={c.id} className="animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <Link to={`/forum/${c.slug}`} className="block">
                    <Card className="glass border-border p-6 hover:border-primary/60 transition-all group flex items-center gap-5">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-all shrink-0">
                        {subs.length ? (
                          <FolderTree className="h-5 w-5 text-primary" />
                        ) : (
                          <MessageSquare className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors">
                          {c.name}
                        </h3>
                        {c.description && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">{c.description}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display font-bold text-primary text-glow">{totalCount(c)}</div>
                        <div className="text-xs uppercase tracking-widest text-muted-foreground">
                          {t("forum.threadsCount")}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </Card>
                  </Link>

                  {subs.length > 0 && (
                    <div className="mt-2 ml-4 md:ml-8 grid gap-2 border-l border-border/60 pl-4">
                      {subs.map((s) => (
                        <Link key={s.id} to={`/forum/${s.slug}`} className="block">
                          <Card className="glass border-border/60 p-4 hover:border-primary/60 transition-all group flex items-center gap-4">
                            <MessageSquare className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-display font-semibold group-hover:text-primary transition-colors truncate">
                                {s.name}
                              </h4>
                              {s.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.description}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-display font-bold text-primary text-sm">{s.thread_count}</div>
                              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                {t("forum.threadsCount")}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                          </Card>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Forum;
