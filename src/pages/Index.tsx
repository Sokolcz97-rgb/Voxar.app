import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Zap, Users, MessageSquare, Shield, Sparkles, ArrowRight } from "lucide-react";
import { SiDiscord } from "react-icons/si";
import { TopPlayersPreview } from "@/components/TopPlayersPreview";
import { useFeaturedDiscord } from "@/hooks/useFeaturedDiscord";
import { EditPageButton } from "@/components/pageBuilder/EditPageButton";
import { fetchPageBySlug } from "@/hooks/usePages";
import { EditableBlocks } from "@/components/pageBuilder/EditableBlocks";
import { InlineEditorFrame } from "@/components/pageBuilder/InlineEditorChrome";
import { useInlineEditor } from "@/contexts/InlineEditorContext";
import type { Block } from "@/lib/pageBuilder/types";

const Index = () => {
  const { user, isEditor } = useAuth();
  const { t } = useTranslation();
  const ed = useInlineEditor();
  const [customBlocks, setCustomBlocks] = useState<Block[]>([]);

  useEffect(() => {
    fetchPageBySlug("home", isEditor).then((p) => {
      if (!p) return;
      const blocks = isEditor && p.draft_blocks?.length ? p.draft_blocks : p.published_blocks;
      setCustomBlocks(blocks ?? []);
    });
  }, [isEditor]);

  const editingThis = ed.active && ed.slug === "home";
  const blocksToShow = editingThis ? ed.blocks : customBlocks;

  return (
    <InlineEditorFrame>
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
                {t("home.badge")}
              </span>
            </div>

            <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl mb-6 leading-[0.95]">
              <span className="text-foreground">{t("home.title1")}</span>
              <br />
              <span className="bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent text-glow">
                {t("home.title2")}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 font-medium">
              {t("home.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {user ? (
                <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary-glow text-base px-8 h-12 animate-pulse-glow">
                  <Link to="/dashboard">
                    {t("home.enter")} <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild className="bg-primary text-primary-foreground hover:bg-primary-glow text-base px-8 h-12 animate-pulse-glow">
                    <Link to="/auth">
                      {t("home.signUp")} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary text-base px-8 h-12">
                    <Link to="/auth">{t("home.signIn")}</Link>
                  </Button>
                </>
              )}
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-6 mt-20 max-w-2xl mx-auto">
              {[
                { value: "12K+", label: t("home.stats.players") },
                { value: "340", label: t("home.stats.streams") },
                { value: "24/7", label: t("home.stats.online") },
              ].map((s) => (
                <div key={s.label} className="glass rounded-lg p-4 hover:border-primary/50 transition-all">
                  <div className="font-display text-2xl md:text-3xl font-bold text-primary text-glow">{s.value}</div>
                  <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="container pb-32">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: Users, title: "Komunita", desc: "Tisíce aktivních hráčů" },
              { icon: MessageSquare, title: "Soukromé zprávy", desc: "Připravujeme" },
              { icon: Shield, title: "Moderace", desc: "Bezpečné prostředí" },
              { icon: Zap, title: "Live streamy", desc: "Sleduj v reálném čase" },
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
        <div className="container text-center text-sm text-muted-foreground">
          <span className="font-display tracking-widest">NEONHUB</span> © 2026 — Herní komunita
        </div>
      </footer>
      <EditPageButton slug="home" />
    </div>
    </InlineEditorFrame>
  );
};

export default Index;
