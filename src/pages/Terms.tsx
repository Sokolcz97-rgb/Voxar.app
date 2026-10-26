import { Link } from "react-router-dom";
import { ScrollText } from "lucide-react";
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

const L = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <Link className="text-primary underline" to={to}>{children}</Link>
);

const Terms = () => {
  const { i18n } = useTranslation();
  const en = i18n.language?.startsWith("en");
  const op = useOperator();

  if (en) return <TermsEn />;

  return (
    <LegalPage
      seoTitle={`Podmínky použití — ${op.site}`}
      seoDescription="Podmínky použití platformy StudioVoxario: účet, pravidla obsahu, autorská práva, hra Ashes of Eryon, Voxario Studio, moderace a odpovědnost."
      eyebrow="Právní informace"
      title="Podmínky použití"
      description={`Pravidla pro používání všech služeb ${op.site}. Verze ${LEGAL_VERSION}, účinná od ${LEGAL_EFFECTIVE}.`}
      icon={ScrollText}
      footer={
        <p>
          Verze {LEGAL_VERSION}. Účinnost: pro nové uživatele od {LEGAL_EFFECTIVE}, pro stávající registrované uživatele od{" "}
          {LEGAL_EFFECTIVE_EXISTING}. Předchozí verze platila od 18. 4. 2026.
        </p>
      }
    >
      <Note>
        <strong>Stručně:</strong> Všechno, co vytváří StudioVoxario (software, hry, grafika, texty, značky), je chráněné a patří
        provozovateli. Obsah, který na platformu nahraješ ty, zůstává tvým dílem, ale udělíš nám k němu širokou bezplatnou
        licenci. Chovej se slušně, necheatuj, neobcházej ochranu a nesdílej nelegální obsah. Nákupy se řídí{" "}
        <L to="/obchodni-podminky">Obchodními podmínkami</L>, software <L to="/licence">Licenčními podmínkami</L> a osobní údaje{" "}
        <L to="/privacy">Zásadami ochrany osobních údajů</L>.
      </Note>

      <Sec id="provozovatel" n={1} title="Provozovatel a rozsah">
        <p>Služby provozuje:</p>
        <OperatorBlock />
        <p>
          Tyto podmínky upravují používání všech služeb {op.site} (dále jen „<strong>Služby</strong>“), zejména webu voxar.app,
          komunitní aplikace (komunity, kanály, zprávy, hlasové a video hovory), desktopové aplikace a launcheru, prohlížeče
          VoxarioBrowser, ochrany VoxarioProtect, hry Ashes of Eryon, nástroje Voxario Studio a jeho webového dema, Discord bota,
          AI asistenta NEON, fóra, ticketů, obchodu a dalších funkcí, které k nim postupně přidáme.
        </p>
        <p>
          Podmínky tvoří smlouvu mezi tebou a provozovatelem. Spolu s nimi platí <L to="/obchodni-podminky">Obchodní podmínky</L>{" "}
          (nákupy, předplatné, dary), <L to="/licence">Licenční podmínky</L> (software a digitální obsah) a{" "}
          <L to="/privacy">Zásady ochrany osobních údajů</L>. Při rozporu má u nákupů přednost úprava v Obchodních podmínkách
          a u softwaru úprava v Licenčních podmínkách.
        </p>
      </Sec>

      <Sec id="ucet" n={2} title="Registrace, věk a účet">
        <Ul>
          <li>Registrací (nebo prvním přihlášením přes Discord) potvrzuješ, že jsi s těmito podmínkami seznámen(a) a souhlasíš s nimi.</li>
          <li>
            Služby jsou určeny osobám od <strong>13 let</strong>. Pokud je ti méně než <strong>15 let</strong>, potřebuješ
            souhlas zákonného zástupce. Nákupy může nezletilý provádět jen v rozsahu přiměřeném svému věku, jinak se souhlasem
            zákonného zástupce.
          </li>
          <li>Uváděj pravdivé údaje. Jedna osoba = jeden účet. Účet je nepřenosný; prodej, pronájem a sdílení účtů jsou zakázány.</li>
          <li>Za bezpečnost hesla a za činnost na svém účtu odpovídáš ty. Podezření na zneužití nám hned nahlas.</li>
          <li>Účet můžeš kdykoli zrušit v nastavení účtu. Tím zaniká přístup k obsahu vázanému na účet (viz i Obchodní podmínky).</li>
        </Ul>
      </Sec>

      <Sec id="pravidla" n={3} title="Pravidla chování a obsahu">
        <p>Ve Službách je zakázáno zejména:</p>
        <Ul>
          <li>zveřejňovat obsah nezákonný, nenávistný, diskriminační, výhrůžný, obtěžující, vulgární nebo podněcující k násilí;</li>
          <li>jakýkoli sexuální obsah s nezletilými (hlásíme jej orgánům činným v trestním řízení) a intimní obsah bez souhlasu zobrazené osoby;</li>
          <li>zveřejňovat cizí osobní údaje (doxxing), vydávat se za jinou osobu nebo za členy týmu StudioVoxario;</li>
          <li>porušovat autorská práva, ochranné známky a jiná práva třetích osob;</li>
          <li>spam, podvody, phishing, malware, nevyžádanou reklamu a nelegální obchod;</li>
          <li>
            používat cheaty, boty, makra, exploity a neautorizované úpravy her a aplikací, obcházet VoxarioProtect nebo jiná
            bezpečnostní opatření, zneužívat chyby (chyby nám nahlas);
          </li>
          <li>narušovat provoz Služeb (DoS, hromadné automatizované stahování obsahu, zneužívání API, obcházení omezení);</li>
          <li>nahrávat hlasové nebo video hovory ostatních bez jejich souhlasu.</li>
        </Ul>
      </Sec>

      <Sec id="moderace" n={4} title="Moderace a nahlašování nezákonného obsahu">
        <p>
          Obsah uživatelů prochází automatickou moderací (včetně AI filtrů textu a obrázků) a ruční moderací. Obsah, který
          porušuje zákon nebo tyto podmínky, můžeme skrýt, upravit, omezit jeho dosah nebo smazat.
        </p>
        <p>
          Nezákonný obsah může kdokoli nahlásit přes <L to="/tickets">Tickety</L> (s odkazem na obsah a důvodem), přes
          moderátory na Discordu StudioVoxario nebo telefonicky. Hlášení vyřizujeme bez zbytečného odkladu. Pokud tvůj obsah omezíme nebo zablokujeme účet, sdělíme ti
          důvod (s výjimkou spamu a případů, kdy by to bránil zákon). Proti rozhodnutí se můžeš ohradit přes Tickety; stížnost
          přezkoumá člověk, ne automat.
        </p>
      </Sec>

      <Sec id="dusevni-vlastnictvi" n={5} title="Duševní vlastnictví provozovatele">
        <p>
          <strong>
            Veškeré Služby a vše, co v nich vytváří provozovatel, jsou autorskými díly a dalšími předměty práv duševního
            vlastnictví, k nimž vykonává práva provozovatel (případně jeho licenční partneři).
          </strong>{" "}
          Jde zejména o software a zdrojové kódy (web, aplikace, launcher, VoxarioBrowser, VoxarioProtect, Voxario Studio, Discord
          bot), hru Ashes of Eryon včetně světa, příběhu, postav, frakcí, názvů, textů, grafiky, 3D modelů, animací, hudby a
          zvuků, dále design, loga, názvy a označení StudioVoxario, Voxario, Voxar.app a Ashes of Eryon, kosmetické předměty,
          texty, návody, databáze a jejich uspořádání.
        </p>
        <p>
          Bez předchozího písemného souhlasu provozovatele je nesmíš kopírovat, upravovat, překládat, prodávat, pronajímat,
          šířit, veřejně sdělovat, zpětně analyzovat nebo dekompilovat (s výjimkou případů, které výslovně dovoluje zákon),
          vytvářet z nich odvozená díla ani používat označení a loga provozovatele. Užívat je smíš jen způsobem, který Služby
          a <L to="/licence">Licenční podmínky</L> výslovně umožňují. <strong>Všechna práva jsou vyhrazena.</strong>
        </p>
        <p>
          Provozovatel si podle § 39c odst. 3 autorského zákona výslovně vyhrazuje práva k vytěžování textů a dat z obsahu
          Služeb (včetně trénování modelů umělé inteligence).
        </p>
      </Sec>

      <Sec id="obsah-uzivatelu" n={6} title="Obsah, který vytváříš ty">
        <p>
          Autorem obsahu, který do Služeb nahraješ nebo v nich vytvoříš (příspěvky, zprávy, profilové údaje, obrázky, módy,
          formuláře, příspěvky v komunitách apod.), zůstáváš ty – autorství podle zákona převést nelze.
        </p>
        <p>
          Nahráním nebo zveřejněním obsahu ve Službách udělíš provozovateli <strong>bezúplatnou, nevýhradní, celosvětovou,
          převoditelnou licenci s právem udělit podlicenci</strong>, a to na celou dobu trvání majetkových autorských práv, k užití
          obsahu všemi způsoby (zejména rozmnožování, rozšiřování, sdělování veřejnosti, úpravy, překlad, zařazení do souborného
          díla) v rámci Služeb a k jejich propagaci. Licence trvá i po smazání účtu u obsahu, který se stal součástí veřejných
          konverzací nebo děl jiných uživatelů. Provozovatel není povinen licenci využít.
        </p>
        <p>
          <strong>Nápady, návrhy, zpětná vazba a hlášení chyb</strong>, které nám pošleš (např. v ticketech, na fóru, při
          testování her), můžeme volně a bezúplatně využít v našich projektech, aniž bychom byli povinni tě uvádět nebo ti
          platit, pokud se písemně nedohodneme jinak. Obsah, který nám výslovně předáš k zařazení do našich projektů (např. módy,
          modely nebo texty do hry), můžeme do nich zařadit a dále šířit za stejných podmínek.
        </p>
        <p>
          Prohlašuješ, že k obsahu máš potřebná práva a že jeho zveřejněním neporušuješ práva třetích osob. Pokud nám kvůli
          tvému obsahu vznikne škoda (např. nárok třetí osoby), odpovídáš za ni podle zákona.
        </p>
        <p>
          <strong>Projekty vytvořené ve Voxario Studiu</strong> (tvé scény, modely, hry) jsou tvé. Práva k samotnému programu,
          jeho běhovým součástem a ukázkovým assetům zůstávají provozovateli – podrobnosti v <L to="/licence">Licenčních podmínkách</L>.
        </p>
      </Sec>

      <Sec id="hry" n={7} title="Hry, herní předměty a módy">
        <Ul>
          <li>
            Hra <strong>Ashes of Eryon</strong> je ve vývoji a probíhají testy. Postup, postavy, předměty a herní měna mohou být
            změněny nebo vynulovány (wipe) a hra může být dočasně nedostupná.
          </li>
          <li>
            Herní postavy, předměty, zlato a další virtuální položky jsou součástí hry. Nejsou tvým vlastnictvím, nemají peněžní
            hodnotu, nelze je směnit za peníze a máš k nim jen licenci k užití ve hře. Prodej herních položek nebo účtů za skutečné
            peníze či jiné protiplnění je zakázán.
          </li>
          <li>Názvy postav a oddílů musí respektovat pravidla obsahu; nevhodné názvy můžeme změnit.</li>
          <li>
            Módy (Lua) smíš vytvářet a bezplatně sdílet podle <L to="/licence">Licenčních podmínek</L>. Mód nesmí dávat nepoctivou
            výhodu, sbírat data ostatních hráčů ani obcházet ochranu. Módy můžeme kdykoli zablokovat.
          </li>
          <li>Hra a launcher při pádu odesílají technické hlášení (crash report) – viz Zásady ochrany osobních údajů.</li>
        </Ul>
      </Sec>

      <Sec id="bezpecnost" n={8} title="VoxarioProtect a bezpečnostní kontroly">
        <p>
          Desktopové aplikace, launcher a hry mohou ověřovat integritu svých souborů (otisk sestavení), verzi a základní stav
          ochrany zařízení (zda je zapnutá ochrana v reálném čase programu Windows Defender a zda s ní nedávno nebylo
          manipulováno). Upravené nebo nebezpečné sestavení můžeme zablokovat a podezřelé případy prošetřit. Obsah tvých
          souborů ani historii prohlížení tím nesbíráme.
        </p>
      </Sec>

      <Sec id="ai" n={9} title="AI funkce">
        <p>
          AI asistent NEON, automatický překlad zpráv a automatická moderace využívají modely umělé inteligence třetích stran.
          Odpovědi AI mohou být nepřesné nebo neúplné a nejsou právní, finanční, zdravotní ani jinou odbornou radou. Do AI
          nevkládej citlivé osobní údaje. Obsah, který AI zpracovává, předáváme poskytovatelům modelů podle Zásad ochrany
          osobních údajů.
        </p>
      </Sec>

      <Sec id="treti-strany" n={10} title="Služby a obsah třetích stran">
        <p>
          Služby obsahují odkazy a data třetích stran (herní servery, Discord, Twitch, YouTube, Kick, IGDB, Steam aj.).
          Za jejich obsah, dostupnost a podmínky neodpovídáme; jejich užívání se řídí jejich podmínkami. Provozovatelé serverů
          a komunit zveřejňují své odkazy a obsah na vlastní odpovědnost. Discord bota smí správci serverů používat jen
          v souladu s podmínkami Discordu.
        </p>
      </Sec>

      <Sec id="sankce" n={11} title="Porušení podmínek a sankce">
        <p>Při porušení těchto podmínek můžeme podle závažnosti:</p>
        <Ul>
          <li>skrýt nebo smazat obsah a udělit varování,</li>
          <li>dočasně omezit funkce (např. psaní, hlas, obchod, přístup do hry),</li>
          <li>vynulovat herní postup nebo odebrat neoprávněně získané předměty,</li>
          <li>dočasně nebo trvale zablokovat účet a zakázat založení nového.</li>
        </Ul>
        <p>
          Při podstatném porušení (např. cheating, podvod, obcházení ochrany, nelegální obsah, zpětné stornování plateb bez
          důvodu) můžeme smlouvu ukončit s okamžitou účinností. V takovém případě nevzniká nárok na vrácení již poskytnutých
          plateb v rozsahu, v jakém to dovolují právní předpisy.
        </p>
      </Sec>

      <Sec id="dostupnost" n={12} title="Dostupnost a změny Služeb">
        <p>
          Služby poskytujeme v podobě, v jaké jsou, a průběžně je vyvíjíme. Nezaručujeme nepřetržitou dostupnost; Služby mohou
          být dočasně nedostupné kvůli údržbě, aktualizacím nebo výpadkům poskytovatelů. Funkce můžeme přidávat, měnit nebo
          rušit. Pokud by změna podstatně omezila placenou službu, kterou máš předplacenou, oznámíme ji předem a nevyčerpanou
          část předplatného ti vrátíme.
        </p>
      </Sec>

      <Sec id="odpovednost" n={13} title="Odpovědnost">
        <p>
          V rozsahu, v jakém to dovolují právní předpisy, neodpovídáme za nepřímé a následné škody (např. ušlý zisk, ztráta dat
          nebo herního postupu) vzniklé používáním nebo nemožností používat Služby, ani za obsah a jednání jiných uživatelů
          a třetích stran. Neomezujeme odpovědnost za škodu způsobenou úmyslně nebo z hrubé nedbalosti, za újmu na zdraví ani
          práva spotřebitele, která nelze smluvně vyloučit (zejména práva z vadného plnění).
        </p>
      </Sec>

      <Sec id="ukonceni" n={14} title="Ukončení">
        <p>
          Smlouvu můžeš kdykoli ukončit zrušením účtu. Provozovatel ji může ukončit z důvodu porušení podmínek (bod 11) nebo
          bez udání důvodu s výpovědní dobou 30 dní oznámenou v účtu; v takovém případě vrátí nevyčerpanou část předplatného.
        </p>
      </Sec>

      <Sec id="zmeny" n={15} title="Změny podmínek">
        <p>
          Podmínky můžeme měnit, zejména kvůli novým funkcím, změnám zákonů nebo bezpečnosti. O změně tě informujeme oznámením
          v účtu (případně e-mailem) nejméně <strong>14 dní před její účinností</strong>. Pokud se změnou nesouhlasíš, můžeš
          smlouvu do dne účinnosti ukončit zrušením účtu. Pokračováním v používání Služeb po účinnosti změny souhlasíš s novým
          zněním. Změny se nevztahují zpětně na již uzavřené nákupy.
        </p>
      </Sec>

      <Sec id="pravo" n={16} title="Rozhodné právo a spory">
        <p>
          Smlouva se řídí právním řádem České republiky, zejména občanským zákoníkem a zákonem o ochraně spotřebitele. Pokud jsi
          spotřebitel s bydlištěm v jiném státě EU, nejsou dotčena ochranná ustanovení práva tvého státu. Spotřebitelské spory lze
          řešit mimosoudně u České obchodní inspekce (<a className="text-primary underline" href="https://coi.gov.cz/informace-o-adr/" target="_blank" rel="noreferrer">coi.gov.cz/informace-o-adr</a>).
          Jinak jsou příslušné české soudy.
        </p>
        <p>
          Je-li některé ustanovení neplatné nebo neúčinné, ostatní ustanovení zůstávají v platnosti a neplatné ustanovení se
          nahradí takovým, které se jeho účelu nejvíce blíží.
        </p>
      </Sec>
    </LegalPage>
  );
};

/** Anglická verze – informativní překlad, rozhodující je české znění. */
function TermsEn() {
  const op = useOperator();
  return (
    <LegalPage
      seoTitle={`Terms of Service — ${op.site}`}
      seoDescription="Terms of Service of the StudioVoxario platform."
      eyebrow="Legal"
      title="Terms of Service"
      description={`Version ${LEGAL_VERSION}, effective ${LEGAL_EFFECTIVE} (existing users ${LEGAL_EFFECTIVE_EXISTING}).`}
      icon={ScrollText}
    >
      <Note>
        This is an informative English summary. <strong>The Czech version is legally binding.</strong> Purchases are governed by
        the Business Terms, software by the License Terms and personal data by the Privacy Policy (Czech).
      </Note>
      <Sec id="en-1" n={1} title="Operator and scope">
        <p>
          The services (website voxar.app, community app, desktop app and launcher, VoxarioBrowser, VoxarioProtect, the game Ashes
          of Eryon, Voxario Studio, Discord bot, AI assistant, shop) are operated by {op.name}, sole trader, company ID {op.ico},
          not a VAT payer{op.address ? `, ${op.address}` : ""}. Contact: Tickets section or phone{op.phone ? ` ${op.phone}` : ""}.
        </p>
      </Sec>
      <Sec id="en-2" n={2} title="Account">
        <p>
          Minimum age 13; under 15 you need a parent's or guardian's consent. One account per person; accounts are personal and
          not transferable. You may delete your account at any time.
        </p>
      </Sec>
      <Sec id="en-3" n={3} title="Conduct">
        <p>
          No illegal, hateful or harassing content, no sexual content involving minors, no doxxing, no infringement, no spam or
          malware, no cheats, bots, exploits or bypassing VoxarioProtect, no disruption of the services, no recording others
          without consent. Content is moderated automatically (including AI) and manually; you can report illegal content and
          appeal decisions via Tickets.
        </p>
      </Sec>
      <Sec id="en-4" n={4} title="Intellectual property">
        <p>
          All software, games (Ashes of Eryon: world, story, characters, art, models, music), Voxario Studio, designs, logos and
          names (StudioVoxario, Voxario, Voxar.app, Ashes of Eryon) belong to the operator or its licensors. All rights reserved;
          no copying, modification, distribution, reverse engineering (except as permitted by law) or use of trademarks without
          written consent. Text and data mining is expressly reserved.
        </p>
        <p>
          You remain the author of content you upload but grant the operator a free, non-exclusive, worldwide, transferable and
          sublicensable license for the full term of copyright to use it in and for promoting the services. Ideas and feedback may
          be used freely. Projects you create in Voxario Studio are yours.
        </p>
      </Sec>
      <Sec id="en-5" n={5} title="Games and virtual items">
        <p>
          Ashes of Eryon is in development; progress may be reset. Virtual items and currency have no monetary value and may not be
          sold for real money. Mods may be shared for free under the License Terms. Games send crash reports.
        </p>
      </Sec>
      <Sec id="en-6" n={6} title="Sanctions, liability, changes, law">
        <p>
          Violations may lead to content removal, restrictions, progress resets or bans. Services are provided as is; liability for
          indirect damage is excluded to the extent permitted by law (mandatory consumer rights are not affected). Changes are
          announced at least 14 days in advance; you may terminate by deleting your account. Czech law applies; consumer disputes:
          Czech Trade Inspection Authority (coi.gov.cz/informace-o-adr).
        </p>
      </Sec>
    </LegalPage>
  );
}

export default Terms;
