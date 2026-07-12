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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GuildResourceSelect } from "@/components/GuildResourceSelect";

const AdminSiteSettings = () => {
  const { user } = useAuth();
  const { settings, refresh, loading } = useSiteSettings();
  const [form, setForm] = useState<SiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [guilds, setGuilds] = useState<Array<{ guild_id: string; name: string }>>([]);

  useEffect(() => {
    if (!loading) setForm(settings);
    // Admin needs sensitive ticket-related columns too; fetch full row (RLS gated by can('site','manage')).
    supabase
      .from("site_settings")
      .select("web_tickets_guild_id, web_tickets_category_id, web_tickets_notify_channel_id")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setForm((f) => ({ ...f, ...(data as any) }));
      });
  }, [settings, loading]);

  useEffect(() => {
    supabase
      .from("bot_guilds")
      .select("guild_id, name")
      .eq("status", "approved")
      .order("name", { ascending: true })
      .then(({ data }) => setGuilds(data || []));
  }, []);

  const update = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

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
      web_tickets_guild_id: form.web_tickets_guild_id,
      web_tickets_category_id: form.web_tickets_category_id,
      web_tickets_notify_channel_id: form.web_tickets_notify_channel_id,
      contact_section_title: form.contact_section_title,
      contact_full_name: form.contact_full_name,
      contact_address: form.contact_address,
      contact_zip: form.contact_zip,
      contact_ico: form.contact_ico,
      contact_registration: form.contact_registration,
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

        <Card className="glass border-border p-6 space-y-5 mb-5">
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

        <Card className="glass border-border p-6 space-y-5 mb-5">
          <h2 className="font-display font-bold text-xl">Kontakt a informace (patička)</h2>
          <p className="text-xs text-muted-foreground -mt-2">
            Zobrazí se v patičce webu. Prázdná pole se nevykreslí.
          </p>
          <div>
            <Label>Nadpis sekce</Label>
            <Input
              value={form.contact_section_title ?? ""}
              onChange={(e) => update("contact_section_title", e.target.value)}
              placeholder="Kontakt a informace"
            />
          </div>
          <div>
            <Label>Jméno a Příjmení</Label>
            <Input
              value={form.contact_full_name ?? ""}
              onChange={(e) => update("contact_full_name", e.target.value)}
              placeholder="Jan Novák"
            />
          </div>
          <div>
            <Label>Adresa</Label>
            <Input
              value={form.contact_address ?? ""}
              onChange={(e) => update("contact_address", e.target.value)}
              placeholder="Ulice 123, Město"
            />
          </div>
          <div>
            <Label>PSČ</Label>
            <Input
              value={form.contact_zip ?? ""}
              onChange={(e) => update("contact_zip", e.target.value)}
              placeholder="123 45"
            />
          </div>
          <div>
            <Label>IČO</Label>
            <Input
              value={form.contact_ico ?? ""}
              onChange={(e) => update("contact_ico", e.target.value)}
              placeholder="12345678"
            />
          </div>
          <div>
            <Label>Údaj o zápisu</Label>
            <Textarea
              rows={2}
              value={form.contact_registration ?? ""}
              onChange={(e) => update("contact_registration", e.target.value)}
              placeholder="Zapsán v živnostenském rejstříku…"
            />
          </div>
        </Card>

        <Card className="glass border-border p-6 space-y-5">
          <h2 className="font-display font-bold text-xl">Synchronizace ticketů s Discordem</h2>

          <div>
            <Label>Discord server</Label>
            <Select
              value={form.web_tickets_guild_id || "__none__"}
              onValueChange={(v) => {
                const next = v === "__none__" ? null : v;
                setForm((f) => ({
                  ...f,
                  web_tickets_guild_id: next,
                  // reset závislé volby při změně serveru
                  web_tickets_category_id: next === f.web_tickets_guild_id ? f.web_tickets_category_id : null,
                  web_tickets_notify_channel_id: next === f.web_tickets_guild_id ? f.web_tickets_notify_channel_id : null,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Vyber server" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— žádný (vypnuto) —</SelectItem>
                {guilds.map((g) => (
                  <SelectItem key={g.guild_id} value={g.guild_id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Tickety vytvořené na webu se budou zrcadlit pouze do tohoto Discord serveru.
              Pokud je prázdné, web tickety se na Discord nebudou posílat.
            </p>
          </div>

          <div>
            <Label>Kategorie pro nové ticket kanály</Label>
            <GuildResourceSelect
              guildId={form.web_tickets_guild_id}
              kind="category"
              value={form.web_tickets_category_id}
              onChange={(v) => update("web_tickets_category_id", v)}
              placeholder="Vyber kategorii (volitelné)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Každý web ticket dostane vlastní kanál v této kategorii.
            </p>
          </div>

          <div>
            <Label>Kanál pro oznámení o nových web ticketech</Label>
            <GuildResourceSelect
              guildId={form.web_tickets_guild_id}
              kind="text"
              value={form.web_tickets_notify_channel_id}
              onChange={(v) => update("web_tickets_notify_channel_id", v)}
              placeholder="Vyber kanál (volitelné)"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Sem se pošle zpráva „nový web ticket" s odkazem na vytvořený kanál.
              Pokud je prázdné, žádné oznámení se nepošle.
            </p>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default AdminSiteSettings;
