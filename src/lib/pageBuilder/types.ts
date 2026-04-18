export type BlockType =
  | "heading"
  | "text"
  | "image"
  | "button"
  | "spacer"
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

export interface SpacerBlock extends BaseBlock {
  type: "spacer";
  height: number; // px
}

export interface ColumnsBlock extends BaseBlock {
  type: "columns2" | "columns3";
  columns: Block[][];
}

export type Block =
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | SpacerBlock
  | ColumnsBlock;

export const newBlock = (type: BlockType): Block => {
  const id = crypto.randomUUID();
  switch (type) {
    case "heading":
      return { id, type, text: "Nový nadpis", level: 2, align: "left" };
    case "text":
      return { id, type, text: "Nový odstavec textu. Klikni pro úpravu.", align: "left" };
    case "image":
      return { id, type, src: "/placeholder.svg", alt: "", rounded: true };
    case "button":
      return { id, type, label: "Tlačítko", href: "#", variant: "default", align: "left" };
    case "spacer":
      return { id, type, height: 32 };
    case "columns2":
      return { id, type, columns: [[], []] };
    case "columns3":
      return { id, type, columns: [[], [], []] };
  }
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  heading: "Nadpis",
  text: "Text",
  image: "Obrázek",
  button: "Tlačítko",
  spacer: "Mezera",
  columns2: "2 sloupce",
  columns3: "3 sloupce",
};
