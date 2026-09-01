import { ReactNode } from "react";
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
} from "@/components/ui/context-menu";
import { Layers, Pencil, Plus, Hash, Volume2 } from "lucide-react";

interface Props {
  category: string;
  canManage: boolean;
  onEdit: () => void;
  onCreateCategory: () => void;
  onCreateChannel: (type: "text" | "voice") => void;
  children: ReactNode;
}

export function CategoryContextMenu({ category, canManage, onEdit, onCreateCategory, onCreateChannel, children }: Props) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="holo-context-menu holo-ctx w-56 text-foreground font-display tracking-wider uppercase text-xs">
        <span className="ctx-brackets" aria-hidden />
        <div className="ctx-head">
          <div className="text-[8px] tracking-[0.3em] text-primary/60 mb-0.5">// SEKCE</div>
          <div className="flex items-center gap-2 text-primary text-glow text-[13px] truncate">
            <Layers className="w-3.5 h-3.5" /> {category}
          </div>
        </div>
        {canManage ? (
          <>
            <div className="ctx-section">// SEKCE · OPS</div>
            <ContextMenuItem onSelect={onEdit}>
              <Pencil className="w-4 h-4 mr-2 text-primary" /> Upravit sekci
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onCreateChannel("text")}>
              <Hash className="w-4 h-4 mr-2 text-primary" /> Nový text node
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onCreateChannel("voice")}>
              <Volume2 className="w-4 h-4 mr-2 text-primary" /> Nový voice node
            </ContextMenuItem>
            <ContextMenuItem onSelect={onCreateCategory}>
              <Plus className="w-4 h-4 mr-2 text-primary" /> Nová sekce
            </ContextMenuItem>
          </>
        ) : (
          <ContextMenuItem disabled className="text-muted-foreground">Bez oprávnění</ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
