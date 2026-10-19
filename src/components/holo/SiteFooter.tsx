import { Link, useLocation } from "react-router-dom";
import { ShieldCheck, FileCheck2, History, LifeBuoy, Mail, Phone, MapPin, BadgeCheck } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useFeaturedDiscord } from "@/hooks/useFeaturedDiscord";
import { isWebSurface } from "@/components/holo/WebSurface";

const columns = [
  {
    title: "Platforma",
    links: [
      { to: "/app", label: "Voxar.app" },
      { to: "/browser", label: "VoxarioBrowser" },
      { to: "/desktop", label: "VoxarioProtect" },
      { to: "/ashes", label: "Ashes of Eryon" },
      { to: "/desktop", label: "Ke stažení" },
    ],
  },
  {
    title: "Komunita",
    links: [
      { to: "/forum", label: "Fórum" },
      { to: "/live", label: "Live" },
      { to: "/leaderboard", label: "Žebříček" },
      { to: "/servery", label: "Servery" },
      { to: "/obchod", label: "Obchod" },
    ],
  },
  {
    title: "Podpora a důvěra",
    links: [
      { to: "/tickets", label: "Podpora (tickety)" },
      { to: "/verze", label: "Historie verzí" },
      { to: "/obchodni-podminky", label: "Obchodní podmínky" },
      { to: "/terms", label: "Podmínky použití" },
      { to: "/privacy", label: "Ochrana soukromí" },
    ],
  },
];

/** Patička veřejného webu: navigace, důvěryhodnost a kontakt na provozovatele. */
export function SiteFooter() {
  const { pathname } = useLocation();
  const { settings } = useSiteSettings();
  const { discord } = useFeaturedDiscord();
  if (!isWebSurface(pathname)) return null;

  const siteName = settings.site_name || "StudioVoxario";
  const phone = settings.contact_phone_number
    ? `${(settings.contact_phone_dial_code || "").trim()} ${settings.contact_phone_number}`.trim()
    : null;
  const address = [settings.contact_address, settings.contact_zip].filter(Boolean).join(", ");

  return (
    <footer className="holo-footer relative mt-24">
      <div className="holo-divider" />
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_repeat(3,1fr)_1.3fr]">
          <div>
            <Link to="/" className="flex items-center gap-3">
              <img src="/vox/brand/voxar-logo.webp" alt="" className="h-11 w-11 object-contain drop-shadow-[0_0_12px_rgba(41,226,247,.5)]" />
              <span className="font-display font-bold tracking-[0.2em] uppercase">
                <span className="text-primary">Studio</span>Voxario
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Česká herní platforma: komunita, vlastní aplikace, prohlížeč, ochrana počítače a hry – na jednom účtu.
            </p>
            <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Šifrované připojení a bezpečné přihlášení</li>
              <li className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-primary" /> Instalátory s kontrolním součtem SHA-256</li>
              <li className="flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Veřejná historie všech verzí</li>
            </ul>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h3 className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary/90">{column.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div>
            <h3 className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary/90">
              {settings.contact_section_title || "Provozovatel"}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              {settings.contact_full_name && (
                <li className="flex items-start gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{settings.contact_full_name}</li>
              )}
              {settings.contact_ico && <li className="pl-6">IČO: {settings.contact_ico}</li>}
              {address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{address}</li>}
              {phone && (
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${phone.replace(/\s+/g, "")}`} className="hover:text-foreground">{phone}</a>
                </li>
              )}
              <li className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4 text-primary" />
                <Link to="/tickets" className="hover:text-foreground">Napsat podpoře</Link>
              </li>
              {discord && (
                <li className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={discord.invite_url} target="_blank" rel="noreferrer" className="hover:text-foreground">Discord: {discord.name}</a>
                </li>
              )}
            </ul>
            {settings.contact_registration && (
              <p className="mt-3 whitespace-pre-line text-xs text-muted-foreground/80">{settings.contact_registration}</p>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-primary/10 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>
            {settings.footer_text?.trim().startsWith("©")
              ? settings.footer_text
              : `© ${new Date().getFullYear()} ${siteName} — ${settings.footer_text || "Všechna práva vyhrazena."}`}
          </span>
          <span className="tracking-[0.24em] uppercase text-primary/70">People · Ideas · Games · Together</span>
        </div>
      </div>
    </footer>
  );
}
