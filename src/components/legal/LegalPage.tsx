import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { PageHero } from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

/** Verze právních dokumentů – ukládá se k nákupům jako důkaz, se kterým zněním zákazník souhlasil. */
export const LEGAL_VERSION = "2026-10-22";
/** Účinnost pro nové uživatele a nové nákupy. */
export const LEGAL_EFFECTIVE = "22. 10. 2026";
/** Účinnost pro stávající registrované uživatele (14 dní po oznámení změny). */
export const LEGAL_EFFECTIVE_EXISTING = "5. 11. 2026";

/** Údaje provozovatele z nastavení webu (patička) s bezpečnými výchozími hodnotami. */
export function useOperator() {
  const { settings } = useSiteSettings();
  const icoRaw = settings.contact_ico || "29768781";
  const ico = icoRaw.match(/\d{8}/)?.[0] ?? icoRaw;
  const phone = settings.contact_phone_number
    ? `${(settings.contact_phone_dial_code || "+420").trim()} ${settings.contact_phone_number}`
    : null;
  return {
    name: settings.contact_full_name || "Radek Janoud",
    ico,
    address: [settings.contact_address, settings.contact_zip].filter(Boolean).join(", ") || null,
    phone,
    registration: settings.contact_registration || "Fyzická osoba podnikající.",
    site: settings.site_name || "StudioVoxario",
  };
}

export function OperatorBlock() {
  const op = useOperator();
  return (
    <div className="rounded-md border border-border/70 bg-background/40 p-4 not-prose">
      <p className="font-semibold text-foreground">{op.name}</p>
      <p>fyzická osoba podnikající podle živnostenského zákona, IČO: {op.ico}, neplátce DPH</p>
      {op.address && <p>Místo podnikání: {op.address}</p>}
      {op.phone && <p>Telefon: {op.phone}</p>}
      <p>
        Elektronický kontakt: systém <Link className="text-primary underline" to="/tickets">Tickety</Link> (po přihlášení),
        komunita na Discordu StudioVoxario
      </p>
    </div>
  );
}

/** Číslovaný oddíl dokumentu (h2 s kotvou pro obsah). */
export function Sec({ id, n, title, children }: { id: string; n: string | number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 data-legal-sec className="font-display font-bold text-xl text-primary">
        {n}. {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-6 space-y-1.5">{children}</ul>;
}

export function Note({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-primary/40 bg-primary/5 p-4 text-foreground">{children}</div>;
}

type Props = {
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
};

export function LegalPage({ seoTitle, seoDescription, eyebrow, title, description, icon, children, footer }: Props) {
  const body = useRef<HTMLDivElement>(null);
  const [toc, setToc] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    const heads = Array.from(body.current?.querySelectorAll<HTMLHeadingElement>("h2[data-legal-sec]") ?? []);
    setToc(heads.map((h) => ({ id: h.parentElement?.id ?? "", label: h.textContent ?? "" })).filter((x) => x.id));
  }, [children]);

  return (
    <div className="min-h-screen relative">
      <SEO title={seoTitle} description={seoDescription} />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-8 md:py-10 max-w-3xl animate-fade-in">
        <PageHero eyebrow={eyebrow} title={title} description={description} icon={icon} />
        <nav className="mt-6 text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1" aria-label="Právní dokumenty">
          <Link className="hover:text-primary" to="/terms">Podmínky použití</Link>
          <Link className="hover:text-primary" to="/obchodni-podminky">Obchodní podmínky</Link>
          <Link className="hover:text-primary" to="/privacy">Ochrana osobních údajů</Link>
          <Link className="hover:text-primary" to="/licence">Licenční podmínky</Link>
        </nav>
        <Card className="glass border-border p-6 md:p-8 mt-4 text-sm leading-relaxed text-muted-foreground">
          {toc.length > 2 && (
            <details className="mb-6 rounded-md border border-border/70 p-3" open>
              <summary className="cursor-pointer font-semibold text-foreground">Obsah</summary>
              <ol className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a className="hover:text-primary" href={`#${t.id}`}>{t.label}</a>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <div ref={body} className="space-y-8 [&_strong]:text-foreground">
            {children}
          </div>
          {footer && <div className="mt-8 border-t border-border/60 pt-4 text-xs">{footer}</div>}
        </Card>
      </main>
    </div>
  );
}
