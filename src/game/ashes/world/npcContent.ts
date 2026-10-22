import type { Faction } from "../types";
import type { NpcId } from "./map";

type T = { cs: string; en: string };

export type WQuestDef = {
  id: string;
  faction: Faction;
  giver: NpcId;
  type: "talk" | "kill" | "beacon" | "visit";
  target: string;
  count: number;
  req: string[];
  title: T;
  offer: T;
  objective: T;
  done: T;
  /** NPC, za kterým je třeba dojít (u úkolů typu talk), nebo místo na mapě. */
  goal?: { npc?: NpcId; place?: "beacons" | "memorial" | "region"; region?: string };
};

/** Úkoly od NPC – pravidla drží server (ashes_wq_catalog), texty jsou tady. */
export const WQUESTS: WQuestDef[] = [
  {
    id: "k1", faction: "kalidra", giver: "nikias", type: "talk", target: "nikias", count: 1, req: [],
    title: { cs: "Probuzení", en: "Awakening" },
    offer: { cs: "Moře tě vyplavilo do mé sítě, chlapče. Myslel jsem, že lovím rybu, a vytáhl jsem válečníka. Víš vůbec, kde jsi?", en: "The sea washed you into my net, lad. I thought I'd caught a fish and pulled out a warrior. Do you even know where you are?" },
    objective: { cs: "Promluv si s Nikiasem", en: "Talk to Nikias" },
    done: { cs: "Tohle je Bezejmenný břeh. Ta světla na východě? To je Kalidra. A ty ohně na kopcích… ty se rozhořely až dnes večer. Něco se blíží.", en: "This is the Nameless Shore. Those lights to the east? That's Kalidra. And the fires on the hills… they only blazed up tonight. Something is coming." },
  },
  {
    id: "k2", faction: "kalidra", giver: "nikias", type: "kill", target: "vrakar", count: 3, req: ["k1"],
    title: { cs: "Vrakaři z břehu", en: "Wreckers of the Shore" },
    offer: { cs: "Vrakaři se hrabou v troskách tvé lodi. Kdo nemá svědky, nemusí se nikomu zodpovídat. Ukaž jim, že svědek přežil.", en: "Wreckers are picking through the wreck of your ship. Those without witnesses answer to no one. Show them a witness survived." },
    objective: { cs: "Poraz vrakaře na břehu", en: "Defeat wreckers on the shore" },
    done: { cs: "Tři vrakaři v příboji. Moře si je vezme zpátky. Vezmi si tohle – kalidrský bronz se ti bude hodit.", en: "Three wreckers in the surf. The sea will take them back. Take this – Kalidran bronze will serve you well." },
    goal: { place: "region", region: "shore" },
  },
  {
    id: "k3", faction: "kalidra", giver: "nikias", type: "talk", target: "damon", count: 1, req: ["k1"],
    title: { cs: "Cesta ke Kalidře", en: "The Road to Kalidra" },
    offer: { cs: "Jdi po cestě kolem akvaduktu až k bráně. Najdi Damona, velitele hradeb. Řekni mu, že tě posílá starý Nikias – a že na kopcích hoří ohně.", en: "Follow the road past the aqueduct to the gate. Find Damon, commander of the walls. Tell him old Nikias sent you – and that fires burn on the hills." },
    objective: { cs: "Ohlas se Damonovi u brány Kalidry", en: "Report to Damon at the gate of Kalidra" },
    done: { cs: "Nikias tě posílá? Ten starý lišák nikdy nevytáhl ze sítě nic zbytečného. Potřebuju každou ruku, co udrží kopí.", en: "Nikias sent you? That old fox never pulled anything useless out of his nets. I need every hand that can hold a spear." },
    goal: { npc: "damon" },
  },
  {
    id: "k4", faction: "kalidra", giver: "damon", type: "beacon", target: "beacon", count: 3, req: ["k3"],
    title: { cs: "Strážní ohně", en: "Watchfires" },
    offer: { cs: "Když rudé slunce kleslo k moři, na kopcích měly vzplát všechny strážní ohně. Hoří jen některé. Zapal všechny tři vatry, ať je vidí celé pobřeží.", en: "When the red sun sank into the sea, every watchfire on the hills should have blazed. Only some burn. Light all three beacons so the whole coast can see them." },
    objective: { cs: "Zapal strážní vatry na kopcích", en: "Light the watchfires on the hills" },
    done: { cs: "Vidím je odsud. Tři ohně – a celá Kalidra je vidí taky. Teď už nikdo nebude spát.", en: "I can see them from here. Three fires – and all of Kalidra sees them too. No one will sleep now." },
    goal: { place: "beacons" },
  },
  {
    id: "k5", faction: "kalidra", giver: "damon", type: "kill", target: "zved-legie", count: 4, req: ["k3"],
    title: { cs: "Zvědové Legie", en: "Legion Scouts" },
    offer: { cs: "Na kopcích se plíží zvědové Rudého slunce. Počítají naše kopí a hledají slabé místo v hradbách. Ať se jejich pán nedozví nic.", en: "Red Sun scouts are creeping over the hills. They count our spears and look for a weak point in the walls. Let their master learn nothing." },
    objective: { cs: "Poraz zvědy Rudého slunce na kopcích", en: "Defeat Red Sun scouts in the hills" },
    done: { cs: "Čtyři zvědové, kteří už nic neřeknou. Dobrá práce. Ale za nimi přijde tisíc kopí.", en: "Four scouts who will say nothing more. Good work. But a thousand spears will come behind them." },
    goal: { place: "region", region: "hills" },
  },
  {
    id: "k6", faction: "kalidra", giver: "tharos", type: "kill", target: "lapka", count: 3, req: ["k1"],
    title: { cs: "Bronz pro štíty", en: "Bronze for Shields" },
    offer: { cs: "Lapkové u akvaduktu kradou bronz z vozů, co jedou do města. Bez bronzu nebudou štíty. Přines mi ho zpátky.", en: "The bandits at the aqueduct steal bronze from the carts bound for the city. No bronze, no shields. Bring it back to me." },
    objective: { cs: "Vezmi bronz lapkům u akvaduktu", en: "Take the bronze back from the aqueduct bandits" },
    done: { cs: "Bronz se nevrací. Bronz jde jen vpřed. Tenhle půjde do štítů.", en: "Bronze does not go back. Bronze only goes forward. This goes into shields." },
    goal: { place: "region", region: "aqueduct" },
  },
  {
    id: "k7", faction: "kalidra", giver: "thalia", type: "visit", target: "memorial", count: 1, req: ["k3"],
    title: { cs: "Jména v prachu", en: "Names in the Dust" },
    offer: { cs: "Na pláni před branou stojí kámen se jmény těch, kdo padli v minulých válkách. Jdi k němu a vzpomeň si na ně. Kámen si pamatuje – ale potřebuje, aby si pamatovali i lidé.", en: "On the plain before the gate stands a stone bearing the names of those who fell in past wars. Go to it and remember them. The stone remembers – but it needs people to remember too." },
    objective: { cs: "Dojdi k pamětnímu kameni na pláni", en: "Visit the memorial stone on the plain" },
    done: { cs: "Byl jsi tam. Teď víš, proč se nikdo z nás neohne. Moře si pamatuje. Kámen si pamatuje.", en: "You went. Now you know why none of us will bend. The sea remembers. The stone remembers." },
    goal: { place: "memorial" },
  },
  {
    id: "k8", faction: "kalidra", giver: "eryon", type: "talk", target: "eryon", count: 1, req: ["k4", "k5"],
    title: { cs: "Hlas Eryona", en: "The Voice of Eryon" },
    offer: { cs: "Zapálil jsi ohně a umlčel zvědy. Damon o tobě mluví. Já nejsem král ani bůh – jen muž, který stojí před svou branou. Postavíš se vedle mě?", en: "You lit the fires and silenced the scouts. Damon speaks of you. I am neither king nor god – just a man who stands before his gate. Will you stand beside me?" },
    objective: { cs: "Postav se do řady po boku Eryona", en: "Take your place in the line beside Eryon" },
    done: { cs: "Pak zvedni štít. Dokud jeden z nás stojí, Kalidra nepadne.", en: "Then raise your shield. While one of us still stands, Kalidra will not fall." },
  },
  {
    id: "l1", faction: "legie", giver: "varkas", type: "talk", target: "varkas", count: 1, req: [],
    title: { cs: "Vylodění", en: "The Landing" },
    offer: { cs: "Konečně pevná zem. Nestůj tu jak kůl, vojáku. Víš, proč nás Azkar vysadil zrovna tady?", en: "Solid ground at last. Don't stand there like a post, soldier. Do you know why Azkar put us ashore right here?" },
    objective: { cs: "Promluv si se setníkem Varkasem", en: "Talk to Centurion Varkas" },
    done: { cs: "Protože tady nás nikdo nečeká. Na východě je Kalidra – bohaté město s bronzovými štíty. Do zítřka chce Azkar znát každou cestu k jejím branám.", en: "Because no one expects us here. To the east lies Kalidra – a rich city of bronze shields. By tomorrow Azkar wants to know every road to its gates." },
  },
  {
    id: "l2", faction: "legie", giver: "varkas", type: "kill", target: "strazny-utesy", count: 3, req: ["l1"],
    title: { cs: "Hlídka na útesech", en: "The Cliff Watch" },
    offer: { cs: "Na útesech nad zátokou sedí kalidrští strážní. Jestli zapálí signální oheň, je po překvapení. Umlč je.", en: "Kalidran sentries sit on the cliffs above the bay. If they light a signal fire, the surprise is over. Silence them." },
    objective: { cs: "Poraz strážné z útesů", en: "Defeat the cliff sentries" },
    done: { cs: "Ticho na útesech. Tak to má být. Rudé slunce si tě všimlo.", en: "Silence on the cliffs. As it should be. The Red Sun has noticed you." },
    goal: { place: "region", region: "cove" },
  },
  {
    id: "l3", faction: "legie", giver: "varkas", type: "talk", target: "oren", count: 1, req: ["l1"],
    title: { cs: "Do tábora", en: "To the Camp" },
    offer: { cs: "Jdi po hřebeni na východ do tábora Legie. Ohlas se knězi Orenovi – on ví, co Azkar chystá.", en: "Follow the ridge east to the Legion camp. Report to the priest Oren – he knows what Azkar is planning." },
    objective: { cs: "Ohlas se knězi Orenovi v táboře Legie", en: "Report to the priest Oren in the Legion camp" },
    done: { cs: "Varkas tě posílá. Dobře. Rudé slunce zapadá do moře každý večer – a každé ráno vychází znovu. Tak jako my.", en: "Varkas sent you. Good. The red sun sinks into the sea every evening – and every morning it rises again. As do we." },
    goal: { npc: "oren" },
  },
  {
    id: "l4", faction: "legie", giver: "oren", type: "beacon", target: "beacon", count: 3, req: ["l3"],
    title: { cs: "Zhasnout ohně", en: "Put Out the Fires" },
    offer: { cs: "Na kopcích hoří strážní vatry Kalidry. Dokud hoří, město vidí každý náš krok. Zhasni všechny tři.", en: "Kalidra's watchfires burn on the hills. While they burn, the city sees our every step. Put out all three." },
    objective: { cs: "Zhasni strážní vatry na kopcích", en: "Put out the watchfires on the hills" },
    done: { cs: "Tma nad kopci. Kalidra oslepla. Azkar bude spokojen.", en: "Darkness over the hills. Kalidra is blind. Azkar will be pleased." },
    goal: { place: "beacons" },
  },
  {
    id: "l5", faction: "legie", giver: "oren", type: "kill", target: "zved-kalidra", count: 4, req: ["l3"],
    title: { cs: "Kalidrští zvědové", en: "Kalidran Scouts" },
    offer: { cs: "Eryonovi zvědové nás sledují z hřebene. Poraz je, než přinesou zprávu o našem počtu.", en: "Eryon's scouts watch us from the ridge. Defeat them before they carry word of our numbers." },
    objective: { cs: "Poraz kalidrské zvědy na kopcích", en: "Defeat Kalidran scouts in the hills" },
    done: { cs: "Žádné zprávy nedojdou. Teď jdi za Azkarem. Chce tě vidět.", en: "No word will reach them. Now go to Azkar. He wants to see you." },
    goal: { place: "region", region: "hills" },
  },
  {
    id: "l6", faction: "legie", giver: "azkar", type: "talk", target: "azkar", count: 1, req: ["l4", "l5"],
    title: { cs: "Slovo vojevůdce", en: "The Warlord's Word" },
    offer: { cs: "Ty jsi ten, kdo zhasl ohně? Před branou Kalidry stojí muž jménem Eryon. Říkají mu poslední štít. Zítra zjistíme, jestli je to pravda. Půjdeš se mnou?", en: "You are the one who put out the fires? Before the gate of Kalidra stands a man named Eryon. They call him the last shield. Tomorrow we find out if it's true. Will you come with me?" },
    objective: { cs: "Postav se po boku Azkara", en: "Stand beside Azkar" },
    done: { cs: "Pak zítra půjdeme k bráně spolu. Rudé slunce vychází nad Kalidrou.", en: "Then tomorrow we go to the gate together. The red sun rises over Kalidra." },
  },
  {
    id: "l7", faction: "legie", giver: "rukmar", type: "kill", target: "strazce-akvaduktu", count: 3, req: ["l1"],
    title: { cs: "Cesta přes akvadukt", en: "The Aqueduct Road" },
    offer: { cs: "Kalidrští strážci drží most pod akvaduktem. Jejich bronz je dobrý – přines mi ho a ukovám z něj něco pro Legii.", en: "Kalidran wardens hold the crossing beneath the aqueduct. Their bronze is good – bring it to me and I'll forge something for the Legion." },
    objective: { cs: "Poraz strážce akvaduktu", en: "Defeat the aqueduct wardens" },
    done: { cs: "Kalidrský bronz. Po kalení v moři bude černý jako naše plachty.", en: "Kalidran bronze. Quenched in the sea it will be as black as our sails." },
    goal: { place: "region", region: "aqueduct" },
  },
  {
    id: "k9", faction: "kalidra", giver: "gorgias", type: "kill", target: "pasarak", count: 3, req: ["k1"],
    title: { cs: "Pašeráci z útesů", en: "Smugglers of the Cliffs" },
    offer: { cs: "Pašeráci z útesů mi prodávají víno ředěné mořskou vodou a ještě se smějí. Dej jim lekci – a jestli u nich najdeš nějaký džbán, nesu ho na tvůj účet.", en: "The cliff smugglers sell me wine thinned with seawater and laugh about it. Teach them a lesson – and if you find a jug on them, it's on the house." },
    objective: { cs: "Poraz pašeráky na pobřeží", en: "Defeat the smugglers on the shore" },
    done: { cs: "Ha! Tak tohle víno je aspoň poctivě kyselé. Na zdraví, hrdino.", en: "Ha! At least this wine is honestly sour. To your health, hero." },
    goal: { place: "region", region: "shore" },
  },
  {
    id: "k10", faction: "kalidra", giver: "melos", type: "talk", target: "pylas", count: 1, req: ["k3"],
    title: { cs: "Píseň pro strážného", en: "A Song for the Sentry" },
    offer: { cs: "Pylas drží stráž u strážních ohňů už třetí noc. Napsal jsem mu píseň, ať mu nezamrzne srdce. Doneseš mu ji? Já bych cestou zpíval a prozradil ho.", en: "Pylas has kept watch by the beacons for three nights. I wrote him a song so his heart won't freeze. Will you take it to him? I would sing on the way and give him away." },
    objective: { cs: "Doruč píseň strážnému Pylasovi u strážních ohňů", en: "Deliver the song to Pylas by the beacons" },
    done: { cs: "Melos? Ten blázen. … Díky. Je to dobrá píseň.", en: "Melos? That fool. … Thank you. It is a good song." },
    goal: { npc: "pylas" },
  },
  {
    id: "k11", faction: "kalidra", giver: "pylas", type: "kill", target: "predvoj", count: 4, req: ["k5"],
    title: { cs: "Předvoj na kopcích", en: "The Vanguard on the Hills" },
    offer: { cs: "Ze strážní věže vidím jejich předvoj. Čtyři muži, kopí a štíty s rudým sluncem. Jestli se usadí na kopcích, odříznou nám ohně.", en: "From the watchtower I can see their vanguard. Four men, spears and shields with a red sun. If they dig in on the hills, they'll cut off our fires." },
    objective: { cs: "Rozbij předvoj Legie na kopcích", en: "Break the Legion vanguard on the hills" },
    done: { cs: "Kopce jsou zase naše. Ohně budou hořet dál.", en: "The hills are ours again. The fires will keep burning." },
    goal: { place: "region", region: "hills" },
  },
  {
    id: "k12", faction: "kalidra", giver: "thalia", type: "kill", target: "kultista", count: 3, req: ["k7"],
    title: { cs: "Popel v akvaduktu", en: "Ash in the Aqueduct" },
    offer: { cs: "U akvaduktu se schází kultisté popela. Sypou do vody popel a modlí se k Rudému slunci. Voda, kterou pije Kalidra, nesmí nést jejich kletbu.", en: "Cultists of ash gather at the aqueduct. They pour ash into the water and pray to the Red Sun. The water Kalidra drinks must not carry their curse." },
    objective: { cs: "Rozežeň kultisty popela u akvaduktu", en: "Scatter the ash cultists at the aqueduct" },
    done: { cs: "Moře přijalo jejich popel a vrátilo nám čistou vodu. Bohové vidí tvou ruku.", en: "The sea took their ash and gave us back clean water. The gods see your hand." },
    goal: { place: "region", region: "aqueduct" },
  },
  {
    id: "k13", faction: "kalidra", giver: "damon", type: "kill", target: "kopinik", count: 4, req: ["k8"],
    title: { cs: "Kopí na pláni", en: "Spears on the Plain" },
    offer: { cs: "Legie už nestojí na kopcích – je na pláni před branou. Kopiníci Rudého slunce zkoušejí, jak blízko k hradbám se odváží. Ukaž jim, kde končí.", en: "The Legion no longer waits on the hills – it is on the plain before the gate. The Red Sun spearmen are testing how close to the walls they dare. Show them where it ends." },
    objective: { cs: "Poraz kopiníky Rudého slunce na pláni", en: "Defeat the Red Sun spearmen on the plain" },
    done: { cs: "Tohle si budou pamatovat. A já si budu pamatovat tebe.", en: "They will remember this. And I will remember you." },
    goal: { place: "region", region: "plain" },
  },
  {
    id: "k14", faction: "kalidra", giver: "eryon", type: "kill", target: "knez-slunce", count: 3, req: ["k13"],
    title: { cs: "Kněží Rudého slunce", en: "Priests of the Red Sun" },
    offer: { cs: "Jejich kněží chodí mezi vojáky a slibují jim, že Kalidra hoří už teď, jen to ještě nevíme. Strach je jejich nejlepší zbraň. Vezmi jim ji.", en: "Their priests walk among the soldiers promising that Kalidra is already burning, we just don't know it yet. Fear is their best weapon. Take it from them." },
    objective: { cs: "Umlč kněze Rudého slunce na pláni", en: "Silence the Red Sun priests on the plain" },
    done: { cs: "Bez kněží jsou to jen muži, co se bojí stejně jako my. S takovými se dá bojovat.", en: "Without priests they are just men who fear as we do. Men like that can be fought." },
    goal: { place: "region", region: "plain" },
  },
  {
    id: "k15", faction: "kalidra", giver: "damon", type: "kill", target: "strazce-lodi", count: 3, req: ["k13"],
    title: { cs: "Černé lodě", en: "The Black Ships" },
    offer: { cs: "V zátoce kotví černé lodě Legie. Dokud tam jsou, mohou kdykoli přivézt další tisíc kopí. Stráže lodí jsou jejich nejlepší muži – ale i ti krvácí.", en: "The Legion's black ships lie at anchor in the cove. While they are there, they can bring another thousand spears at any time. The ship guards are their best men – but even they bleed." },
    objective: { cs: "Poraz strážce černých lodí v zátoce", en: "Defeat the guards of the black ships in the cove" },
    done: { cs: "Plachty hoří. Azkar dnes v noci nebude spát.", en: "The sails are burning. Azkar will not sleep tonight." },
    goal: { place: "region", region: "cove" },
  },
  {
    id: "k16", faction: "kalidra", giver: "eryon", type: "kill", target: "garda", count: 3, req: ["k14", "k15"],
    title: { cs: "Azkarova garda", en: "Azkar's Guard" },
    offer: { cs: "Zbývá jeho garda. Muži, kteří s ním přišli přes moře a nikdy neustoupili. Nežádám tě, abys šel sám – žádám tě, abys šel první.", en: "Only his guard remains. Men who crossed the sea with him and never retreated. I don't ask you to go alone – I ask you to go first." },
    objective: { cs: "Poraz Azkarovu gardu v táboře Legie", en: "Defeat Azkar's guard in the Legion camp" },
    done: { cs: "Dnes jsi nebojoval za Kalidru. Dnes jsi byl Kalidra.", en: "Today you did not fight for Kalidra. Today you were Kalidra." },
    goal: { place: "region", region: "camp" },
  },
  {
    id: "l8", faction: "legie", giver: "sabra", type: "kill", target: "rybar", count: 3, req: ["l1"],
    title: { cs: "Ryby a harpuny", en: "Fish and Harpoons" },
    offer: { cs: "Rybáři z břehu nám nechtějí prodat ani šupinu. Prý radši nakrmí moře. Tak ať ho nakrmí – a jejich úlovek ať skončí v našem kotli.", en: "The shore fishermen won't sell us a single scale. They say they would rather feed the sea. Then let them – and let their catch end up in our pot." },
    objective: { cs: "Poraz rybáře s harpunami na pobřeží", en: "Defeat the harpoon fishermen on the shore" },
    done: { cs: "Dnes se v táboře nají i bubeníci. To ti nezapomenou.", en: "Tonight even the drummers will eat. They won't forget it." },
    goal: { place: "region", region: "shore" },
  },
  {
    id: "l9", faction: "legie", giver: "taras", type: "talk", target: "rukmar", count: 1, req: ["l3"],
    title: { cs: "Buben a kovadlina", en: "Drum and Anvil" },
    offer: { cs: "Můj buben praskl, když jsme vystupovali z lodí. Bez bubnu neudržím krok legie. Zajdi za kovářem Rukmarem, ať mi ukove nové obruče.", en: "My drum cracked when we came ashore. Without a drum I can't keep the Legion's step. Go to Rukmar the smith and have him forge new hoops." },
    objective: { cs: "Promluv si s kovářem Rukmarem o bubnu", en: "Speak to Rukmar the smith about the drum" },
    done: { cs: "Bubeník? Zase? Dobře, ať si pro obruče přijde. Rudé slunce potřebuje rytmus.", en: "The drummer? Again? Fine, let him come for the hoops. The Red Sun needs a rhythm." },
    goal: { npc: "rukmar" },
  },
  {
    id: "l10", faction: "legie", giver: "rukmar", type: "kill", target: "knezka", count: 3, req: ["l7"],
    title: { cs: "Kněžky přílivu", en: "Priestesses of the Tide" },
    offer: { cs: "Kněžky přílivu žehnají kalidrským zbraním u akvaduktu. Jejich požehnání tupí naše ostří – aspoň to vojáci říkají. Ať tomu přestanou věřit.", en: "The tide priestesses bless Kalidran weapons at the aqueduct. Their blessing dulls our blades – or so the soldiers say. Make them stop believing it." },
    objective: { cs: "Poraz kněžky přílivu u akvaduktu", en: "Defeat the tide priestesses at the aqueduct" },
    done: { cs: "Žádné požehnání. Jen dobře zakalená ocel. Tak.", en: "No blessing. Just well-tempered steel. There." },
    goal: { place: "region", region: "aqueduct" },
  },
  {
    id: "l11", faction: "legie", giver: "oren", type: "kill", target: "strazce-ohne", count: 4, req: ["l5"],
    title: { cs: "Strážci ohně", en: "Keepers of the Fire" },
    offer: { cs: "Zhasnuté vatry znovu zapalují strážci ohně. Dokud žijí, Kalidra uvidí každý náš krok. Rudé slunce nesnese cizí plamen.", en: "The keepers of the fire relight the beacons we put out. While they live, Kalidra sees our every step. The Red Sun suffers no other flame." },
    objective: { cs: "Poraz strážce ohně na kopcích", en: "Defeat the fire keepers on the hills" },
    done: { cs: "Kopce jsou temné. Jen naše slunce na nich svítí.", en: "The hills are dark. Only our sun shines on them." },
    goal: { place: "region", region: "hills" },
  },
  {
    id: "l12", faction: "legie", giver: "varkas", type: "kill", target: "obrance", count: 4, req: ["l6"],
    title: { cs: "Obránci brány", en: "Defenders of the Gate" },
    offer: { cs: "Azkar chce pláň před branou. Obránci Kalidry tam stojí ve štítové hradbě a myslí si, že jsou skála. Ukaž jim, že i skála puká.", en: "Azkar wants the plain before the gate. Kalidra's defenders stand there in a shield wall and think they are rock. Show them that even rock cracks." },
    objective: { cs: "Poraz obránce Kalidry na pláni", en: "Defeat Kalidra's defenders on the plain" },
    done: { cs: "Jejich štíty jsou v blátě. Pláň patří Rudému slunci.", en: "Their shields are in the mud. The plain belongs to the Red Sun." },
    goal: { place: "region", region: "plain" },
  },
  {
    id: "l13", faction: "legie", giver: "azkar", type: "kill", target: "knez-kalidry", count: 3, req: ["l12"],
    title: { cs: "Kněží Kalidry", en: "The Priests of Kalidra" },
    offer: { cs: "Jejich kněží vykládají o Eryonovi, jako by byl bůh. Není. Je to muž. A muži padají. Umlč ty, kdo z něj dělají víc.", en: "Their priests speak of Eryon as if he were a god. He is not. He is a man. And men fall. Silence those who make him more." },
    objective: { cs: "Umlč kněze Kalidry na pláni", en: "Silence the priests of Kalidra on the plain" },
    done: { cs: "Teď uvidí, že jejich štít je jen bronz. Bronz se ohýbá.", en: "Now they will see their shield is only bronze. Bronze bends." },
    goal: { place: "region", region: "plain" },
  },
  {
    id: "l14", faction: "legie", giver: "azkar", type: "kill", target: "straz-kalidry", count: 3, req: ["l12", "l13"],
    title: { cs: "Stráž Kalidry", en: "The Guard of Kalidra" },
    offer: { cs: "Je čas zaklepat na bránu. Stráž Kalidry je poslední, co stojí mezi námi a městem. Jdi první. Rudé slunce půjde za tebou.", en: "It is time to knock on the gate. Kalidra's guard is all that stands between us and the city. Go first. The Red Sun will follow you." },
    objective: { cs: "Poraz stráž Kalidry u hradeb města", en: "Defeat the guard of Kalidra at the city walls" },
    done: { cs: "Brána se otřásla. Dnes jsi nebojoval za Legii. Dnes jsi byl Legie.", en: "The gate shook. Today you did not fight for the Legion. Today you were the Legion." },
    goal: { place: "region", region: "kalidra" },
  },
];

export type NpcTalk = { greet: T; lore: { q: T; a: T }[] };

export const NPC_TALK: Record<NpcId, NpcTalk> = {
  nikias: {
    greet: { cs: "Moře dneska nevypadá dobře. Rudé jako krev.", en: "The sea doesn't look good today. Red as blood." },
    lore: [
      { q: { cs: "Co je Bezejmenný břeh?", en: "What is the Nameless Shore?" }, a: { cs: "Břeh, kam moře vyhazuje, co si nechce nechat. Lodě, lidi, jména. Proto nemá jméno ani on.", en: "A shore where the sea throws whatever it won't keep. Ships, people, names. That's why it has no name of its own." } },
      { q: { cs: "Kdo je Eryon?", en: "Who is Eryon?" }, a: { cs: "Válečník z Kalidry. Žádný král. Ale když na hradby přijde bouře, všichni se dívají na něj.", en: "A warrior of Kalidra. No king. But when a storm reaches the walls, everyone looks to him." } },
    ],
  },
  damon: {
    greet: { cs: "Hradby jsou staré, ale pevné. Jako já. Co potřebuješ?", en: "The walls are old, but strong. Like me. What do you need?" },
    lore: [
      { q: { cs: "Kdo jsou útočníci?", en: "Who are the attackers?" }, a: { cs: "Legie Rudého slunce. Přišli z hor a od moře s černými loděmi. Vede je Azkar a říká se, že nikdy neprohrál.", en: "The Legion of the Red Sun. They came from the mountains and over the sea in black ships. Azkar leads them, and they say he has never lost." } },
      { q: { cs: "Vydrží hradby?", en: "Will the walls hold?" }, a: { cs: "Hradby vydrží, dokud na nich budou stát lidé. Každé vítězství obránců je zpevní.", en: "The walls hold as long as people stand on them. Every victory by the defenders makes them stronger." } },
    ],
  },
  eryon: {
    greet: { cs: "Kámen si pamatuje. Moře si pamatuje. A já si pamatuju každého, kdo stál vedle mě.", en: "The stone remembers. The sea remembers. And I remember everyone who stood beside me." },
    lore: [
      { q: { cs: "Proč bojuješ?", en: "Why do you fight?" }, a: { cs: "Ne kvůli slávě. Ne pro zlato. Za děti, co spí za hradbami. Za staré otce. Za domov.", en: "Not for glory. Not for gold. For the children asleep behind the walls. For the old fathers. For home." } },
      { q: { cs: "Bojíš se?", en: "Are you afraid?" }, a: { cs: "Smrti ne. Bojím se jen toho, že by Kalidra padla beze mě.", en: "Not of death. I only fear that Kalidra would fall without me." } },
    ],
  },
  gorgias: {
    greet: { cs: "Vítej U Zlomeného vesla! Víno je kyselé, ale práce je dost.", en: "Welcome to the Broken Oar! The wine is sour, but there's plenty of work." },
    lore: [{ q: { cs: "Proč Zlomené veslo?", en: "Why the Broken Oar?" }, a: { cs: "Můj děd přežil ztroskotání s jediným zlomeným veslem. Pověsil ho nad dveře a otevřel krčmu.", en: "My grandfather survived a shipwreck holding a single broken oar. He hung it over the door and opened a tavern." } }],
  },
  tharos: {
    greet: { cs: "Bronz se nevrací. Bronz jde jen vpřed. Co si vybereš?", en: "Bronze doesn't go back. Bronze only goes forward. What will you choose?" },
    lore: [{ q: { cs: "Odkud je váš bronz?", en: "Where is your bronze from?" }, a: { cs: "Měď z hor, cín od moře. Když Legie zavře cesty, nebude ani jedno.", en: "Copper from the mountains, tin from over the sea. If the Legion closes the roads, there'll be neither." } }],
  },
  thalia: {
    greet: { cs: "Moře dává i bere. Já si pamatuju jména těch, které vzalo.", en: "The sea gives and takes. I remember the names of those it took." },
    lore: [{ q: { cs: "Komu slouží chrám?", en: "Whom does the temple serve?" }, a: { cs: "Moři. Kalidra stojí na jeho břehu tisíc let. Dokud si ho pamatujeme, ono si pamatuje nás.", en: "The sea. Kalidra has stood on its shore for a thousand years. While we remember it, it remembers us." } }],
  },
  melos: {
    greet: { cs: "Chceš slyšet píseň o posledním štítu? Ještě není dopsaná. Konec teprve přijde.", en: "Do you want to hear the song of the last shield? It isn't finished yet. The ending is still to come." },
    lore: [],
  },
  pylas: {
    greet: { cs: "Hlídám první oheň. Kdyby zhasl, celé pobřeží by osleplo.", en: "I guard the first fire. If it went out, the whole coast would go blind." },
    lore: [{ q: { cs: "Kolik je vater?", en: "How many beacons are there?" }, a: { cs: "Tři. Tahle u mě, druhá na nejvyšším kopci a třetí nad cestou k táboru… k tomu, co tam teď stojí.", en: "Three. This one here, the second on the highest hill, and the third above the road to the camp… to whatever stands there now." } }],
  },
  "arena-k": {
    greet: { cs: "Kruh kamenů je starší než hradby. Tady se obránci měří mezi sebou – i s nepřáteli.", en: "The stone circle is older than the walls. Here defenders test themselves – against each other, and against enemies." },
    lore: [],
  },
  varkas: {
    greet: { cs: "Rudé slunce tě vidí, vojáku. Neplýtvej jeho světlem.", en: "The Red Sun sees you, soldier. Don't waste its light." },
    lore: [
      { q: { cs: "Proč útočíme na Kalidru?", en: "Why do we attack Kalidra?" }, a: { cs: "Kalidra drží jediný přístav na tomhle pobřeží. Kdo má přístav, má moře. A kdo má moře, má všechno.", en: "Kalidra holds the only harbour on this coast. Whoever holds the harbour holds the sea. And whoever holds the sea holds everything." } },
      { q: { cs: "Kdo je Azkar?", en: "Who is Azkar?" }, a: { cs: "Syn Rudého slunce. Vyrostl v horách a nikdy neprohrál bitvu. Váží si silných – i kdyby stáli proti němu.", en: "Son of the Red Sun. He grew up in the mountains and has never lost a battle. He respects the strong – even if they stand against him." } },
    ],
  },
  sabra: {
    greet: { cs: "Víno pro vojáky, chléb pro raněné a rozkazy pro všechny. Co si dáš?", en: "Wine for soldiers, bread for the wounded and orders for everyone. What'll it be?" },
    lore: [],
  },
  rukmar: {
    greet: { cs: "Bronz Legie je černý od kouře. O to líp se v něm odráží oheň.", en: "Legion bronze is black with smoke. All the better to reflect the fire." },
    lore: [],
  },
  oren: {
    greet: { cs: "Rudé slunce zapadá do moře každý večer. A každé ráno vychází znovu.", en: "The red sun sinks into the sea every evening. And every morning it rises again." },
    lore: [{ q: { cs: "Čemu Legie věří?", en: "What does the Legion believe?" }, a: { cs: "Že slunce, které zapadne do moře, se vrátí silnější. Tak jako my po každé porážce.", en: "That the sun which sinks into the sea returns stronger. As we do after every defeat." } }],
  },
  azkar: {
    greet: { cs: "Takového nepřítele, jako je Eryon, si cením. Ty se mi zatím jen snažíš ukázat, že stojíš za pozornost.", en: "An enemy like Eryon I respect. You are still trying to show me you are worth my attention." },
    lore: [
      { q: { cs: "Proč tak chceš Kalidru?", en: "Why do you want Kalidra so badly?" }, a: { cs: "Protože se nevzdá. Města, která se vzdají, nestojí za dobytí.", en: "Because it will not surrender. Cities that surrender aren't worth taking." } },
      { q: { cs: "Co si myslíš o Eryonovi?", en: "What do you think of Eryon?" }, a: { cs: "Že je to jediný muž na tomhle pobřeží, se kterým stojí za to bojovat.", en: "That he is the only man on this coast worth fighting." } },
    ],
  },
  taras: {
    greet: { cs: "Bubny Legie duní, jako srdce pod zemí. Chceš slyšet, o čem zpívají v Kalidře?", en: "The Legion's drums thunder like a heart beneath the earth. Want to hear what they sing about in Kalidra?" },
    lore: [],
  },
  "arena-l": {
    greet: { cs: "V kruhu se měří vojáci Legie. Kdo vyhraje proti kalidrskému, má u Azkara slovo.", en: "Legion soldiers test themselves in the ring. Whoever beats a Kalidran earns a word with Azkar." },
    lore: [],
  },
};
