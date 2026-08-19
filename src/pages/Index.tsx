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
import { AnnouncementBar } from "@/components/AnnouncementBar";
import { CapabilitiesShowcase } from "@/components/CapabilitiesShowcase";

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
      const [{ count: totalProfiles }, { count: streams }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id", { count: "exact", head: true }),
        supabase
          .from("live_streams_cache")
          .select("id", { count: "exact", head: true })
          .eq("is_live", true),
      ]);
      setStats({ players: totalProfiles ?? 0, streams: streams ?? 0 });
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
      {/* Background layers (subtle) */}
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-20" />

      <Navbar />

      <main>
        <AnnouncementBar />
        {/* HERO */}
        <section className="container relative pt-14 sm:pt-20 lg:pt-24 pb-16 sm:pb-24">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-6 web-panel">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {settings.hero_badge || t("home.badge")}
              </span>
            </div>

            <h1 className="font-display font-black text-4xl md:text-5xl lg:text-7xl mb-5 leading-tight break-words">
              <span className="text-foreground">{settings.hero_title_1 || t("home.title1")}</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
                {settings.hero_title_2 || t("home.title2")}
              </span>
            </h1>

            <p className="web-copy text-base md:text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              {settings.hero_subtitle || t("home.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center flex-wrap">
              {user ? (
                <Button size="lg" variant="hero" className="web-cut w-full sm:w-auto" asChild>
                  <Link to="/dashboard">
                    {settings.hero_cta_label || t("home.enter")} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" variant="hero" className="web-cut w-full sm:w-auto" asChild>
                    <Link to="/auth">
                      {t("home.signUp")} <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="web-cut w-full sm:w-auto" asChild>
                    <Link to="/auth">{t("home.signIn")}</Link>
                  </Button>
                </>
              )}
              {discord && (
                <Button size="lg" variant="outline" className="web-cut w-full sm:w-auto" asChild>
                  <a href={discord.invite_url} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1 h-4 w-4" />
                    {discord.name}
                  </a>
                </Button>
              )}
              <InviteBotButton size="lg" variant="outline" className="web-cut w-full sm:w-auto" />
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-12 sm:mt-16 max-w-3xl mx-auto">
              {[
                { value: String(stats.players), label: t("home.stats.players") },
                { value: String(stats.streams), label: t("home.stats.streams") },
                { value: String(registeredCount), label: t("home.stats.online") },
                { value: String(visitorCount), label: t("home.stats.visitors") },
              ].map((s) => (
                <div key={s.label} className="web-panel p-4 sm:p-5">
                  <div className="font-display text-2xl md:text-3xl font-bold text-primary">{s.value}</div>
                  <div className="web-copy text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="container pb-16 sm:pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Users, title: t("home.features.community.title"), desc: t("home.features.community.desc") },
              { icon: MessageSquare, title: t("home.features.dms.title"), desc: t("home.features.dms.desc") },
              { icon: Shield, title: t("home.features.moderation.title"), desc: t("home.features.moderation.desc") },
              { icon: Zap, title: t("home.features.streams.title"), desc: t("home.features.streams.desc") },
            ].map((f, i) => (
              <div
                key={f.title}
                className={`group web-panel p-6 animate-fade-in ${i === 0 ? "web-cut web-panel-accent" : ""}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="w-10 h-10 flex items-center justify-center mb-4 border border-primary/25 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
                <p className="web-copy text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>


        {/* CAPABILITIES */}
        <CapabilitiesShowcase />



        {/* LIVE STREAMS moved to /live */}



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
        <div className="container space-y-6">
          {(settings.contact_full_name || settings.contact_address || settings.contact_zip || settings.contact_ico || settings.contact_registration || settings.contact_phone_number) && (
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="font-display font-bold text-lg text-foreground mb-3">
                {settings.contact_section_title || "Kontakt a informace"}
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-muted-foreground">
                {settings.contact_full_name && (
                  <div className="flex flex-col sm:flex-row sm:gap-2 sm:justify-center">
                    <dt className="font-medium text-foreground">Jméno a Příjmení:</dt>
                    <dd>{settings.contact_full_name}</dd>
                  </div>
                )}
                {settings.contact_address && (
                  <div className="flex flex-col sm:flex-row sm:gap-2 sm:justify-center">
                    <dt className="font-medium text-foreground">Adresa:</dt>
                    <dd>{settings.contact_address}</dd>
                  </div>
                )}
                {settings.contact_zip && (
                  <div className="flex flex-col sm:flex-row sm:gap-2 sm:justify-center">
                    <dt className="font-medium text-foreground">PSČ:</dt>
                    <dd>{settings.contact_zip}</dd>
                  </div>
                )}
                {settings.contact_ico && (
                  <div className="flex flex-col sm:flex-row sm:gap-2 sm:justify-center">
                    <dt className="font-medium text-foreground">IČO:</dt>
                    <dd>{settings.contact_ico}</dd>
                  </div>
                )}
                {settings.contact_phone_number && (
                  <div className="flex flex-col sm:flex-row sm:gap-2 sm:justify-center">
                    <dt className="font-medium text-foreground">Telefon:</dt>
                    <dd>
                      <a
                        href={`tel:${(settings.contact_phone_dial_code || "").replace(/\s+/g, "")}${settings.contact_phone_number.replace(/\s+/g, "")}`}
                        className="hover:text-primary transition-colors"
                      >
                        {(settings.contact_phone_dial_code || "").trim()} {settings.contact_phone_number}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
              {settings.contact_registration && (
                <p className="text-xs text-muted-foreground mt-3 whitespace-pre-line">
                  {settings.contact_registration}
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-muted-foreground">
            <div>
              <span className="font-display tracking-widest">{settings.site_name}</span>{" "}
              {settings.footer_text || `© 2026 — ${t("home.footer.tagline")}`}
            </div>
            <nav className="flex items-center gap-4">
              <a href="/terms" className="hover:text-primary transition-colors">{t("home.footer.terms")}</a>
              <span className="opacity-40">·</span>
              <a href="/privacy" className="hover:text-primary transition-colors">{t("home.footer.privacy")}</a>
              <span className="opacity-40">·</span>
              <a href="/obchodni-podminky" className="hover:text-primary transition-colors">Obchodní podmínky</a>
            </nav>
          </div>
        </div>
      </footer>
      <EditPageButton slug="home" />
    </div>
    </InlineEditorFrame>
  );
};

export default Index;
