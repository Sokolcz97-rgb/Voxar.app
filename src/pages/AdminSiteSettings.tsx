import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings, SiteSettings } from "@/contexts/SiteSettingsContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Save } from "lucide-react";
import { toast } from "sonner";

const AdminSiteSettings = () => {
  const { user } = useAuth();
  const { settings, refresh, loading } = useSiteSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) setForm(settings);
  }, [settings, loading]);

  const update = (k: keyof SiteSettings, v: string) =>
    setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    const payload = {
      site_name: form.site_name,
      site_tagline: form.site_tagline,
      hero_badge: form.hero_badge,
      hero_title_1: form.hero_title_1,
      hero_title_2: form.hero_title_2,
      hero_subtitle: form.hero_subtitle,
      hero_cta_label: form.hero_cta_label,
      footer_text: form.footer_text,
      logo_url: form.logo_url,
      favicon_url: form.favicon_url,
      updated_by: user?.id ?? null,
    };
    const { error } = await supabase
      .from("site_settings")
      .update(payload)
      .eq("id", settings.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Uloženo");
    refresh();
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in max-w-3xl">
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">
              Administrace
            </p>
            <h1 className="font-display font-black text-4xl md:text-5xl mt-2">
              Nastavení webu
            </h1>
            <p className="text-muted-foreground mt-2">
              Základní texty, loga a obsah úvodní stránky.
            </p>
          </div>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary-glow"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Ukládám…" : "Uložit"}
          </Button>
        </div>

        <Card className="glass border-border p-6 space-y-5 mb-5">
          <h2 className="font-display font-bold text-xl">Identita webu</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Název webu (Navbar)</Label>
              <Input
                value={form.site_name ?? ""}
                onChange={(e) => update("site_name", e.target.value)}
                placeholder="NEONHUB"
              />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input
                value={form.site_tagline ?? ""}
                onChange={(e) => update("site_tagline", e.target.value)}
                placeholder="Herní komunita"
              />
            </div>
            <div>
              <Label>Logo (URL)</Label>
              <Input
                value={form.logo_url ?? ""}
                onChange={(e) => update("logo_url", e.target.value)}
                placeholder="https://…/logo.png"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pokud prázdné, použije se ikona controlleru.
              </p>
            </div>
            <div>
              <Label>Favicon (URL)</Label>
              <Input
                value={form.favicon_url ?? ""}
                onChange={(e) => update("favicon_url", e.target.value)}
                placeholder="https://…/favicon.ico"
              />
            </div>
          </div>
        </Card>

        <Card className="glass border-border p-6 space-y-5 mb-5">
          <h2 className="font-display font-bold text-xl">Úvodní stránka — Hero</h2>
          <div>
            <Label>Badge (malý text nad nadpisem)</Label>
            <Input
              value={form.hero_badge ?? ""}
              onChange={(e) => update("hero_badge", e.target.value)}
              placeholder="Next-gen herní hub"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label>Hlavní nadpis (1. řádek)</Label>
              <Input
                value={form.hero_title_1 ?? ""}
                onChange={(e) => update("hero_title_1", e.target.value)}
                placeholder="Vstup do"
              />
            </div>
            <div>
              <Label>Hlavní nadpis (2. řádek — gradient)</Label>
              <Input
                value={form.hero_title_2 ?? ""}
                onChange={(e) => update("hero_title_2", e.target.value)}
                placeholder="NEONHUB"
              />
            </div>
          </div>
          <div>
            <Label>Popis pod nadpisem</Label>
            <Textarea
              value={form.hero_subtitle ?? ""}
              onChange={(e) => update("hero_subtitle", e.target.value)}
              rows={3}
              placeholder="Připoj se k tisícům hráčů…"
            />
          </div>
          <div>
            <Label>Text hlavního tlačítka (přihlášený uživatel)</Label>
            <Input
              value={form.hero_cta_label ?? ""}
              onChange={(e) => update("hero_cta_label", e.target.value)}
              placeholder="Vstoupit do Hubu"
            />
          </div>
        </Card>

        <Card className="glass border-border p-6 space-y-5">
          <h2 className="font-display font-bold text-xl">Zápatí</h2>
          <div>
            <Label>Text v zápatí</Label>
            <Input
              value={form.footer_text ?? ""}
              onChange={(e) => update("footer_text", e.target.value)}
              placeholder="© 2026 — Herní komunita"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Název webu se vloží automaticky před tento text.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default AdminSiteSettings;
