import { Card } from "@/components/ui/card";
import { Heading1, Type, Image as ImageIcon, MousePointerClick, Minus, Columns2, Columns3 } from "lucide-react";
import type { BlockType } from "@/lib/pageBuilder/types";
import { BLOCK_LABELS } from "@/lib/pageBuilder/types";

const ITEMS: { type: BlockType; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "heading", icon: Heading1 },
  { type: "text", icon: Type },
  { type: "image", icon: ImageIcon },
  { type: "button", icon: MousePointerClick },
  { type: "spacer", icon: Minus },
  { type: "columns2", icon: Columns2 },
  { type: "columns3", icon: Columns3 },
];

export function BlockPalette({ onAdd }: { onAdd: (t: BlockType) => void }) {
  return (
    <Card className="p-3 glass border-border">
      <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 px-1">Bloky</p>
      <div className="grid grid-cols-2 gap-2">
        {ITEMS.map((it) => (
          <button
            key={it.type}
            onClick={() => onAdd(it.type)}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-md border border-border bg-card/40 hover:border-primary hover:bg-primary/10 transition-all text-xs"
          >
            <it.icon className="h-4 w-4 text-primary" />
            <span>{BLOCK_LABELS[it.type]}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}
