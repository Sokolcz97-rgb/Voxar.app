import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { usePresence } from "@/contexts/PresenceContext";
import { Zap, Users, MessageSquare, Shield, Sparkles, ArrowRight, MessageCircle } from "lucide-react";
import { TopPlayersPreview } from "@/components/TopPlayersPreview";
import { LiveStreamsSection } from "@/components/LiveStreamsSection";
import { InviteBotButton } from "@/components/InviteBotButton";
import { useFeaturedDiscord } from "@/hooks/useFeaturedDiscord";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { EditPageButton } from "@/components/pageBuilder/EditPageButton";
import { fetchPageBySlug } from "@/hooks/usePages";
import { EditableBlocks } from "@/components/pageBuilder/EditableBlocks";
import { InlineEditorFrame } from "@/components/pageBuilder/InlineEditorChrome";
import { useInlineEditor } from "@/contexts/InlineEditorContext";
import type { Block } from "@/lib/pageBuilder/types";
import { SEO } from "@/components/SEO";

const Index = () => {
  const { user, isEditor } = useAuth();
  const { visitorCount, registeredCount } = usePresence();
  const { t } = useTranslation();
  const ed = useInlineEditor();
  const { discord } = useFeaturedDiscord();
  const { settings } = useSiteSettings();
  const [customBlocks, setCustomBlocks] = useState<Block[]>([]);
  const [stats, setStats] = useState({ players: 0, streams: 0 });

  useEffect(() => {
    fetchPageBySlug("home", isEditor).then((p) => {
      if (!p) return;
      const blocks = isEditor && p.draft_blocks?.length ? p.draft_blocks : p.published_blocks;
      setCustomBlocks(blocks ?? []);
    });
  }, [isEditor]);

  useEffect(() => {
    const loadStats = async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const [{ count: totalProfiles }, { count: onlineNow }, { count: streams }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true })
          .gte("last_seen_at", fiveMinAgo),
        supabase
          .from("live_streams_cache")
          .select("id", { count: "exact", head: true })
          .eq("is_live", true),
      ]);
      setStats({ players: totalProfiles ?? 0, streams: streams ?? 0, online: onlineNow ?? 0 });
    };
    loadStats();
    const interval = setInterval(loadStats, 60_000);
    return () => clearInterval(interval);
  }, []);

  const editingThis = ed.active && ed.slug === "home";
  const blocksToShow = editingThis ? ed.blocks : customBlocks;

  const siteName = settings.site_name || "StudioVoxario";
  const seoTitle = `${siteName} — ${settings.hero_title_2 || "Herní komunita"}`;
  const seoDesc =
    settings.hero_subtitle ||
    "Live streamy, fórum, novinky o hrách a žebříčky. Připoj se k české herní komunitě.";

  return (
    <InlineEditorFrame>
    <SEO
      title={seoTitle}
      description={seoDesc}
      jsonLd={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: siteName,
        url: typeof window !== "undefined" ? window.location.origin : "",
        potentialAction: {
          "@type": "SearchAction",
          target: `${typeof window !== "undefined" ? window.location.origin : ""}/forum?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      }}
    />
    <div className="min-h-screen relative overflow-hidden">
      {/* Animated background layers */}
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-40" />
      <div className="fixed top-1/4 -left-40 w-96 h-96 rounded-full bg-primary/20 blur-[120px] animate-float-slow" />
      <div className="fixed bottom-1/4 -right-40 w-96 h-96 rounded-full bg-accent/20 blur-[120px] animate-float-slow" style={{ animationDelay: "2s" }} />

      <Navbar />

      <main>
        {/* HERO */}
        <section className="container relative pt-24 pb-32">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass mb-8">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {settings.hero_badge || t("home.badge")}
              </span>
            </div>

            <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl mb-6 leading-[0.95]">
              <span className="text-foreground">{settings.hero_title_1 || t("home.title1")}</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent text-glow">
                {settings.hero_title_2 || t("home.title2")}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-medium">
              {settings.hero_subtitle || t("home.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center flex-wrap">
              {user ? (
                <Button size="xl" variant="hero" asChild>
                  <Link to="/dashboard">
                    {settings.hero_cta_label || t("home.enter")} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="xl" variant="hero" asChild>
                    <Link to="/auth">
                      {t("home.signUp")} <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="xl" variant="outline" asChild>
                    <Link to="/auth">{t("home.signIn")}</Link>
                  </Button>
                </>
              )}
              {discord && (
                <Button
                  size="xl"
                  asChild
                  className="bg-[#5865F2] text-white hover:bg-[#4752C4] hover:-translate-y-0.5 shadow-[0_0_24px_rgba(88,101,242,0.35)] hover:shadow-[0_0_40px_rgba(88,101,242,0.55)] transition-all"
                >
                  <a href={discord.invite_url} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1 h-4 w-4" />
                    {discord.name}
                  </a>
                </Button>
              )}
              <InviteBotButton size="xl" variant="outline" />
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mt-16 sm:mt-20 max-w-3xl mx-auto">
            {[
              { value: String(stats.players), label: t("home.stats.players") },
              { value: String(stats.streams), label: t("home.stats.streams") },
              { value: String(registeredCount), label: t("home.stats.online") },
              { value: String(visitorCount), label: t("home.stats.visitors") },
            ].map((s) => (
                <div key={s.label} className="premium-card rounded-xl p-4 sm:p-5">
                  <div className="font-display text-2xl md:text-3xl font-bold text-primary text-glow relative">{s.value}</div>
                  <div className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground mt-1 relative leading-tight">{s.label}</div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* FEATURES */}
        <section className="container pb-32">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Users, title: t("home.features.community.title"), desc: t("home.features.community.desc") },
              { icon: MessageSquare, title: t("home.features.dms.title"), desc: t("home.features.dms.desc") },
              { icon: Shield, title: t("home.features.moderation.title"), desc: t("home.features.moderation.desc") },
              { icon: Zap, title: t("home.features.streams.title"), desc: t("home.features.streams.desc") },
            ].map((f, i) => (
              <div
                key={f.title}
                className="group glass rounded-xl p-6 hover:border-primary/60 transition-all duration-300 hover:translate-y-[-4px] animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="w-11 h-11 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:border-primary transition-all">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display font-bold text-lg mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* LIVE STREAMS */}
        <LiveStreamsSection />

        {/* TOP PLAYERS */}
        <TopPlayersPreview />

        {/* CUSTOM EDITOR BLOCKS */}
        {(blocksToShow.length > 0 || editingThis) && (
          <section className="container max-w-4xl pb-32">
            <EditableBlocks blocks={blocksToShow} editable={editingThis} />
          </section>
        )}
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="container flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-muted-foreground">
          <div>
            <span className="font-display tracking-widest">{settings.site_name}</span>{" "}
            {settings.footer_text || `© 2026 — ${t("home.footer.tagline")}`}
          </div>
          <nav className="flex items-center gap-4">
            <a href="/terms" className="hover:text-primary transition-colors">{t("home.footer.terms")}</a>
            <span className="opacity-40">·</span>
            <a href="/privacy" className="hover:text-primary transition-colors">{t("home.footer.privacy")}</a>
          </nav>
        </div>
      </footer>
      <EditPageButton slug="home" />
    </div>
    </InlineEditorFrame>
  );
};

export default Index;
