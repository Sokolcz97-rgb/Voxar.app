import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  LEGAL_EFFECTIVE,
  LEGAL_EFFECTIVE_EXISTING,
  LEGAL_VERSION,
  LegalPage,
  Note,
  OperatorBlock,
  Sec,
  Ul,
  useOperator,
} from "@/components/legal/LegalPage";

type Row = { what: string; data: string; basis: string; keep: string };

const ROWS: Row[] = [
  {
    what: "Účet a profil",
    data: "e-mail, uživatelské a zobrazované jméno, heslo (jen v zašifrované podobě – hash), avatar, bio, jazyk, role, při přihlášení přes Discord také Discord ID, jméno a avatar",
    basis: "plnění smlouvy",
    keep: "po dobu existence účtu; po zrušení účtu smažeme do 30 dnů",
  },
  {
    what: "Komunita a obsah",
    data: "příspěvky na fóru, komunity, kanály, zprávy (i soukromé), reakce, připnutí, události, LFG, kontrakty, formuláře, tickety, propojené servery",
    basis: "plnění smlouvy",
    keep: "po dobu existence účtu nebo obsahu; veřejné příspěvky mohou po zrušení účtu zůstat anonymizované",
  },
  {
    what: "Hlasové a video hovory",
    data: "přenos zvuku a obrazu v reálném čase (nenahráváme ho), seznam účastníků hovoru a čas připojení",
    basis: "plnění smlouvy",
    keep: "záznam o účasti do odpojení z hovoru",
  },
  {
    what: "Online stav a aktivita",
    data: "online/offline stav, poslední aktivita, počty zobrazení",
    basis: "plnění smlouvy, oprávněný zájem (bezpečnost, statistiky)",
    keep: "po dobu existence účtu",
  },
  {
    what: "Nákupy, předplatné a dary",
    data: "položka, cena, tarif, způsob platby, stav platby, časy objednávky a aktivace, udělené souhlasy a verze podmínek, čas a počet stažení souboru, žádosti o vrácení peněz a reklamace",
    basis: "plnění smlouvy; právní povinnost (daňové předpisy); oprávněný zájem (prokázání souhlasů, vyřízení reklamací a vrácení peněz, obrana nároků)",
    keep: "po dobu stanovenou daňovými předpisy (zpravidla 10 let), záznamy o souhlasech a stažení 4 roky od konce smlouvy",
  },
  {
    what: "Hra Ashes of Eryon",
    data: "postava, úroveň, inventář, úkoly, poloha ve hře, herní chat, oddíl, nastavení",
    basis: "plnění smlouvy",
    keep: "po dobu existence účtu (možné vynulování během testů); herní chat 90 dní",
  },
  {
    what: "Crash reporty her a aplikací",
    data: "verze, grafická karta a ovladač, systém, chybový log (může obsahovat cestu k souboru se jménem uživatele Windows)",
    basis: "oprávněný zájem (oprava chyb a stabilita)",
    keep: "180 dní",
  },
  {
    what: "VoxarioProtect",
    data: "otisk (hash) a verze sestavení aplikace, platforma, příznaky stavu Windows Defender (vypnutá ochrana v reálném čase, nedávná manipulace), výsledek kontroly",
    basis: "oprávněný zájem (bezpečnost, ochrana před cheaty a upraveným softwarem)",
    keep: "kontroly 30 dní, bezpečnostní incidenty 12 měsíců",
  },
  {
    what: "AI funkce",
    data: "text dotazu na asistenta NEON, text zprávy k překladu, text nebo obrázek k automatické moderaci",
    basis: "plnění smlouvy (asistent, překlad na tvou žádost); oprávněný zájem (moderace a bezpečnost)",
    keep: "neukládáme nad rámec samotného obsahu; zablokované texty v moderačním logu 12 měsíců",
  },
  {
    what: "Discord integrace a bot",
    data: "Discord ID, jméno, avatar, seznam serverů (oprávnění „identify“ a „guilds“), u serverů s botem nastavení bota, body, tickety, uvítání a oznámení",
    basis: "plnění smlouvy",
    keep: "po dobu používání integrace nebo existence účtu",
  },
  {
    what: "Streamy a herní účty",
    data: "veřejné údaje o tvých kanálech Twitch / YouTube / Kick (název, náhled, počet diváků), herní jméno pro propojení herního serveru",
    basis: "souhlas (propojení provedeš sám/sama), plnění smlouvy",
    keep: "do odpojení nebo zrušení účtu",
  },
  {
    what: "Technické záznamy",
    data: "IP adresa, typ prohlížeče a zařízení, přihlašovací tokeny, záznamy serverových funkcí",
    basis: "oprávněný zájem (bezpečnost, prevence zneužití)",
    keep: "nejvýše 90 dní",
  },
  {
    what: "Komunikace",
    data: "e-maily k ověření účtu a obnovení hesla, oznámení v účtu (např. změna podmínek, potvrzení nákupu)",
    basis: "plnění smlouvy, právní povinnost (informování o změnách)",
    keep: "po dobu existence účtu",
  },
];

const PROCESSORS: [string, string][] = [
  ["Lovable (Lovable Cloud) a Supabase", "hosting webu, databáze, přihlašování, úložiště souborů a serverové funkce, odesílání e-mailů k účtu"],
  ["LiveKit", "přenos hlasových a video hovorů"],
  ["Google (Gemini), OpenAI – přes Lovable AI Gateway", "AI asistent, překlad zpráv, automatická moderace textu a obrázků"],
  ["Discord", "přihlášení přes Discord, Discord bot"],
  ["Twitch, YouTube (Google), Kick", "zjišťování živých streamů z veřejných údajů"],
  ["IGDB (Twitch) a Steam (Valve)", "údaje o hrách (nepředáváme jim tvé osobní údaje)"],
  ["Tvoje banka", "zpracování plateb převodem (jako samostatný správce podle svých podmínek)"],
];

const Privacy = () => {
  const { i18n } = useTranslation();
  const op = useOperator();
  if (i18n.language?.startsWith("en")) return <PrivacyEn />;

  return (
    <LegalPage
      seoTitle={`Ochrana osobních údajů — ${op.site}`}
      seoDescription="Jaké osobní údaje StudioVoxario zpracovává, proč, jak dlouho, komu je předává a jaká máš práva podle GDPR."
      eyebrow="Právní informace"
      title="Zásady ochrany osobních údajů"
      description={`Jak zpracováváme tvé osobní údaje na webu, v aplikacích a hrách. Verze ${LEGAL_VERSION}, účinná od ${LEGAL_EFFECTIVE}.`}
      icon={ShieldCheck}
      footer={
        <p>
          Verze {LEGAL_VERSION}, účinná od {LEGAL_EFFECTIVE} (pro stávající uživatele od {LEGAL_EFFECTIVE_EXISTING}). Předchozí
          verze platila od 18. 4. 2026.
        </p>
      }
    >
      <Note>
        <strong>Stručně:</strong> Zpracováváme jen údaje potřebné k provozu účtu, komunity, her, obchodu a k bezpečnosti. Údaje
        neprodáváme a nepoužíváme reklamní cookies. Svá práva (přístup, opravu, výmaz…) uplatníš přes Tickety nebo v nastavení
        účtu.
      </Note>

      <Sec id="spravce" n={1} title="Správce">
        <OperatorBlock />
        <p>Pověřence pro ochranu osobních údajů jsme nejmenovali – není to pro nás povinné. Se vším se obracej na kontakty výše.</p>
      </Sec>

      <Sec id="udaje" n={2} title="Jaké údaje, proč, na jakém základě a jak dlouho">
        <div className="space-y-3">
          {ROWS.map((r) => (
            <div key={r.what} className="rounded-md border border-border/70 p-3">
              <p className="font-semibold text-foreground">{r.what}</p>
              <p><span className="text-foreground/80">Údaje:</span> {r.data}</p>
              <p><span className="text-foreground/80">Právní základ:</span> {r.basis}</p>
              <p><span className="text-foreground/80">Doba uložení:</span> {r.keep}</p>
            </div>
          ))}
        </div>
        <p>
          Platební údaje (číslo karty, přihlášení do banky) nezpracováváme – zadáváš je jen ve své bance.
          Do naší databáze neukládáme historii prohlížení z VoxarioBrowseru ani obsah souborů na tvém počítači.
        </p>
      </Sec>

      <Sec id="opravneny-zajem" n={3} title="Oprávněný zájem a námitka">
        <p>
          Tam, kde zpracováváme údaje na základě oprávněného zájmu (bezpečnost, ochrana před podvody a cheaty, oprava chyb,
          prokázání souhlasů a obrana právních nároků), jsme posoudili, že tento zájem nepřevažuje nad tvými právy. Proti
          takovému zpracování můžeš kdykoli vznést námitku.
        </p>
      </Sec>

      <Sec id="automatizace" n={4} title="Automatizované zpracování a moderace">
        <p>
          Automatická moderace (včetně AI) může skrýt nebo zablokovat zprávu či obrázek. Nejde o rozhodování s právními účinky;
          každé rozhodnutí si můžeš nechat přezkoumat člověkem přes Tickety. Profilování pro reklamu neprovádíme.
        </p>
      </Sec>

      <Sec id="prijemci" n={5} title="Komu údaje předáváme">
        <p>Údaje předáváme jen v nezbytném rozsahu těmto zpracovatelům a příjemcům:</p>
        <Ul>
          {PROCESSORS.map(([who, why]) => (
            <li key={who}><strong>{who}</strong> – {why}</li>
          ))}
        </Ul>
        <p>
          Obsah, který zveřejníš (příspěvky, profil, zprávy v komunitách), vidí ostatní uživatelé podle nastavení dané části
          Služeb. Orgánům veřejné moci předáváme údaje jen tehdy, ukládá-li nám to zákon.
        </p>
      </Sec>

      <Sec id="mimo-eu" n={6} title="Předávání mimo EU">
        <p>
          Někteří poskytovatelé (např. Lovable/Supabase, LiveKit, Google, OpenAI, Discord) mohou údaje zpracovávat mimo
          Evropský hospodářský prostor, zejména v USA. Předání probíhá na základě rozhodnutí Evropské komise o odpovídající ochraně
          (EU–US Data Privacy Framework) nebo standardních smluvních doložek schválených Evropskou komisí.
        </p>
      </Sec>

      <Sec id="cookies" n={7} title="Cookies a lokální úložiště">
        <Ul>
          <li><strong>Nezbytné:</strong> přihlašovací relace, zabezpečení, volba jazyka – bez nich Služby nefungují, souhlas nepotřebují.</li>
          <li><strong>Funkční:</strong> zapamatované nastavení (např. zavřená oznámení, rozpracované zprávy, nastavení dema Voxario Studia) v lokálním úložišti prohlížeče.</li>
          <li><strong>Statistiky návštěvnosti:</strong> souhrnné údaje o návštěvnosti, které poskytuje hosting webu.</li>
        </Ul>
        <p>Reklamní ani sledovací cookies třetích stran nepoužíváme. Lokální úložiště můžeš kdykoli smazat v nastavení prohlížeče.</p>
      </Sec>

      <Sec id="prava" n={8} title="Tvá práva">
        <Ul>
          <li>právo na přístup k údajům a jejich kopii,</li>
          <li>právo na opravu nepřesných údajů,</li>
          <li>právo na výmaz („být zapomenut“) – účet můžeš zrušit sám/sama v nastavení,</li>
          <li>právo na omezení zpracování,</li>
          <li>právo na přenositelnost údajů,</li>
          <li>právo vznést námitku proti zpracování na základě oprávněného zájmu,</li>
          <li>právo kdykoli odvolat souhlas (např. odpojením streamovacího účtu nebo vypnutím notifikací),</li>
          <li>
            právo podat stížnost u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7 (
            <a className="text-primary underline" href="https://uoou.gov.cz" target="_blank" rel="noreferrer">uoou.gov.cz</a>).
          </li>
        </Ul>
        <p>
          Žádost podej přes <Link className="text-primary underline" to="/tickets">Tickety</Link> nebo telefonicky. Vyřídíme ji
          bez zbytečného odkladu, nejpozději do jednoho měsíce. Můžeme tě požádat o ověření totožnosti. Některé údaje můžeme
          i po žádosti o výmaz ponechat, pokud nám to ukládá zákon (např. daňové doklady) nebo je potřebujeme k obraně nároků.
        </p>
      </Sec>

      <Sec id="deti" n={9} title="Děti">
        <p>
          Služby jsou určeny osobám od 13 let. Osobám mladším 15 let poskytujeme služby, které vyžadují souhlas se zpracováním
          údajů, jen se souhlasem zákonného zástupce. Pokud zjistíme, že jsme takový souhlas neměli, údaje smažeme. Zákonný
          zástupce nás může kontaktovat stejnými cestami jako uživatel.
        </p>
      </Sec>

      <Sec id="bezpecnost" n={10} title="Zabezpečení">
        <p>
          Používáme šifrované spojení (HTTPS), hashovaná hesla, řízení přístupu na úrovni databáze (Row-Level Security), oddělené
          role v administraci, ověřování integrity aplikací a pravidelné mazání starých záznamů. Žádné opatření není stoprocentní;
          o případném závažném úniku tě budeme informovat v souladu s GDPR.
        </p>
      </Sec>

      <Sec id="zmeny" n={11} title="Změny zásad">
        <p>
          Zásady aktualizujeme, když se změní zpracování údajů. O podstatných změnách tě informujeme oznámením v účtu nejméně
          14 dní předem.
        </p>
      </Sec>
    </LegalPage>
  );
};

function PrivacyEn() {
  const op = useOperator();
  return (
    <LegalPage
      seoTitle={`Privacy Policy — ${op.site}`}
      seoDescription="How StudioVoxario processes personal data."
      eyebrow="Legal"
      title="Privacy Policy"
      description={`Version ${LEGAL_VERSION}, effective ${LEGAL_EFFECTIVE}.`}
      icon={ShieldCheck}
    >
      <Note>
        Informative English summary. <strong>The Czech version is legally binding.</strong>
      </Note>
      <Sec id="en-1" n={1} title="Controller">
        <p>
          {op.name}, sole trader, company ID {op.ico}{op.address ? `, ${op.address}` : ""}. Contact: Tickets section
          {op.phone ? ` or phone ${op.phone}` : ""}.
        </p>
      </Sec>
      <Sec id="en-2" n={2} title="What we process">
        <Ul>
          {ROWS.map((r) => (
            <li key={r.what}><strong>{r.what}</strong> — legal basis and retention as described in the Czech version.</li>
          ))}
        </Ul>
        <p>We do not process card or bank login data and do not store browsing history or files from your computer.</p>
      </Sec>
      <Sec id="en-3" n={3} title="Recipients and transfers">
        <p>
          Processors: Lovable/Supabase (hosting), LiveKit (voice/video), Google Gemini and OpenAI via Lovable AI Gateway (AI
          features), Discord, Twitch/YouTube/Kick and banks. Transfers outside the EEA rely on the EU–US Data Privacy
          Framework or standard contractual clauses. No advertising cookies.
        </p>
      </Sec>
      <Sec id="en-4" n={4} title="Your rights">
        <p>
          Access, rectification, erasure, restriction, portability, objection, withdrawal of consent and complaint to the Czech
          Office for Personal Data Protection (uoou.gov.cz). Users under 15 need a parent's or guardian's consent.
        </p>
      </Sec>
    </LegalPage>
  );
}

export default Privacy;
