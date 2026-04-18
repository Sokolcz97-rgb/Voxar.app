export type BlockType =
  | "heading"
  | "text"
  | "image"
  | "button"
  | "spacer"
  | "divider"
  | "quote"
  | "video"
  | "html"
  | "shortcode"
  | "accordion"
  | "cards"
  | "section"
  | "columns2"
  | "columns3";

export interface BaseBlock {
  id: string;
  type: BlockType;
}

export interface HeadingBlock extends BaseBlock {
  type: "heading";
  text: string;
  level: 1 | 2 | 3;
  align: "left" | "center" | "right";
}
export interface TextBlock extends BaseBlock {
  type: "text";
  text: string;
  align: "left" | "center" | "right";
}
export interface ImageBlock extends BaseBlock {
  type: "image";
  src: string;
  alt: string;
  rounded: boolean;
}
export interface ButtonBlock extends BaseBlock {
  type: "button";
  label: string;
  href: string;
  variant: "default" | "outline" | "secondary";
  align: "left" | "center" | "right";
}
export interface SpacerBlock extends BaseBlock { type: "spacer"; height: number; }
export interface DividerBlock extends BaseBlock { type: "divider"; style: "solid" | "dashed" | "glow"; }
export interface QuoteBlock extends BaseBlock { type: "quote"; text: string; author: string; }
export interface VideoBlock extends BaseBlock {
  type: "video";
  url: string;          // youtube, vimeo, or .mp4
  ratio: "16:9" | "4:3" | "1:1";
}
export interface HtmlBlock extends BaseBlock { type: "html"; html: string; }
export interface ShortcodeBlock extends BaseBlock { type: "shortcode"; code: string; }
export interface AccordionItem { id: string; title: string; content: string; }
export interface AccordionBlock extends BaseBlock { type: "accordion"; items: AccordionItem[]; }
export interface CardItem { id: string; icon: string; title: string; text: string; }
export interface CardsBlock extends BaseBlock {
  type: "cards";
  columns: 2 | 3 | 4;
  items: CardItem[];
}
export interface SectionBlock extends BaseBlock {
  type: "section";
  background: "none" | "primary" | "accent" | "muted" | "gradient";
  paddingY: number;
  children: Block[];
}
export interface ColumnsBlock extends BaseBlock {
  type: "columns2" | "columns3";
  columns: Block[][];
}

export type Block =
  | HeadingBlock | TextBlock | ImageBlock | ButtonBlock | SpacerBlock
  | DividerBlock | QuoteBlock | VideoBlock | HtmlBlock | ShortcodeBlock
  | AccordionBlock | CardsBlock | SectionBlock | ColumnsBlock;

export const newBlock = (type: BlockType): Block => {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading": return { id, type, text: "Nový nadpis", level: 2, align: "left" };
    case "text": return { id, type, text: "Nový odstavec textu. Klikni pro úpravu.", align: "left" };
    case "image": return { id, type, src: "/placeholder.svg", alt: "", rounded: true };
    case "button": return { id, type, label: "Tlačítko", href: "#", variant: "default", align: "left" };
    case "spacer": return { id, type, height: 32 };
    case "divider": return { id, type, style: "solid" };
    case "quote": return { id, type, text: "Skvělá citace nebo myšlenka.", author: "" };
    case "video": return { id, type, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", ratio: "16:9" };
    case "html": return { id, type, html: "<p>Vlastní HTML obsah</p>" };
    case "shortcode": return { id, type, code: "[top-players limit=3]" };
    case "accordion": return { id, type, items: [
      { id: crypto.randomUUID(), title: "Otázka 1", content: "Odpověď 1" },
      { id: crypto.randomUUID(), title: "Otázka 2", content: "Odpověď 2" },
    ]};
    case "cards": return { id, type, columns: 3, items: [
      { id: crypto.randomUUID(), icon: "Zap", title: "Rychlé", text: "Krátký popis." },
      { id: crypto.randomUUID(), icon: "Shield", title: "Bezpečné", text: "Krátký popis." },
      { id: crypto.randomUUID(), icon: "Users", title: "Komunita", text: "Krátký popis." },
    ]};
    case "section": return { id, type, background: "muted", paddingY: 64, children: [] };
    case "columns2": return { id, type, columns: [[], []] };
    case "columns3": return { id, type, columns: [[], [], []] };
  }
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Nadpis", text: "Text", image: "Obrázek", button: "Tlačítko",
  spacer: "Mezera", divider: "Oddělovač", quote: "Citace",
  video: "Video", html: "HTML", shortcode: "Shortcode",
  accordion: "Accordion", cards: "Karty", section: "Sekce",
  columns2: "2 sloupce", columns3: "3 sloupce",
};

export const SHORTCODES = [
  { code: "[top-players limit=3]", label: "Top 3 hráči" },
  { code: "[leaderboard limit=10]", label: "Žebříček (10)" },
  { code: "[latest-threads count=5]", label: "Nejnovější vlákna (5)" },
  { code: "[online-users]", label: "Online uživatelé" },
];
