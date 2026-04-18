import { Card } from "@/components/ui/card";
import {
  Heading1, Type, Image as ImageIcon, MousePointerClick, Minus, Columns2, Columns3,
  Quote, Video, Code, Hash, ListCollapse, LayoutGrid, Square, SeparatorHorizontal,
} from "lucide-react";
import type { BlockType } from "@/lib/pageBuilder/types";
import { BLOCK_LABELS } from "@/lib/pageBuilder/types";

const ITEMS: { type: BlockType; icon: React.ComponentType<{ className?: string }>; group: string }[] = [
  { type: "heading", icon: Heading1, group: "Základní" },
  { type: "text", icon: Type, group: "Základní" },
  { type: "image", icon: ImageIcon, group: "Základní" },
  { type: "button", icon: MousePointerClick, group: "Základní" },
  { type: "quote", icon: Quote, group: "Základní" },
  { type: "divider", icon: SeparatorHorizontal, group: "Základní" },
  { type: "spacer", icon: Minus, group: "Základní" },
  { type: "video", icon: Video, group: "Média" },
  { type: "html", icon: Code, group: "Média" },
  { type: "shortcode", icon: Hash, group: "Dynamické" },
  { type: "accordion", icon: ListCollapse, group: "Pokročilé" },
  { type: "cards", icon: LayoutGrid, group: "Pokročilé" },
  { type: "section", icon: Square, group: "Layout" },
  { type: "columns2", icon: Columns2, group: "Layout" },
  { type: "columns3", icon: Columns3, group: "Layout" },
];

const GROUPS = ["Základní", "Média", "Dynamické", "Pokročilé", "Layout"];

export function BlockPalette({ onAdd }: { onAdd: (t: BlockType) => void }) {
  return (
    <Card className="p-3 glass border-border">
      {GROUPS.map((g) => (
        <div key={g} className="mb-4 last:mb-0">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 px-1">{g}</p>
          <div className="grid grid-cols-2 gap-2">
            {ITEMS.filter((i) => i.group === g).map((it) => (
              <button key={it.type} onClick={() => onAdd(it.type)}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-md border border-border bg-card/40 hover:border-primary hover:bg-primary/10 transition-all text-xs">
                <it.icon className="h-4 w-4 text-primary" />
                <span className="text-center leading-tight">{BLOCK_LABELS[it.type]}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}
