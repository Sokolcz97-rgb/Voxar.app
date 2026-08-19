import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { PageHero } from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useShop } from "@/hooks/useShop";
import { Scale } from "lucide-react";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="font-display font-bold text-xl text-glow">{title}</h2>
    <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">{children}</div>
  </section>
);

const BusinessTerms = () => {
  const { settings } = useSiteSettings();
  const { settings: shop } = useShop();

  const seller = settings.contact_full_name || settings.site_name;
  const refund =
    shop?.refund_notice ||
    "Na dary ani na zakoupené rámečky a digitální obsah neposkytujeme vrácení peněz (refund).";

  return (
    <div className="min-h-screen relative">
      <SEO
        title="Obchodní podmínky — StudioVoxario"
        description="Obchodní podmínky pro nákup digitálního obsahu, plugin licencí a dobrovolné dary na StudioVoxario."
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-8 md:py-10 animate-fade-in max-w-3xl">
        <PageHero
          eyebrow="Právní informace"
          title="Obchodní podmínky"
          description="Podmínky pro nákup digitálního obsahu a poskytování dobrovolných darů."
          icon={Scale}
        />

        <Card className="glass border-border p-6 md:p-8 space-y-8">
          <Section title="1. Provozovatel (prodávající)">
            <p>{seller}</p>
            {settings.contact_address && (
              <p>
                {settings.contact_address}
                {settings.contact_zip ? `, ${settings.contact_zip}` : ""}
              </p>
            )}
            {settings.contact_ico && <p>IČO: {settings.contact_ico}</p>}
            {settings.contact_registration && <p>{settings.contact_registration}</p>}
            {settings.contact_phone_number && (
              <p>
                Telefon: {settings.contact_phone_dial_code} {settings.contact_phone_number}
              </p>
            )}
            <p>
              Provozovatel není plátcem DPH, pokud není u ceny uvedeno jinak. Ceny jsou uvedeny v Kč
              jako konečné.
            </p>
          </Section>

          <Section title="2. Předmět nabídky">
            <p>
              Prostřednictvím sekce Obchod je nabízen výhradně digitální obsah nedodávaný na hmotném
              nosiči — kosmetická orámování profilu, licenční kódy k pluginům a dobrovolné finanční
              dary na podporu provozu projektu.
            </p>
            <p>
              Dar není nákupem zboží ani služby a nevzniká za něj nárok na protiplnění.
            </p>
          </Section>

          <Section title="3. Objednávka a uzavření smlouvy">
            <p>
              Smlouva je uzavřena okamžikem zaplacení zvolené částky (PayPal nebo bankovní převod /
              QR platba). Po připsání platby je digitální obsah aktivován na účtu kupujícího, zpravidla
              do 72 hodin.
            </p>
          </Section>

          <Section title="4. Platební podmínky">
            <p>
              Platby probíhají přes službu PayPal nebo bankovním převodem na účet provozovatele,
              který lze uhradit i naskenováním QR kódu v bankovní aplikaci. Provozovatel neuchovává
              platební údaje kupujícího.
            </p>
          </Section>

          <Section title="5. Dodání digitálního obsahu a souhlas se zahájením plnění">
            <p>
              Kupující výslovně žádá o zahájení dodávání digitálního obsahu před uplynutím lhůty pro
              odstoupení od smlouvy a bere na vědomí, že tímto souhlasem ztrácí právo odstoupit od
              smlouvy podle § 1837 písm. l) občanského zákoníku.
            </p>
            <p className="text-foreground">{refund}</p>
          </Section>

          <Section title="6. Reklamace a vadné plnění">
            <p>
              Pokud zakoupený digitální obsah nefunguje podle popisu, kontaktuj nás přes ticket systém
              nebo Discord. Reklamaci vyřídíme nejpozději do 30 dnů. V případě oprávněné reklamace máš
              nárok na nápravu (oprava, náhradní obsah), případně na vrácení platby, pokud nápravu
              nelze zajistit.
            </p>
          </Section>

          <Section title="7. Uživatelský účet a zákaz zneužití">
            <p>
              Zakoupený obsah je vázán na uživatelský účet a není přenositelný ani určený k dalšímu
              prodeji. Při porušení pravidel komunity může být přístup k obsahu omezen bez nároku na
              vrácení platby.
            </p>
          </Section>

          <Section title="8. Ochrana osobních údajů">
            <p>
              Osobní údaje jsou zpracovávány v souladu s nařízením GDPR pouze pro účely vyřízení
              objednávky a vedení účtu. Podrobnosti najdeš v zásadách ochrany osobních údajů.
            </p>
          </Section>

          <Section title="9. Mimosoudní řešení sporů">
            <p>
              K mimosoudnímu řešení spotřebitelských sporů je příslušná Česká obchodní inspekce
              (www.coi.cz). Vztahy se řídí právním řádem České republiky.
            </p>
          </Section>

          <Section title="10. Účinnost">
            <p>Tyto obchodní podmínky jsou účinné od 1. 1. 2026.</p>
          </Section>
        </Card>
      </main>
    </div>
  );
};

export default BusinessTerms;
