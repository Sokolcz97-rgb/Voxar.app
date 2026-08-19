/**
 * Mock translation layer — no AI APIs.
 * Heuristic language detection + a small dictionary so the UI can be exercised
 * end-to-end before a real translation backend is wired in.
 */

export type Lang = "cs" | "en";

const CS_MARKERS = /[ěščřžýáíéúůňťď]/i;
const CS_WORDS = /\b(ahoj|dobrý|děkuji|prosím|jak|kde|kdy|proč|nevím|jsem|jsi|není|zdravím|čau|díky|mám|budeš|můžeš)\b/i;
const EN_WORDS = /\b(the|hello|hi|thanks|please|how|where|when|why|dont|don't|i'm|you|are|is|can|will|good)\b/i;

const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** Very small heuristic detector — returns null when it cannot tell. */
export function detectLang(raw: string): Lang | null {
  const text = stripTags(raw);
  if (text.length < 3) return null;
  if (CS_MARKERS.test(text) || CS_WORDS.test(text)) return "cs";
  if (EN_WORDS.test(text)) return "en";
  return null;
}

const DICT: Record<Lang, Record<string, string>> = {
  cs: {
    ahoj: "hi", čau: "hey", "dobrý": "good", den: "day", "děkuji": "thank you",
    "díky": "thanks", "prosím": "please", jak: "how", se: "", "máš": "are you",
    kde: "where", kdy: "when", "proč": "why", "nevím": "I don't know",
    jsem: "I am", "jsi": "you are", "není": "is not", "můžeš": "can you",
    "mám": "I have", ano: "yes", ne: "no", dnes: "today", zítra: "tomorrow",
    server: "server", zpráva: "message", "úkol": "task", odměna: "reward",
  },
  en: {
    hi: "ahoj", hello: "ahoj", hey: "čau", thanks: "díky", "thank": "děkuji",
    please: "prosím", how: "jak", are: "jsi", you: "ty", where: "kde",
    when: "kdy", why: "proč", yes: "ano", no: "ne", today: "dnes",
    tomorrow: "zítra", good: "dobrý", day: "den", message: "zpráva",
    task: "úkol", reward: "odměna", server: "server", "i": "já",
  },
};

/** Mock machine translation: dictionary word swap, original casing kept. */
export function mockTranslate(raw: string, from: Lang, to: Lang): string {
  if (from === to) return raw;
  const dict = DICT[from] ?? {};
  return raw.replace(/([\p{L}']+)/gu, (word) => {
    const hit = dict[word.toLowerCase()];
    if (hit === undefined) return word;
    if (!hit) return word;
    return word[0] === word[0].toUpperCase()
      ? hit.charAt(0).toUpperCase() + hit.slice(1)
      : hit;
  });
}

export interface TranslationResult {
  /** true when the message language differs from the reader's preference */
  translated: boolean;
  sourceLang: Lang | null;
  targetLang: Lang;
  text: string;
}

export function autoTranslate(raw: string, target: Lang): TranslationResult {
  const sourceLang = detectLang(raw);
  if (!sourceLang || sourceLang === target) {
    return { translated: false, sourceLang, targetLang: target, text: raw };
  }
  const text = mockTranslate(raw, sourceLang, target);
  return { translated: text !== raw, sourceLang, targetLang: target, text };
}

export const LANG_LABEL: Record<Lang, string> = { cs: "CS", en: "EN" };
