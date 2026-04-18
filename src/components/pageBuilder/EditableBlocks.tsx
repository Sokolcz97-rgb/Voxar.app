import { ChevronUp, ChevronDown, Trash2, Plus, Settings2 } from "lucide-react";
import type { Block } from "@/lib/pageBuilder/types";
import { BlockRenderer } from "@/lib/pageBuilder/BlockRenderer";
import { useInlineEditor } from "@/contexts/InlineEditorContext";
import { BLOCK_LABELS } from "@/lib/pageBuilder/types";

/**
 * Wraps a block with inline-editor selection / hover overlay and toolbar.
 * Used only when editor is active.
 */
function EditableBlock({ block, index }: { block: Block; index: number }) {
  const { selectedId, setSelected, removeBlock, moveBlock, blocks } = useInlineEditor();
  const isSelected = selectedId === block.id;
  const last = index === blocks.length - 1;

  return (
    <div
      className={`relative group/block transition-all ${
        isSelected
          ? "outline outline-2 outline-primary outline-offset-2 rounded-sm"
          : "outline outline-2 outline-transparent hover:outline-primary/40 hover:outline-offset-2 rounded-sm"
      }`}
      onClick={(e) => { e.stopPropagation(); setSelected(block.id); }}
    >
      <BlockRenderer block={block} />

      {/* Top label */}
      <div className={`absolute -top-6 left-0 px-2 py-0.5 rounded-t-md bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest pointer-events-none transition-opacity ${
        isSelected ? "opacity-100" : "opacity-0 group-hover/block:opacity-70"
      }`}>
        {BLOCK_LABELS[block.type]}
      </div>

      {/* Right floating toolbar (only when selected) */}
      {isSelected && (
        <div className="absolute -right-12 top-0 flex flex-col gap-1 z-30">
          <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, -1); }} disabled={index === 0}
            className="p-1.5 rounded bg-card border border-border hover:border-primary disabled:opacity-30"
            title="Přesunout nahoru">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 1); }} disabled={last}
            className="p-1.5 rounded bg-card border border-border hover:border-primary disabled:opacity-30"
            title="Přesunout dolů">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setSelected(block.id); }}
            className="p-1.5 rounded bg-card border border-border hover:border-primary"
            title="Nastavení">
            <Settings2 className="h-4 w-4" />
          </button>
          <button onClick={(e) => {
              e.stopPropagation();
              if (confirm("Smazat blok?")) removeBlock(block.id);
            }}
            className="p-1.5 rounded bg-card border border-border hover:border-destructive hover:text-destructive"
            title="Smazat">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function InsertSlot({ index }: { index: number }) {
  const { setSelected } = useInlineEditor();
  return (
    <div className="relative h-3 group/slot">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-primary/0 group-hover/slot:bg-primary/40 transition-all" />
      <button
        onClick={(e) => {
          e.stopPropagation();
          // Open palette by selecting nothing — palette is always in sidebar.
          // Scroll palette into view & toast hint.
          setSelected(null);
          window.dispatchEvent(new CustomEvent("inline-editor:insert-at", { detail: { index } }));
        }}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center opacity-0 group-hover/slot:opacity-100 transition-opacity shadow-[0_0_15px_-2px_hsl(var(--primary))]"
        title="Vložit blok zde"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Renders blocks in either edit mode (with overlays) or read mode.
 * Pages should call this instead of BlocksRenderer when they want inline editing support.
 */
export function EditableBlocks({ blocks, editable }: { blocks: Block[]; editable: boolean }) {
  if (!editable) {
    return (
      <div className="flex flex-col gap-6">
        {blocks.map((b) => <BlockRenderer key={b.id} block={b} />)}
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <InsertSlot index={0} />
      {blocks.map((b, i) => (
        <div key={b.id}>
          <div className="py-2"><EditableBlock block={b} index={i} /></div>
          <InsertSlot index={i + 1} />
        </div>
      ))}
      {blocks.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-border p-12 text-center">
          <p className="font-display text-lg mb-2">Prázdná stránka</p>
          <p className="text-sm text-muted-foreground">Přidej první blok z palety vlevo nebo klikni na „+" mezi bloky.</p>
        </div>
      )}
    </div>
  );
}
