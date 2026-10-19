import { useEffect, useState } from "react";
import { CONTENT_EN } from "./content-en";

/**
 * Jazyk hry. Primárně čeština, angličtina je překlad.
 * - UI texty: klíče v `UI` (cs/en)
 * - obsah ze serveru (úkoly, kapitoly, nepřátelé, předměty, kronika) je česky
 *   a do angličtiny se překládá funkcemi `tr`, `trItem`, `trChronicle`.
 */
export type Lang = "cs" | "en";

const KEY = "ashes.lang";
let current: Lang = (() => {
  try {
    const v = localStorage.getItem(KEY);
    return v === "en" ? "en" : "cs";
  } catch {
    return "cs";
  }
})();
const listeners = new Set<() => void>();

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* bez úložiště */
  }
  listeners.forEach((fn) => fn());
}

export function useLang(): Lang {
  const [lang, set] = useState(current);
  useEffect(() => {
    const fn = () => set(current);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return lang;
}

/** Text ze serveru (česky) → aktuální jazyk. */
export function tr(text: string | null | undefined): string {
  if (!text) return "";
  if (current === "cs") return text;
  return CONTENT_EN[text] ?? text;
}

/** Vybere text podle jazyka. */
export function L(cs: string, en: string) {
  return current === "en" ? en : cs;
}

const ADJ: [RegExp, string][] = [
  [/^Měděn[ýáé]\s/i, "Copper "],
  [/^Bronzov[ýáé]\s/i, "Bronze "],
  [/^Zakalen[ýáé]\s/i, "Tempered "],
  [/^Orichalkov[ýáé]\s/i, "Orichalcum "],
  [/^Starokalidrsk[ýáé]\s/i, "Old Kalidran "],
  [/^Kostěný\s/i, "Bone "],
  [/^Jantarový\s/i, "Amber "],
  [/^Zlatý\s/i, "Golden "],
];
const BASE: [string, string][] = [
  ["puklicový štít", "bossed shield"], ["kulatý štít", "round shield"], ["štít", "shield"],
  ["helma s hřebenem", "crested helm"], ["přilba", "helmet"], ["čelenka", "circlet"],
  ["šupinová košile", "scale shirt"], ["kyrys", "cuirass"], ["zbroj", "armor"],
  ["chrániče paží", "arm guards"], ["nátepníky", "vambraces"], ["holeně", "greaves"], ["sandály", "sandals"],
  ["obětní nůž", "sacrificial knife"], ["kopí", "spear"], ["meč", "sword"], ["sekera", "axe"],
  ["luk", "bow"], ["dýka", "dagger"], ["prak", "sling"], ["hůl", "staff"], ["žezlo", "scepter"],
  ["amulet", "amulet"], ["talisman", "talisman"], ["náhrdelník", "necklace"],
];

/** Název předmětu (generuje ho server česky) → angličtina. */
export function trItem(name: string): string {
  if (current === "cs" || !name) return name;
  let rest = name;
  let suffix = "";
  if (rest.endsWith(" z Kalidry")) {
    rest = rest.slice(0, -" z Kalidry".length);
    suffix = " of Kalidra";
  } else if (rest.endsWith(" Eryonova rodu")) {
    rest = rest.slice(0, -" Eryonova rodu".length);
    suffix = " of Eryon's Line";
  }
  let adj = "";
  for (const [re, en] of ADJ) {
    if (re.test(rest)) {
      adj = en;
      rest = rest.replace(re, "");
      break;
    }
  }
  const lower = rest.toLowerCase();
  const base = BASE.find(([cs]) => lower === cs)?.[1] ?? rest;
  const out = `${adj}${base}${suffix}`;
  return out.charAt(0).toUpperCase() + out.slice(1);
}

const CHRONICLE: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Na Bezejmenném břehu se probudil nový obránce Kalidry: (.+)\.$/, (m) => `A new defender of Kalidra awoke on the Nameless Shore: ${m[1]}.`],
  [/^Na Bezejmenném břehu se probudil nový hrdina: (.+)\.$/, (m) => `A new hero awoke on the Nameless Shore: ${m[1]}.`],
  [/^Z černé lodi vystoupil nový voják Legie Rudého slunce: (.+)\.$/, (m) => `A new soldier of the Legion of the Red Sun stepped off a black ship: ${m[1]}.`],
  [/^(.+) dosáhl (\d+)\. úrovně\.$/, (m) => `${m[1]} reached level ${m[2]}.`],
  [/^(.+) \((Legie|Kalidra)\) porazil: (.+)\.$/, (m) => `${m[1]} (${m[2] === "Legie" ? "Legion" : "Kalidra"}) defeated: ${tr(m[3])}.`],
  [/^(.+) porazil: (.+)\.$/, (m) => `${m[1]} defeated: ${tr(m[2])}.`],
  [/^(.+) porazil v aréně samotného (Eryona|Azkara)!$/, (m) => `${m[1]} defeated ${m[2] === "Eryona" ? "Eryon" : "Azkar"} himself in the arena!`],
  [/^(.+) se postavil do řady po boku (Eryona|Azkara)\.$/, (m) => `${m[1]} took a place in the line beside ${m[2] === "Eryona" ? "Eryon" : "Azkar"}.`],
  [/^Eryon kráčí mezi obránci Kalidry\.$/, () => "Eryon walks among the defenders of Kalidra."],
  [/^Azkar, Syn Rudého slunce, vede Legii osobně\.$/, () => "Azkar, Son of the Red Sun, leads the Legion in person."],
];

export function trChronicle(text: string): string {
  if (current === "cs") return text;
  for (const [re, fn] of CHRONICLE) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}

const ERRORS: Record<string, string> = {
  "Ashes of Eryon se připravuje.": "Ashes of Eryon is coming soon.",
  "Postavu už máš.": "You already have a character.",
  "Jméno musí mít 3–20 znaků a začínat písmenem.": "The name must be 3–20 characters and start with a letter.",
  "Toto jméno patří legendě.": "That name belongs to a legend.",
  "Toto jméno už nosí jiný hrdina.": "Another hero already bears this name.",
  "Už jsi na výpravě.": "You are already on an expedition.",
  "Výprava už není k dispozici.": "That expedition is no longer available.",
  "Došla ti odvaha. Zítra ráno se vrátí.": "You are out of courage. It returns tomorrow morning.",
  "Výprava ještě neskončila.": "The expedition is not over yet.",
  "Nejdřív splň výpravy této kapitoly.": "Complete this chapter's quests first.",
  "Zraněný hrdina potřebuje chvíli odpočinku.": "A wounded hero needs a moment of rest.",
  "Nemáš dost zlata.": "Not enough gold.",
  "Batoh je plný.": "Your bag is full.",
  "Na tento předmět ještě nemáš úroveň.": "Your level is too low for this item.",
  "Nasazený předmět nelze prodat.": "You cannot sell an equipped item.",
  "Zboží už kovář prodal.": "The smith has already sold that.",
  "V aréně si ještě musíš odpočinout.": "You must rest before the next arena fight.",
  "Chvíli si oddychni.": "Catch your breath for a moment.",
  "Nejdřív dokonči předchozí úkoly.": "Finish the previous quests first.",
  "Úkol ještě není splněný.": "The quest is not complete yet.",
  "Úkol už máš.": "You already have this quest.",
  "Tady takový nepřítel není.": "There is no such enemy here.",
  "Ukázka 2. a 3. aktu je dohrána. Další akty se připravují.": "The Act II and III previews are complete. More acts are coming.",
};

export function trError(message: string) {
  return current === "en" ? ERRORS[message] ?? message : message;
}

// ---------------------------------------------------------------- popisky herních pojmů
const CLASS_EN: Record<string, string> = { hoplit: "Shieldbearer", lucistnik: "Archer", vestec: "Fire Seer" };
const CLASS_CS: Record<string, string> = { hoplit: "Štítonoš", lucistnik: "Lučištník", vestec: "Věštec ohně" };
const STAT_CS: Record<string, string> = { sila: "Síla", obratnost: "Obratnost", intelekt: "Intelekt", vydrz: "Výdrž", stesti: "Štěstí" };
const STAT_EN: Record<string, string> = { sila: "Strength", obratnost: "Dexterity", intelekt: "Intellect", vydrz: "Endurance", stesti: "Luck" };
const SLOT_CS: Record<string, string> = { zbran: "Zbraň", stit: "Štít", helma: "Přilba", zbroj: "Zbroj", rukavice: "Paže", boty: "Nohy", amulet: "Amulet" };
const SLOT_EN: Record<string, string> = { zbran: "Weapon", stit: "Shield", helma: "Helmet", zbroj: "Armor", rukavice: "Arms", boty: "Legs", amulet: "Amulet" };
const RARITY_CS = ["Běžný", "Kvalitní", "Vzácný", "Epický", "Legendární"];
const RARITY_EN = ["Common", "Fine", "Rare", "Epic", "Legendary"];

export const classLabel = (c: string) => (current === "en" ? CLASS_EN : CLASS_CS)[c] ?? c;
export const statLabel = (s: string) => (current === "en" ? STAT_EN : STAT_CS)[s] ?? s;
export const slotLabel = (s: string) => (current === "en" ? SLOT_EN : SLOT_CS)[s] ?? s;
export const rarityLabel = (i: number) => (current === "en" ? RARITY_EN : RARITY_CS)[i] ?? "";
export const factionName = (f: string) => (f === "legie" ? L("Legie Rudého slunce", "Legion of the Red Sun") : L("Obránci Kalidry", "Defenders of Kalidra"));
export const factionShort = (f: string) => (f === "legie" ? L("Legie", "Legion") : "Kalidra");
export const locale = () => (current === "en" ? "en-GB" : "cs-CZ");
