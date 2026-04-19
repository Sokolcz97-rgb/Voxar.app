import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const Terms = () => {
  const { settings } = useSiteSettings();
  const siteName = settings.site_name || "StudioVoxario";
  const updated = "18. dubna 2026";

  return (
    <div className="min-h-screen relative">
      <SEO
        title={`Podmínky používání — ${siteName}`}
        description={`Podmínky používání služby ${siteName}. Pravidla chování, obsah, účty, moderace a další.`}
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />

      <main className="container py-12 max-w-3xl animate-fade-in">
        <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Právní</p>
        <h1 className="font-display font-black text-3xl md:text-4xl mt-2">Podmínky používání</h1>
        <p className="text-sm text-muted-foreground mt-2">Platnost od {updated}</p>

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
      </main>
    </div>
  );
};

export default Terms;
