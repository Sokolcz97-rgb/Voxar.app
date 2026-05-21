import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SiteSettings = {
  id: string;
  site_name: string;
  site_tagline: string | null;
  hero_badge: string | null;
  hero_title_1: string | null;
  hero_title_2: string | null;
  hero_subtitle: string | null;
  hero_cta_label: string | null;
  footer_text: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  web_tickets_guild_id: string | null;
  web_tickets_category_id: string | null;
  web_tickets_notify_channel_id: string | null;
};

const DEFAULTS: SiteSettings = {
  id: "",
  site_name: "StudioVoxario",
  site_tagline: "Herní komunita",
  hero_badge: "Next-gen herní hub",
  hero_title_1: "Vstup do",
  hero_title_2: "StudioVoxario",
  hero_subtitle:
    "Připoj se k tisícům hráčů. Sleduj streamy, diskutuj na fóru a buduj svou hráčskou identitu.",
  hero_cta_label: "Vstoupit do Hubu",
  footer_text: "© 2026 — Herní komunita",
  logo_url: null,
  favicon_url: null,
  web_tickets_guild_id: null,
};

type Ctx = {
  settings: SiteSettings;
  loading: boolean;
  refresh: () => Promise<void>;
};

const SiteSettingsContext = createContext<Ctx>({
  settings: DEFAULTS,
  loading: true,
  refresh: async () => {},
});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) setSettings({ ...DEFAULTS, ...(data as any) });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Update favicon when changes
  useEffect(() => {
    if (!settings.favicon_url) return;
    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = settings.favicon_url;
  }, [settings.favicon_url]);

  // Update document title
  useEffect(() => {
    if (settings.site_name) {
      document.title = settings.site_tagline
        ? `${settings.site_name} — ${settings.site_tagline}`
        : settings.site_name;
    }
  }, [settings.site_name, settings.site_tagline]);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export const useSiteSettings = () => useContext(SiteSettingsContext);
