import { Link } from "react-router-dom";
import { Scale } from "lucide-react";
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

const BusinessTerms = () => {
  const op = useOperator();
  return (
    <LegalPage
      seoTitle={`Obchodní podmínky — ${op.site}`}
      seoDescription="Obchodní podmínky StudioVoxario: nákup digitálního obsahu, předplatné (měsíční a roční), vrácení peněz, reklamace a dary."
      eyebrow="Právní informace"
      title="Obchodní podmínky"
      description={`Podmínky nákupu digitálního obsahu, předplatného a darů. Verze ${LEGAL_VERSION}, účinná od ${LEGAL_EFFECTIVE}.`}
      icon={Scale}
      footer={
        <p>
          Verze {LEGAL_VERSION}, účinná od {LEGAL_EFFECTIVE} pro objednávky učiněné od tohoto dne. U předplatného sjednaného dříve
          se uplatní od nejbližšího obnovení po {LEGAL_EFFECTIVE_EXISTING}. Předchozí verze platila od 1. 1. 2026.
        </p>
      }
    >
      <Note>
        <strong>Stručně o vracení peněz:</strong> Zaplacené částky obecně <strong>nevracíme</strong> – digitální obsah dodáváme
        hned a při objednávce výslovně souhlasíš, že tím ztrácíš právo odstoupit od smlouvy. <strong>Výjimkou je předplatné:</strong>{" "}
        o vrácení peněz můžeš požádat <strong>do 30 minut od aktivace</strong>, pokud jsi program nezačal(a) používat (bod 10).
        Kdyby nákup nefungoval, máš vždy zákonná práva z vadného plnění (bod 11).
      </Note>

      <Sec id="prodavajici" n={1} title="Prodávající">
        <OperatorBlock />
        <p>
          Prodávající není plátcem DPH. Dozor nad dodržováním povinností vůči spotřebitelům vykonává Česká obchodní inspekce
          (www.coi.gov.cz), nad ochranou osobních údajů Úřad pro ochranu osobních údajů (www.uoou.gov.cz) a nad živnostenským
          podnikáním příslušný živnostenský úřad.
        </p>
      </Sec>

      <Sec id="pojmy" n={2} title="Pojmy">
        <Ul>
          <li><strong>Kupující</strong> – registrovaný uživatel, který v Obchodě učiní objednávku. <strong>Spotřebitel</strong> je kupující, který nejedná v rámci svého podnikání.</li>
          <li><strong>Digitální obsah</strong> – data vytvořená a dodaná v digitální podobě (rámečky profilu, licence a soubory pluginů, instalátory programů).</li>
          <li><strong>Předplatné</strong> – časově omezený přístup ke stažení a k užívání programu nebo jiného digitálního obsahu (např. Voxario Studio Engine) po zaplacené období.</li>
          <li><strong>Aktivace</strong> – okamžik, kdy prodávající potvrdí platbu a obsah či předplatné se zpřístupní v účtu kupujícího.</li>
          <li><strong>Dar</strong> – dobrovolný příspěvek na provoz bez nároku na protiplnění.</li>
        </Ul>
      </Sec>

      <Sec id="nabidka" n={3} title="Nabídka a ceny">
        <p>
          V Obchodě nabízíme výhradně digitální obsah nedodávaný na hmotném nosiči: kosmetické rámečky profilu, licence
          k pluginům (případně zakázkové úpravy), předplatné programů a možnost poslat dar. Popis, systémové požadavky, cena
          a délka předplatného jsou uvedeny u každé položky. Ceny jsou konečné v Kč; prodávající není plátcem DPH. Nabídka
          platí, dokud je zobrazena.
        </p>
      </Sec>

      <Sec id="objednavka" n={4} title="Objednávka a uzavření smlouvy">
        <Ul>
          <li>Nakupovat mohou jen přihlášení uživatelé. Nezletilí jen v rozsahu přiměřeném věku, jinak se souhlasem zákonného zástupce.</li>
          <li>
            Při objednávce zvolíš položku (u předplatného měsíční nebo roční tarif a případně automatické obnovení), potvrdíš
            souhlas s těmito obchodními podmínkami a u digitálního obsahu výslovně požádáš o jeho okamžité dodání (bod 9),
            a zvolíš způsob platby.
          </li>
          <li>
            Smlouva je uzavřena okamžikem, kdy se objednávka zaznamená v našem systému (kliknutím na „Zaplatit kartou“ nebo na
            tlačítko „Zaplatil(a) jsem – zaznamenat objednávku“). Objednávka zavazuje k zaplacení.
          </li>
          <li>
            Smlouvu uzavíráme v češtině. Záznam objednávky včetně udělených souhlasů a verze podmínek archivujeme a potvrzení
            najdeš v oznámeních svého účtu. Tyto podmínky si můžeš kdykoli zobrazit, vytisknout nebo uložit.
          </li>
          <li>Chyby při zadávání můžeš opravit před potvrzením platby; nezaplacenou objednávku můžeš nechat propadnout.</li>
        </Ul>
      </Sec>

      <Sec id="platba" n={5} title="Platba">
        <p>
          Platí se předem platební kartou (přes platební bránu Stripe, včetně Apple Pay / Google Pay) nebo bankovním převodem
          (i pomocí QR kódu) s variabilním symbolem objednávky. Platbu kartou potvrzuje systém automaticky, převod ověřujeme
          ručně. Nezaplacená objednávka se po 7 dnech ruší. Platební údaje (číslo karty, přihlášení do banky apod.)
          nezpracováváme – zadáváš je jen u Stripe nebo ve své bance. Doklad o zaplacení vystavíme na požádání. Neoprávněné zpětné stornování platby (chargeback) vede k odebrání
          obsahu a může vést k zablokování účtu.
        </p>
      </Sec>

      <Sec id="dodani" n={6} title="Dodání">
        <p>
          Digitální obsah dodáváme zpřístupněním v účtu (aktivací) po připsání a ověření platby, zpravidla do 72 hodin. Rámečky
          se aktivují v profilu, soubory a instalátory jsou ke stažení v Obchodě → Software, pluginy dodáváme podle popisu
          položky (u zakázek jako zakázku). O aktivaci tě informujeme oznámením v účtu, které slouží i jako potvrzení smlouvy.
        </p>
      </Sec>

      <Sec id="predplatne" n={7} title="Předplatné a licence">
        <Ul>
          <li>
            <strong>Tarify:</strong> měsíční (30 dní) a – pokud je u položky nabízen – roční (365 dní). Období začíná aktivací;
            pokud už předplatné běží, nové období navazuje na jeho konec.
          </li>
          <li>
            <strong>Automatické obnovení</strong> si můžeš zapnout a kdykoli vypnout u předplatného v Obchodě. Zapnuté obnovení
            znamená, že ti 3 dny před koncem období připravíme platbu za další období a upozorníme tě. <strong>Žádné peníze se
            automaticky nestrhávají</strong> – předplatné se prodlouží teprve po zaplacení. Pokud nezaplatíš, předplatné skončí.
          </li>
          <li>
            <strong>Ukončení:</strong> předplatné končí uplynutím zaplaceného období. Vypnutím obnovení nebo zrušením účtu se
            nevyčerpaná část nevrací (s výjimkou bodů 10–12).
          </li>
          <li>
            <strong>Změna ceny</strong> se týká až dalších období; oznámíme ji nejméně 14 dní předem. Zaplacené období se
            nemění.
          </li>
          <li>
            Během předplatného smíš program užívat podle <L to="/licence">Licenčních podmínek</L>. Po skončení předplatného
            zaniká právo program stahovat a užívat; projekty, které jsi v programu vytvořil(a), zůstávají tvé.
          </li>
        </Ul>
        <p className="text-foreground font-semibold">Jednorázová licence a Upgrade pass</p>
        <Ul>
          <li>
            U položek prodávaných jako <strong>jednorázová licence</strong> získáš trvalé právo program užívat podle{" "}
            <L to="/licence">Licenčních podmínek</L>. V ceně jsou <strong>aktualizace</strong> (nové verze ke stažení) na dobu
            uvedenou u položky, počítanou od zaplacení.
          </li>
          <li>
            Po skončení aktualizací program funguje dál ve verzi, kterou máš. Nové verze si můžeš odemknout
            <strong> Upgrade passem</strong> (měsíc 30 dní / rok 365 dní). Upgrade pass navazuje na konec aktualizací; pokud už
            skončily, platí ode dne zaplacení. Nic se neobnovuje ani nestrhává automaticky.
          </li>
          <li>
            Zakoupenou licenci nelze převést na jiný účet. Dobrovolná záruka vrácení peněz podle bodu 10 se na licenci a Upgrade
            pass nevztahuje; zákonná práva (např. z vadného plnění) tím nejsou dotčena.
          </li>
        </Ul>
      </Sec>

      <Sec id="dary" n={8} title="Dary">
        <p>
          Dar je dobrovolný příspěvek na provoz platformy. Nejde o koupi zboží ani služby, nevzniká za něj nárok na protiplnění
          a dar se nevrací (s výjimkou chybné platby, např. omylem zadané částky, kterou nám oznámíš bez zbytečného odkladu).
        </p>
      </Sec>

      <Sec id="odstoupeni" n={9} title="Odstoupení od smlouvy (spotřebitelé)">
        <p>
          Spotřebitel má obecně právo odstoupit od smlouvy uzavřené distančně do 14 dnů bez udání důvodu (§ 1829 občanského
          zákoníku). <strong>U digitálního obsahu nedodávaného na hmotném nosiči toto právo zaniká</strong>, pokud bylo dodání
          zahájeno s předchozím výslovným souhlasem spotřebitele a spotřebitel byl poučen, že tím právo na odstoupení ztrácí
          (§ 1837 písm. l) občanského zákoníku). U služeb zaniká právo odstoupit jejich úplným poskytnutím se souhlasem
          spotřebitele (§ 1837 písm. a)).
        </p>
        <p>
          <strong>
            Při objednávce proto výslovně žádáš o okamžité dodání digitálního obsahu (zahájení předplatného) před uplynutím lhůty
            pro odstoupení a bereš na vědomí, že aktivací ztrácíš právo od smlouvy odstoupit.
          </strong>{" "}
          Bez tohoto souhlasu objednávku nelze dokončit. Souhlas zaznamenáme a potvrdíme ti ho v oznámení o aktivaci.
        </p>
        <p>
          <strong>Před aktivací</strong> můžeš od smlouvy odstoupit kdykoli (napiš nám přes Tickety nebo použij vzorový formulář
          níže) a vrátíme ti celou zaplacenou částku nejpozději do 14 dnů stejným způsobem, jakým jsi platil(a).
        </p>
      </Sec>

      <Sec id="vraceni" n={10} title="Vrácení peněz – obecné pravidlo a záruka u předplatného">
        <p>
          <strong>Zaplacené částky obecně nevracíme.</strong> Peníze vracíme jen v těchto případech:
        </p>
        <Ul>
          <li>odstoupení před aktivací (bod 9),</li>
          <li>oprávněná reklamace, kterou nelze vyřešit nápravou (bod 11),</li>
          <li><strong>dobrovolná záruka vrácení peněz u předplatného</strong> (níže),</li>
          <li>ukončení nebo podstatné omezení placené služby z naší strany (bod 12),</li>
          <li>další případy, kdy to vyžaduje zákon.</li>
        </Ul>
        <p className="text-foreground font-semibold">Dobrovolná záruka vrácení peněz u předplatného</p>
        <p>
          Nad rámec zákona nabízíme u každého zaplaceného období předplatného (i u obnovení) možnost vrácení peněz, pokud jsou
          splněny <strong>všechny</strong> tyto podmínky:
        </p>
        <Ul>
          <li>
            o vrácení požádáš tlačítkem „Požádat o vrácení peněz“ v Obchodě → Software <strong>nejpozději do 30 minut od
            aktivace</strong> předplatného (čas aktivace a konec lhůty vidíš u předplatného a v potvrzení);
          </li>
          <li>
            předplatné tedy <strong>neběželo déle než 30 minut</strong> a <strong>program jsi nezačal(a) používat</strong> –
            za používání se nepovažuje stažení, instalace a první spuštění za účelem ověření, že program funguje;
          </li>
          <li>u stejného předplatného jsi záruku dosud neuplatnil(a) (záruku lze u jedné položky využít jen jednou).</li>
        </Ul>
        <p>
          Po podání žádosti se přístup k předplatnému <strong>okamžitě ukončí</strong>, automatické obnovení se vypne a jsi
          povinen(a) program odinstalovat a stažené kopie smazat. Peníze vrátíme stejným způsobem, jakým jsi platil(a), nejpozději
          do 14 dnů. Pro posouzení žádosti evidujeme čas aktivace, čas a počet stažení souboru. Zjevné zneužívání záruky (např.
          opakované nákupy a žádosti) může vést k jejímu odepření.
        </p>
        <p>
          Po uplynutí 30 minut záruka zaniká. <strong>Tím nejsou dotčena tvá zákonná práva z vadného plnění</strong> – pokud
          program nefunguje, postupuj podle bodu 11.
        </p>
      </Sec>

      <Sec id="reklamace" n={11} title="Práva z vadného plnění (reklamace)">
        <p>
          Odpovídáme za to, že digitální obsah odpovídá popisu, je funkční a dostáváš k němu aktualizace potřebné k zachování
          souladu se smlouvou – u předplatného po celou dobu jeho trvání, u jednorázového dodání po dobu stanovenou zákonem
          (§ 2389a a násl. občanského zákoníku).
        </p>
        <Ul>
          <li>Reklamaci uplatni bez zbytečného odkladu přes Tickety: popiš vadu, přilož snímek nebo log a uveď svůj systém.</li>
          <li>Reklamaci vyřídíme nejpozději do 30 dnů od jejího uplatnění a o výsledku tě informujeme.</li>
          <li>
            Máš právo na uvedení do souladu (oprava, aktualizace, náhradní soubor). Pokud to není možné, vada se opakuje nebo je
            podstatná, máš právo na přiměřenou slevu nebo odstoupení od smlouvy a vrácení peněz.
          </li>
          <li>
            Vadou není nesplnění systémových požadavků uvedených u položky na tvém zařízení (např. grafická karta s podporou
            Vulkan 1.1+), zásah do programu nebo jeho užití v rozporu s licencí.
          </li>
        </Ul>
      </Sec>

      <Sec id="ukonceni-sluzby" n={12} title="Ukončení služby z naší strany">
        <p>
          Pokud placenou službu ukončíme nebo ji podstatně omezíme, oznámíme to předem v účtu a vrátíme ti poměrnou část ceny za
          nevyčerpané období. Pokud ti přístup ukončíme kvůli podstatnému porušení <L to="/terms">Podmínek použití</L> nebo
          Licenčních podmínek, nárok na vrácení peněz nevzniká v rozsahu, v jakém to dovoluje zákon.
        </p>
      </Sec>

      <Sec id="licence" n={13} title="Licence a vlastnictví">
        <p>
          Nákupem nezískáváš vlastnictví ani autorská práva k digitálnímu obsahu, ale licenci k jeho užívání podle{" "}
          <L to="/licence">Licenčních podmínek</L>. Obsah je vázán na tvůj účet a nelze ho přeprodat, přenést ani sdílet.
        </p>
      </Sec>

      <Sec id="osobni-udaje" n={14} title="Osobní údaje">
        <p>
          Osobní údaje kupujících zpracováváme k uzavření a plnění smlouvy, k plnění právních povinností a k ochraně našich
          nároků (včetně záznamu souhlasů a evidence aktivace a stažení). Podrobnosti v{" "}
          <L to="/privacy">Zásadách ochrany osobních údajů</L>.
        </p>
      </Sec>

      <Sec id="spory" n={15} title="Mimosoudní řešení sporů a závěrečná ustanovení">
        <p>
          Spotřebitel může spor řešit mimosoudně u České obchodní inspekce, Ústřední inspektorát, Gorazdova 1969/24,
          120 00 Praha 2 (<a className="text-primary underline" href="https://coi.gov.cz/informace-o-adr/" target="_blank" rel="noreferrer">coi.gov.cz/informace-o-adr</a>).
          Smlouvy se řídí právem České republiky; ochranná ustanovení práva státu bydliště spotřebitele v EU nejsou dotčena.
        </p>
        <p>
          Obchodní podmínky můžeme měnit; změna nemá vliv na již uzavřené objednávky. U předplatného se nové znění použije od
          dalšího období, pokud ti změnu oznámíme nejméně 14 dní předem – s možností obnovení vypnout.
        </p>
      </Sec>

      <Sec id="formular" n={16} title="Vzorový formulář pro odstoupení od smlouvy">
        <p>(vyplň a pošli přes Tickety jen v případě, že chceš odstoupit od smlouvy před aktivací digitálního obsahu)</p>
        <div className="rounded-md border border-border/70 bg-background/40 p-4 space-y-1 font-mono text-xs">
          <p>Adresát: {op.name}, IČO {op.ico}{op.address ? `, ${op.address}` : ""}</p>
          <p>Oznamuji, že tímto odstupuji od smlouvy o dodání následujícího digitálního obsahu / poskytnutí služby:</p>
          <p>Název položky: ______________________</p>
          <p>Datum objednání: ______________________</p>
          <p>Jméno a uživatelské jméno na {op.site}: ______________________</p>
          <p>Způsob platby a údaje pro vrácení: ______________________</p>
          <p>Datum: ______________________</p>
        </div>
      </Sec>
    </LegalPage>
  );
};

export default BusinessTerms;
