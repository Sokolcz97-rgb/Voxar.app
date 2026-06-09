import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { PageHero } from "@/components/PageHero";
import { ScrollText } from "lucide-react";
import { useTranslation } from "react-i18next";

const Terms = () => {
  const { settings } = useSiteSettings();
  const { i18n } = useTranslation();
  const en = i18n.language?.startsWith("en");
  const siteName = settings.site_name || "StudioVoxario";
  const updated = en ? "April 18, 2026" : "18. dubna 2026";

  return (
    <div className="min-h-screen relative">
      <SEO
        title={en ? `Terms of Service — ${siteName}` : `Podmínky používání — ${siteName}`}
        description={
          en
            ? `Terms of Service for ${siteName}. Rules of conduct, content, accounts, moderation and more.`
            : `Podmínky používání služby ${siteName}. Pravidla chování, obsah, účty, moderace a další.`
        }
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />

      <main className="container py-10 max-w-3xl animate-fade-in">
        <PageHero
          eyebrow={en ? "Legal" : "Právní"}
          title={en ? "Terms of Service" : "Podmínky používání"}
          description={
            en
              ? `Rules for using the ${siteName} service. Effective from ${updated}.`
              : `Pravidla užívání služby ${siteName}. Platnost od ${updated}.`
          }
          icon={ScrollText}
        />

        {en ? (
          <Card className="glass border-border p-6 md:p-8 mt-8 space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">1. Introduction</h2>
              <p>
                Welcome to {siteName} (the “Service”). By using the Service you agree to these terms.
                If you do not agree, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">2. Account</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>You must be at least 13 years old. For younger users we recommend a legal guardian's consent.</li>
                <li>You are responsible for the security of your password and the activity on your account.</li>
                <li>One account per person. Fake identities, account sharing and ban evasion are forbidden.</li>
                <li>You can delete your account at any time in Account settings.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">3. Content and conduct rules</h2>
              <p>It is forbidden to publish content on the Service that:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>is illegal, hateful, vulgar, harassing, discriminatory or violent,</li>
                <li>contains sexual content involving minors or non-consenting persons,</li>
                <li>infringes copyright, trademark rights or other intellectual property,</li>
                <li>is spam, fraud, phishing, malware, game cheats or illegal trade,</li>
                <li>disrupts the operation of the Service (DoS, automated scraping, API abuse).</li>
              </ul>
              <p className="mt-2">
                All user content (forum posts, messages, profiles) goes through automatic and manual
                moderation. We may hide, edit or delete it without prior notice if it violates these rules.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">4. Your content</h2>
              <p>
                You retain ownership of your content. By posting content to {siteName} you grant us a
                non-exclusive, worldwide, royalty-free license to host, display, copy and distribute it
                within the Service (e.g. showing your thread to other users).
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">5. Servers, Discord and external links</h2>
              <p>
                Operators of game servers and Discord communities publish their links at their own
                responsibility. We are not responsible for the content or operation of these third parties.
                Abuse of the “featured” feature for fraudulent purposes results in removal.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">6. Streaming and IGDB data</h2>
              <p>
                Live-stream previews from Twitch, YouTube and Kick are cached through the official APIs.
                Game data (images, descriptions, release dates) comes from the IGDB database. All
                copyrights belong to their respective owners.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">7. AI assistant</h2>
              <p>
                Our AI assistant (NEON) is an informational tool. Responses may contain errors — do
                not treat them as legal, financial or medical advice. For sensitive matters, contact
                an administrator.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">8. Sanctions</h2>
              <p>
                In case of violation we may: delete a post, temporarily restrict features, issue a ban
                (“banned” role) or permanently terminate the account. We keep a moderation log for
                serious cases.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">9. Availability and changes</h2>
              <p>
                We provide the Service “as is”, without warranty of uninterrupted availability. We may
                add, change or remove features. We may update these terms — we will notify you in-app
                about significant changes.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">10. Limitation of liability</h2>
              <p>
                To the maximum extent permitted by law, we are not liable for indirect, incidental or
                consequential damages arising from your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">11. Contact</h2>
              <p>
                Direct questions, content reports or requests through the ticket system in the
                “Tickets” section or via a direct message to an administrator.
              </p>
            </section>
          </Card>
        ) : (
          <Card className="glass border-border p-6 md:p-8 mt-8 space-y-6 text-sm leading-relaxed">
            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">1. Úvod</h2>
              <p>
                Vítej na {siteName} (dále jen „Služba"). Používáním Služby souhlasíš s těmito podmínkami.
                Pokud s nimi nesouhlasíš, prosím Službu nepoužívej.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">2. Účet</h2>
              <ul className="list-disc pl-6 space-y-1">
                <li>Musíš ti být alespoň 13 let. Mladším doporučujeme souhlas zákonného zástupce.</li>
                <li>Jsi zodpovědný/á za bezpečnost svého hesla a aktivitu na účtu.</li>
                <li>Jeden účet na osobu. Falešné identity, sdílení účtů a obcházení banů jsou zakázány.</li>
                <li>Účet můžeš kdykoli smazat v Nastavení účtu.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">3. Pravidla obsahu a chování</h2>
              <p>Na Službě je zakázáno zveřejňovat obsah, který:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>je nezákonný, nenávistný, vulgární, obtěžující, diskriminační nebo násilný,</li>
                <li>obsahuje sexuální obsah s nezletilými nebo bez souhlasu zobrazené osoby,</li>
                <li>porušuje autorská práva, práva k obchodním známkám nebo jiná duševní vlastnictví,</li>
                <li>spam, podvody, phishing, malware, herní cheaty nebo nelegální obchody,</li>
                <li>narušuje provoz služby (DoS, automatizované scrapování, zneužívání API).</li>
              </ul>
              <p className="mt-2">
                Veškerý uživatelský obsah (příspěvky na fóru, zprávy, profily) prochází automatickou
                i ruční moderací. Můžeme jej skrýt, upravit nebo smazat bez předchozího upozornění,
                pokud poruší tato pravidla.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">4. Tvůj obsah</h2>
              <p>
                Vlastnictví ke svému obsahu si ponecháváš. Uložením obsahu na {siteName} nám však
                uděluješ nevýhradní, celosvětovou, bezplatnou licenci tento obsah hostovat,
                zobrazovat, kopírovat a distribuovat v rámci Služby (např. zobrazení vlákna ostatním
                uživatelům).
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">5. Servery, Discord a externí odkazy</h2>
              <p>
                Provozovatelé herních serverů a Discord komunit zveřejňují své odkazy na vlastní
                odpovědnost. Neneseme odpovědnost za obsah ani provoz těchto třetích stran.
                Zneužití funkce „featured" k podvodným účelům vede k odebrání obsahu.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">6. Streaming a IGDB data</h2>
              <p>
                Náhledy živých streamů z Twitch, YouTube a Kick jsou cachovány přes oficiální API.
                Data o hrách (obrázky, popisky, datum vydání) pochází z databáze IGDB. Veškerá
                autorská práva náleží jejich vlastníkům.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">7. AI asistent</h2>
              <p>
                Náš AI asistent (NEON) je informační nástroj. Odpovědi mohou obsahovat chyby —
                neber je jako právní, finanční nebo zdravotní rady. Pro citlivé záležitosti
                kontaktuj administrátora.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">8. Sankce</h2>
              <p>
                Při porušení podmínek můžeme: smazat příspěvek, dočasně omezit funkce, udělit ban
                („banned" role) nebo trvale zrušit účet. O závažných případech vedeme moderační log.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">9. Dostupnost a změny</h2>
              <p>
                Službu poskytujeme „tak jak je", bez záruky nepřetržité dostupnosti. Funkce můžeme
                přidávat, měnit nebo rušit. Tyto podmínky můžeme aktualizovat — o významných změnách
                tě upozorníme v aplikaci.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">10. Omezení odpovědnosti</h2>
              <p>
                V maximálním rozsahu povoleném zákonem nejsme odpovědní za nepřímé, náhodné nebo
                následné škody vyplývající z používání Služby.
              </p>
            </section>

            <section>
              <h2 className="font-display font-bold text-xl text-primary mb-2">11. Kontakt</h2>
              <p>
                Dotazy, nahlášení obsahu nebo žádosti směruj přes systém ticketů
                v sekci „Tickety" nebo přímou zprávu adminovi.
              </p>
            </section>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Terms;
