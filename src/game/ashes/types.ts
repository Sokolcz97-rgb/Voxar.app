export type HeroClass = "hoplit" | "lucistnik" | "vestec";
export type Faction = "kalidra" | "legie";
export type HeroId = "eryon" | "azkar";
export type StatKey = "sila" | "obratnost" | "intelekt" | "vydrz" | "stesti";
export type Slot = "zbran" | "stit" | "helma" | "zbroj" | "rukavice" | "boty" | "amulet";

export type Appearance = {
  skin?: string;
  cloak?: string;
  crest?: string;
  enemy?: boolean;
  kalidran?: boolean;
  boss?: boolean;
  hero?: HeroId | null;
  tint?: string;
};

export type Fighter = {
  id?: string;
  name: string;
  class: HeroClass;
  level: number;
  sila: number;
  obratnost: number;
  intelekt: number;
  vydrz: number;
  stesti: number;
  wmin: number;
  wmax: number;
  armor: number;
  shield: boolean;
  appearance: Appearance;
  eryon?: boolean;
  azkar?: boolean;
  faction?: Faction;
  honor?: number;
  npc?: boolean;
};

export type Item = {
  id: string;
  slot: Slot;
  name: string;
  rarity: number;
  level: number;
  wmin: number;
  wmax: number;
  armor: number;
  sila: number;
  obratnost: number;
  intelekt: number;
  vydrz: number;
  stesti: number;
  price: number;
  equipped: boolean;
  in_shop: boolean;
};

export type Quest = {
  id: string;
  chapter: number;
  title: string;
  story: string;
  enemy: Fighter;
  minutes: number;
  xp: number;
  gold: number;
  item_chance: number;
  state: "offered" | "active" | "done";
  started_at: string | null;
  ends_at: string | null;
};

export type Character = {
  user_id: string;
  name: string;
  display_name: string;
  class: HeroClass;
  faction: Faction;
  appearance: Appearance;
  level: number;
  xp: number;
  xp_need: number;
  gold: number;
  honor: number;
  sila: number;
  obratnost: number;
  intelekt: number;
  vydrz: number;
  stesti: number;
  chapter: number;
  chapter_progress: number;
  courage: number;
  arena_ready_at: string;
  boss_ready_at: string;
  wins: number;
  losses: number;
  is_eryon: boolean;
  is_azkar: boolean;
};

export type Chapter = {
  n: number;
  title: string;
  song: string;
  need: number;
  intro: string;
  eryon?: boolean;
  ally?: HeroId;
  boss: { t: string; s: string; e: string; c: HeroClass; win: string; look?: HeroId };
};

export type ChronicleEntry = { created_at: string; kind: string; text: string };

export type World = {
  wall: number;
  wall_max: number;
  open_to_all: boolean;
  eryon_shout: string | null;
  eryon_shout_at: string | null;
  azkar_shout: string | null;
  azkar_shout_at: string | null;
  eryon_claimed: boolean;
  azkar_claimed: boolean;
  heroes: number;
  kalidra: number;
  legie: number;
  arena_cooldown_s: number;
};

export type GameState = {
  allowed: boolean;
  admin?: boolean;
  editor?: boolean;
  now?: string;
  world?: World;
  chronicle?: ChronicleEntry[];
  character?: Character | null;
  fighter?: Fighter;
  hp?: number;
  train_cost?: Record<StatKey, number>;
  items?: Item[];
  quests?: Quest[];
  chapter?: Chapter;
  bag_max?: number;
};

export type Round = { a: 1 | 2; d: number; c: boolean; e: boolean; b: boolean; h1: number; h2: number };

export type Fight = {
  winner: 1 | 2;
  hp1: number;
  hp2: number;
  f1: Fighter;
  f2: Fighter;
  rounds: Round[];
  bonus?: number;
};

export type FightResult = {
  fight: Fight;
  won: boolean;
  xp?: number;
  gold?: number;
  honor?: number;
  levels?: number;
  item?: Item | null;
  title?: string;
  boss?: Chapter["boss"];
  eryon_ally?: boolean;
  ally?: HeroId | null;
  rival?: boolean;
  state: GameState;
};

export type PresenceHero = {
  key: string;
  name: string;
  cls: HeroClass;
  level: number;
  appearance: Appearance;
  eryon: boolean;
  azkar?: boolean;
  faction?: Faction;
};

export const CLASS_LABEL: Record<HeroClass, string> = {
  hoplit: "Štítonoš",
  lucistnik: "Lučištník",
  vestec: "Věštec ohně",
};

export const CLASS_MAIN: Record<HeroClass, StatKey> = {
  hoplit: "sila",
  lucistnik: "obratnost",
  vestec: "intelekt",
};

export const STAT_LABEL: Record<StatKey, string> = {
  sila: "Síla",
  obratnost: "Obratnost",
  intelekt: "Intelekt",
  vydrz: "Výdrž",
  stesti: "Štěstí",
};

export const SLOT_LABEL: Record<Slot, string> = {
  zbran: "Zbraň",
  stit: "Štít",
  helma: "Přilba",
  zbroj: "Zbroj",
  rukavice: "Paže",
  boty: "Nohy",
  amulet: "Amulet",
};

export const RARITY = [
  { label: "Běžný", color: "#b9b2a4" },
  { label: "Kvalitní", color: "#7fc36a" },
  { label: "Vzácný", color: "#5aa0e6" },
  { label: "Epický", color: "#b07ae8" },
  { label: "Legendární", color: "#f0a43a" },
];

export const FACTION: Record<Faction, { name: string; short: string; hero: string; heroFull: string; color: string }> = {
  kalidra: { name: "Obránci Kalidry", short: "Kalidra", hero: "Eryon", heroFull: "Eryon, poslední štít", color: "#d2ae68" },
  legie: { name: "Legie Rudého slunce", short: "Legie", hero: "Azkar", heroFull: "Azkar, Syn Rudého slunce", color: "#d2492b" },
};
