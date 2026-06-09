import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { PageHero } from "@/components/PageHero";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const Privacy = () => {
  const { settings } = useSiteSettings();
  const { i18n } = useTranslation();
  const en = i18n.language?.startsWith("en");
  const siteName = settings.site_name || "StudioVoxario";
  const updated = en ? "April 18, 2026" : "18. dubna 2026";

  return (
    <div className="min-h-screen relative">
      <SEO
        title={en ? `Privacy Policy — ${siteName}` : `Zásady ochrany soukromí — ${siteName}`}
        description={
          en
            ? `How ${siteName} processes your personal data, cookies and third-party data.`
            : `Jak ${siteName} zpracovává tvoje osobní údaje, cookies a data třetích stran.`
        }
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />

      <main className="container py-10 max-w-3xl animate-fade-in">
        <PageHero
          eyebrow={en ? "Legal" : "Právní"}
          title={en ? "Privacy Policy" : "Zásady ochrany soukromí"}
          description={
            en
              ? `How ${siteName} processes your personal data. Effective from ${updated}.`
              : `Jak ${siteName} zpracovává tvoje osobní údaje. Platnost od ${updated}.`
          }
          icon={ShieldCheck}
        />

        {en ? (
          <Card className="glass border-border p-6 md:p-8 mt-8 space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">1. Who we are</h2>
              <p>
                {siteName} is a gaming community platform. This policy describes which data we
                process, why, for how long, and what rights you have.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">2. What data we process</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Account:</strong> e-mail, username, display name, avatar, bio.</li>
                <li><strong>Social profiles (optional):</strong> Twitch / YouTube / Kick handle for live-stream detection.</li>
                <li><strong>Content:</strong> forum posts, private messages, reactions, tickets, owned servers.</li>
                <li><strong>Activity:</strong> last sign-in, thread views, presence (online/offline).</li>
                <li><strong>Roles &amp; permissions:</strong> assigned roles for access control (admin, editor, content_creator, …).</li>
                <li><strong>Technical:</strong> IP address, user agent (edge function logs), session token.</li>
                <li><strong>Moderation log:</strong> texts that were automatically filtered or blocked.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">3. Why we process it (legal basis)</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Contract performance</strong> — so you can use your account, forum, messages and tickets.</li>
                <li><strong>Legitimate interest</strong> — security, abuse prevention, content moderation.</li>
                <li><strong>Consent</strong> — browser notifications, linking streaming accounts.</li>
                <li><strong>Legal obligation</strong> — when we are required by law to retain certain data.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">4. Third parties and sub-processors</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Lovable Cloud (Supabase)</strong> — database hosting, authentication, avatar storage, edge functions.</li>
                <li><strong>Lovable AI Gateway</strong> — processing NEON AI assistant queries and text moderation (Google Gemini / OpenAI). Message texts may be transmitted to the model for processing.</li>
                <li><strong>Twitch, YouTube, Kick</strong> — public data only (stream title, thumbnail, viewer count) via official APIs.</li>
                <li><strong>IGDB</strong> — game metadata for the News section.</li>
                <li><strong>Steam Web API</strong> — game title search (optional).</li>
              </ul>
              <p className="mt-2">
                We do not sell your data. We only share it to the extent necessary with the providers listed above.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">5. Cookies and local storage</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Essential</strong> — session token (sign-in), language preference.</li>
                <li><strong>Functional</strong> — search history, dismissed notifications, AI chat draft (sessionStorage).</li>
              </ul>
              <p className="mt-2">We do not use any advertising or third-party tracking cookies.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">6. Retention</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Account and content — as long as the account exists. After account deletion, personal data is removed within 30 days; public posts may remain anonymised.</li>
                <li>Moderation log — max. 12 months.</li>
                <li>Edge function logs — max. 30 days.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">7. Your rights (GDPR)</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Right of access, rectification, erasure and restriction of processing.</li>
                <li>Right to data portability.</li>
                <li>Right to object to processing based on legitimate interest.</li>
                <li>Right to withdraw consent (e.g. notifications).</li>
                <li>Right to lodge a complaint with the data protection authority.</li>
              </ul>
              <p className="mt-2">
                You can handle these requests from Profile → Account settings or via a ticket.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">8. Security</h2>
              <p>
                We use Row-Level Security at the database level, encrypted connections (HTTPS),
                hashed passwords and separated admin roles. No measure is 100% though — if you
                notice a breach, please report it via a ticket.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">9. Children</h2>
              <p>
                The Service is not intended for children under 13. If we learn that we have
                processed data of a person under 13 without consent, we will delete it.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">10. Changes to this policy</h2>
              <p>
                We may update this policy. The effective date is shown at the top. We will
                notify you in-app about significant changes.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">11. Contact</h2>
              <p>
                Data requests, erasure or questions: please open a ticket in the “Tickets”
                section or send a direct message to an administrator.
              </p>
            </section>
          </Card>
        ) : (
          <Card className="glass border-border p-6 md:p-8 mt-8 space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">1. Kdo jsme</h2>
              <p>
                {siteName} je herní komunitní platforma. Tyto zásady popisují, jaké údaje
                zpracováváme, proč, jak dlouho a jaká máš práva.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">2. Jaké údaje zpracováváme</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Účet:</strong> e‑mail, uživatelské jméno, zobrazované jméno, avatar, bio.</li>
                <li><strong>Sociální profily (volitelné):</strong> Twitch / YouTube / Kick handle pro detekci živých streamů.</li>
                <li><strong>Obsah:</strong> příspěvky na fóru, soukromé zprávy, reakce, tickety, vlastněné servery.</li>
                <li><strong>Aktivita:</strong> poslední přihlášení, počet zobrazení vláken, presence (online/offline).</li>
                <li><strong>Role &amp; oprávnění:</strong> přidělené role pro řízení přístupu (admin, editor, content_creator, …).</li>
                <li><strong>Technické:</strong> IP adresa, user agent (logy edge funkcí), session token.</li>
                <li><strong>Moderační log:</strong> texty, které byly automaticky filtrovány nebo zablokovány.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">3. Proč to zpracováváme (právní základ)</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Plnění smlouvy</strong> — abys mohl/a používat účet, fórum, zprávy, tickety.</li>
                <li><strong>Oprávněný zájem</strong> — bezpečnost, prevence zneužití, moderace obsahu.</li>
                <li><strong>Souhlas</strong> — browser notifikace, propojení streamovacích účtů.</li>
                <li><strong>Právní povinnost</strong> — pokud jsme zákonem povinni uchovávat určitá data.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">4. Třetí strany a sub‑dodavatelé</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Lovable Cloud (Supabase)</strong> — hosting databáze, autentizace, úložiště avatarů, edge funkce.</li>
                <li><strong>Lovable AI Gateway</strong> — zpracování dotazů na NEON AI asistenta a moderaci textu (Google Gemini / OpenAI). Texty zpráv mohou být přenášeny ke zpracování modelu.</li>
                <li><strong>Twitch, YouTube, Kick</strong> — pouze veřejná data (název streamu, miniatura, počet diváků) přes oficiální API.</li>
                <li><strong>IGDB</strong> — metadata o hrách pro sekci Novinky.</li>
                <li><strong>Steam Web API</strong> — vyhledávání herních titulů (volitelné).</li>
              </ul>
              <p className="mt-2">
                Údaje neprodáváme. Předáváme je pouze v nezbytném rozsahu výše uvedeným poskytovatelům.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">5. Cookies a lokální úložiště</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li><strong>Nezbytné</strong> — session token (přihlášení), volba jazyka.</li>
                <li><strong>Funkční</strong> — historie hledání, zavřené notifikace, draft AI chatu (sessionStorage).</li>
              </ul>
              <p className="mt-2">Reklamní ani sledovací cookies třetích stran nepoužíváme.</p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">6. Doba uchování</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Účet a obsah — dokud účet existuje. Po smazání účtu jsou osobní údaje odstraněny do 30 dnů; veřejné příspěvky mohou zůstat anonymizované.</li>
                <li>Moderační log — max. 12 měsíců.</li>
                <li>Edge function logy — max. 30 dnů.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">7. Tvá práva (GDPR)</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Právo na přístup, opravu, výmaz a omezení zpracování.</li>
                <li>Právo na přenositelnost údajů.</li>
                <li>Právo vznést námitku proti zpracování z oprávněného zájmu.</li>
                <li>Právo odvolat souhlas (např. notifikace).</li>
                <li>Právo podat stížnost u Úřadu pro ochranu osobních údajů.</li>
              </ul>
              <p className="mt-2">
                Tyto požadavky lze řešit z Profilu → Nastavení účtu nebo přes ticket.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">8. Bezpečnost</h2>
              <p>
                Používáme Row‑Level Security na úrovni databáze, šifrované spojení (HTTPS),
                hashovaná hesla a oddělené role v administraci. Žádné opatření však není 100% —
                pokud zaznamenáš únik, prosím nahlas jej přes ticket.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">9. Děti</h2>
              <p>
                Služba není určena dětem mladším 13 let. Pokud zjistíme zpracování dat osoby
                mladší 13 let bez souhlasu, údaje smažeme.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">10. Změny zásad</h2>
              <p>
                Tyto zásady můžeme aktualizovat. Datum platnosti najdeš nahoře. O významných
                změnách informujeme oznámením v aplikaci.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">11. Kontakt</h2>
              <p>
                Žádosti o data, výmaz nebo otázky směruj přes ticket v sekci „Tickety"
                nebo přímou zprávu administrátorovi.
              </p>
            </section>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Privacy;
