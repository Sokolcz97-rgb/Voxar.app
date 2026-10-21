import { Link } from "react-router-dom";
import { FileBadge } from "lucide-react";
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

const LicenseTerms = () => {
  const op = useOperator();
  return (
    <LegalPage
      seoTitle={`Licenční podmínky — ${op.site}`}
      seoDescription="Licenční podmínky (EULA) pro software a digitální obsah StudioVoxario: Voxario Studio, Ashes of Eryon, launcher, aplikace, módy."
      eyebrow="Právní informace"
      title="Licenční podmínky softwaru"
      description={`Za jakých podmínek smíš používat naše programy, hry a digitální obsah. Verze ${LEGAL_VERSION}, účinná od ${LEGAL_EFFECTIVE}.`}
      icon={FileBadge}
      footer={
        <p>
          Verze {LEGAL_VERSION}, účinná od {LEGAL_EFFECTIVE} (pro stávající uživatele od {LEGAL_EFFECTIVE_EXISTING}). Licenční
          podmínky platí i tehdy, když je instalace nebo program zobrazí jen odkazem.
        </p>
      }
    >
      <Note>
        <strong>Stručně:</strong> Software ti neprodáváme, ale půjčujeme ti právo ho používat (licenci). Vlastníkem všech práv
        zůstává provozovatel. Nesmíš ho kopírovat pro jiné, prodávat, crackovat ani rozebírat. Co si sám/sama vytvoříš ve Voxario
        Studiu, je tvoje.
      </Note>

      <Sec id="poskytovatel" n={1} title="Poskytovatel licence">
        <OperatorBlock />
      </Sec>

      <Sec id="predmet" n={2} title="Na co se podmínky vztahují">
        <p>
          Na veškerý software a digitální obsah provozovatele („<strong>Software</strong>“): Voxario Studio (Engine a editor) včetně
          webového dema, hru Ashes of Eryon a její herní klient, launcher, desktopovou aplikaci StudioVoxario, VoxarioBrowser,
          VoxarioProtect, pluginy, kosmetické předměty, instalátory a jejich aktualizace, ukázkové projekty, modely, textury,
          zvuky a dokumentaci.
        </p>
        <p>
          Instalací, spuštěním nebo používáním Softwaru souhlasíš s těmito podmínkami a s <L to="/terms">Podmínkami použití</L>.
          Pokud nesouhlasíš, Software nepoužívej a odinstaluj ho.
        </p>
      </Sec>

      <Sec id="vlastnictvi" n={3} title="Vlastnictví">
        <p>
          Software je chráněn autorským zákonem a dalšími předpisy. Všechna práva k Softwaru, jeho zdrojovým kódům, struktuře,
          grafice, modelům, hudbě, textům, názvům a označením (StudioVoxario, Voxario, Voxario Studio, Voxar.app, Ashes of Eryon)
          vykonává provozovatel, případně jeho licenční partneři. <strong>Software se neprodává – poskytuje se licence.</strong>{" "}
          Všechna práva, která nejsou výslovně udělena, jsou vyhrazena.
        </p>
      </Sec>

      <Sec id="licence" n={4} title="Rozsah licence">
        <Ul>
          <li>
            Licence je <strong>nevýhradní, nepřenosná a bez práva udělit podlicenci</strong>, vázaná na tvůj účet, k užití Softwaru
            na zařízeních, která sám/sama používáš, v rozsahu jeho běžné funkce.
          </li>
          <li>
            <strong>Bezplatný Software</strong> (např. launcher, aplikace, hra v testovací fázi, webové demo): licence trvá, dokud
            ji neukončíme nebo dokud nezrušíš účet.
          </li>
          <li>
            <strong>Software v předplatném</strong> (např. Voxario Studio Engine): licence trvá po dobu zaplaceného předplatného podle{" "}
            <L to="/obchodni-podminky">Obchodních podmínek</L>. Po jeho skončení smíš Software dál užívat jen v rozsahu, v jakém to
            bez předplatného výslovně umožňujeme; jinak ho odinstaluj.
          </li>
          <li>
            <strong>Pluginy a kosmetické předměty</strong>: licence k užití v rámci účtu a Služeb, pro které jsou určeny.
          </li>
        </Ul>
      </Sec>

      <Sec id="omezeni" n={5} title="Co je zakázáno">
        <Ul>
          <li>poskytovat Software, instalátory, licenční kódy nebo přístup k účtu jiným osobám, prodávat je, pronajímat či půjčovat;</li>
          <li>kopírovat Software jinak než pro instalaci a nezbytnou záložní kopii;</li>
          <li>
            dekompilovat, zpětně analyzovat nebo rozebírat Software, s výjimkou případů, kdy to výslovně dovoluje § 66 autorského
            zákona (zajištění vzájemné funkčnosti);
          </li>
          <li>obcházet, vypínat nebo upravovat ochranu, licenční a bezpečnostní mechanismy (včetně VoxarioProtect) a vytvářet cracky;</li>
          <li>vytvářet a šířit cheaty, boty, exploity a neautorizované úpravy her;</li>
          <li>vyjímat z Softwaru modely, textury, zvuky, hudbu, kód či jiné součásti a používat je mimo Software;</li>
          <li>odstraňovat nebo měnit označení autora, licenční a copyright informace;</li>
          <li>vytěžovat texty a data ze Softwaru (včetně trénování AI) – práva podle § 39c odst. 3 autorského zákona jsou vyhrazena.</li>
        </Ul>
      </Sec>

      <Sec id="tvorba" n={6} title="Tvá tvorba ve Voxario Studiu">
        <p>
          <strong>Projekty, scény, modely, textury, kód a hry, které sám/sama vytvoříš ve Voxario Studiu, jsou tvé</strong> a můžeš
          je užívat i komerčně. Zodpovídáš za to, že máš práva k obsahu, který do projektů vkládáš.
        </p>
        <Ul>
          <li>
            Ukázkové projekty a assety dodané s programem smíš používat a upravovat jen jako součást svých projektů; samostatně
            je šířit ani prodávat nesmíš.
          </li>
          <li>
            Šířit hotové aplikace a hry, které obsahují běhové součásti Voxario Studia (runtime enginu), smíš jen na základě
            samostatné licence nebo podmínek, které pro to provozovatel zveřejní.
          </li>
          <li>Webové demo slouží jen k vyzkoušení; obsah v něm zůstává v tvém prohlížeči a neukládá se.</li>
        </Ul>
      </Sec>

      <Sec id="mody" n={7} title="Módy do Ashes of Eryon">
        <Ul>
          <li>Módy smíš vytvářet pomocí oficiálního rozhraní (Lua API) a bezplatně je sdílet s ostatními hráči.</li>
          <li>Prodej módů nebo přístupu k nim je bez písemného souhlasu provozovatele zakázán.</li>
          <li>Mód nesmí dávat nepoctivou výhodu, sbírat údaje jiných hráčů, obcházet ochranu ani obsahovat cizí chráněný obsah.</li>
          <li>Módy jsou tvým obsahem podle <L to="/terms">Podmínek použití</L>; provozovatel je může zablokovat nebo odstranit.</li>
          <li>Herní assety provozovatele smí mód používat jen prostřednictvím rozhraní hry, ne jejich vyjmutím a šířením.</li>
        </Ul>
      </Sec>

      <Sec id="aktualizace" n={8} title="Aktualizace a online funkce">
        <p>
          Launcher a aplikace automaticky stahují aktualizace. Některé funkce vyžadují připojení k internetu a přihlášení.
          Software může odesílat technické údaje potřebné k fungování, bezpečnosti a opravám chyb (verze, crash reporty, kontroly
          VoxarioProtect) – podrobnosti v <L to="/privacy">Zásadách ochrany osobních údajů</L>.
        </p>
      </Sec>

      <Sec id="treti-strany" n={9} title="Komponenty třetích stran">
        <p>
          Software obsahuje komponenty třetích stran, které se řídí vlastními licencemi (např. Unity Engine u hry Ashes of Eryon,
          Electron, MoonSharp – licence BSD, Three.js, glTFast, Vulkan SDK, Dear ImGui, Assimp). Tyto licence mají u příslušných
          komponent přednost; jejich seznam je součástí instalace nebo ho poskytneme na vyžádání.
        </p>
      </Sec>

      <Sec id="zaruka" n={10} title="Záruka a odpovědnost">
        <p>
          Bezplatný a testovací Software poskytujeme tak, jak je, bez záruky. U placeného Softwaru máš práva z vadného plnění podle{" "}
          <L to="/obchodni-podminky">Obchodních podmínek</L>. Dodržuj systémové požadavky a zálohuj své projekty. V rozsahu
          dovoleném zákonem neodpovídáme za ztrátu dat a nepřímé škody; odpovědnost za úmysl, hrubou nedbalost a nevylučitelná
          práva spotřebitele tím není dotčena.
        </p>
      </Sec>

      <Sec id="ukonceni" n={11} title="Ukončení licence">
        <p>
          Při porušení těchto podmínek licence zaniká a jsi povinen/povinna Software odinstalovat a smazat jeho kopie. Provozovatel
          může zablokovat přístup k online funkcím a účtu. Licence zaniká také zrušením účtu nebo skončením předplatného.
        </p>
      </Sec>

      <Sec id="pravo" n={12} title="Rozhodné právo">
        <p>
          Podmínky se řídí právem České republiky, zejména autorským zákonem a občanským zákoníkem. Práva spotřebitele, která nelze
          smluvně omezit, nejsou dotčena.
        </p>
      </Sec>
    </LegalPage>
  );
};

export default LicenseTerms;
