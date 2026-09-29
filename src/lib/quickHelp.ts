export type QuickHelpItem = {
  title: string;
  description: string;
  href: string;
  keywords: string[];
};

export const QUICK_HELP_ITEMS: QuickHelpItem[] = [
  {
    title: "Podpora a tickety",
    description: "Technický problém, účet, objednávka nebo něco, co musí řešit člověk.",
    href: "/tickets",
    keywords: ["podpora", "ticket", "problem", "problém", "chyba", "ucet", "účet", "objednavka", "objednávka"],
  },
  {
    title: "Zprávy",
    description: "Soukromé zprávy a komunikace s ostatními uživateli.",
    href: "/messages",
    keywords: ["zprava", "zprávy", "dm", "chat", "kontakt"],
  },
  {
    title: "Fórum",
    description: "Komunitní návody, diskuze a řešení častých problémů.",
    href: "/forum",
    keywords: ["forum", "fórum", "navod", "návod", "diskuze", "rada", "pomoc"],
  },
  {
    title: "Servery",
    description: "Přehled herních serverů a komunitních projektů.",
    href: "/servery",
    keywords: ["server", "servery", "hra", "game", "ip"],
  },
  {
    title: "Ke stažení",
    description: "Instalátory StudioVoxario a VoxarioBrowseru.",
    href: "/desktop",
    keywords: ["stahnout", "stáhnout", "download", "installer", "instalator", "instalátor", "browser"],
  },
  {
    title: "Profil",
    description: "Nastavení účtu, profilové údaje a avatar.",
    href: "/profile",
    keywords: ["profil", "avatar", "ucet", "účet", "jmeno", "jméno"],
  },
  {
    title: "Obchod",
    description: "Nabídka produktů a služeb StudioVoxario.",
    href: "/obchod",
    keywords: ["obchod", "shop", "nakup", "nákup", "produkt", "cena"],
  },
  {
    title: "Novinky",
    description: "Aktuální novinky a oznámení StudioVoxario.",
    href: "/novinky",
    keywords: ["novinky", "news", "aktualizace", "update"],
  },
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase("cs-CZ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function findQuickHelp(query: string, limit = 5): QuickHelpItem[] {
  const q = normalize(query);
  if (!q) return QUICK_HELP_ITEMS.slice(0, limit);
  const tokens = q.split(/\s+/).filter(Boolean);
  return QUICK_HELP_ITEMS
    .map((item) => {
      const haystack = normalize([item.title, item.description, ...item.keywords].join(" "));
      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score += token.length + 2;
        if (normalize(item.title).includes(token)) score += 4;
      }
      return { item, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function generateSecurePassword(length = 20) {
  const safeLength = Math.max(12, Math.min(64, Math.floor(length) || 20));
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%&*+-_=?.";
  const all = lower + upper + digits + symbols;
  const randomIndex = (max: number) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  };
  const chars = [
    lower[randomIndex(lower.length)],
    upper[randomIndex(upper.length)],
    digits[randomIndex(digits.length)],
    symbols[randomIndex(symbols.length)],
  ];
  while (chars.length < safeLength) chars.push(all[randomIndex(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
