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
