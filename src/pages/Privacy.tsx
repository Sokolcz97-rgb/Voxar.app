import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { SEO } from "@/components/SEO";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const Privacy = () => {
  const { settings } = useSiteSettings();
  const siteName = settings.site_name || "StudioVoxario";
  const updated = "18. dubna 2026";

  return (
    <div className="min-h-screen relative">
      <SEO
        title={`Zásady ochrany soukromí — ${siteName}`}
        description={`Jak ${siteName} zpracovává tvoje osobní údaje, cookies a data třetích stran.`}
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />

      <main className="container py-12 max-w-3xl animate-fade-in">
        <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Právní</p>
        <h1 className="font-display font-black text-3xl md:text-4xl mt-2">Zásady ochrany soukromí</h1>
        <p className="text-sm text-muted-foreground mt-2">Platnost od {updated}</p>

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
      </main>
    </div>
  );
};

export default Privacy;
