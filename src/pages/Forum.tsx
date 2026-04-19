import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { MessageSquare, ChevronRight, Loader2 } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  thread_count?: number;
}

const Forum = () => {
  const { t } = useTranslation();
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
          cats.map(async (c) => {
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

  return (
    <div className="min-h-screen relative">
      <SEO title="Fórum — NEONHUB" description="Diskuze české herní komunity. Připoj se k tématům o hrách, streamerech a turnajích." />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />

      <main className="container py-10 animate-fade-in">
        <div className="mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">{t("forum.tagline")}</p>
          <h1 className="font-display font-black text-4xl md:text-5xl mt-2">{t("forum.title")}</h1>
          <p className="text-muted-foreground mt-2">{t("forum.subtitle")}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4">
            {categories.map((c, i) => (
              <Link key={c.id} to={`/forum/${c.slug}`} className="block animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                <Card className="glass border-border p-6 hover:border-primary/60 transition-all group flex items-center gap-5">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center group-hover:bg-primary/20 transition-all shrink-0">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-lg group-hover:text-primary transition-colors">{c.name}</h3>
                    {c.description && <p className="text-sm text-muted-foreground mt-1 truncate">{c.description}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-display font-bold text-primary text-glow">{c.thread_count}</div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground">{t("forum.threadsCount")}</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Forum;
