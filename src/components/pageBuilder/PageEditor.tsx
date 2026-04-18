import { useEffect, useMemo, useState } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors, closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, X, Save, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Block, BlockType } from "@/lib/pageBuilder/types";
import { newBlock } from "@/lib/pageBuilder/types";
import { BlockRenderer } from "@/lib/pageBuilder/BlockRenderer";
import { BlockPalette } from "./BlockPalette";
import { BlockSettings } from "./BlockSettings";

interface Props {
  pageId: string;
  initialBlocks: Block[];
  onClose: () => void;
  onSaved?: () => void;
}

function SortableBlockRow({
  block, selected, onSelect, onDelete, onAddInColumn,
}: {
  block: Block;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onAddInColumn?: (colIdx: number, type: BlockType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div
        onClick={onSelect}
        className={`relative rounded-lg border-2 p-4 transition-all cursor-pointer bg-background/30 ${
          selected ? "border-primary shadow-[0_0_20px_-5px_hsl(var(--primary)/0.5)]" : "border-transparent hover:border-primary/40"
        }`}
      >
        <BlockRenderer block={block} />
        {(block.type === "columns2" || block.type === "columns3") && onAddInColumn && (
          <div className={`grid grid-cols-1 md:grid-cols-${block.type === "columns2" ? 2 : 3} gap-2 mt-3`}>
            {block.columns.map((_, i) => (
              <Button
                key={i}
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={(e) => { e.stopPropagation(); onAddInColumn(i, "text"); }}
              >
                <Plus className="h-3 w-3 mr-1" /> Text do sl. {i + 1}
              </Button>
            ))}
          </div>
        )}
      </div>
      <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          {...attributes}
          {...listeners}
          className="p-1.5 rounded bg-card border border-border hover:border-primary cursor-grab active:cursor-grabbing"
          aria-label="Přetáhnout"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded bg-card border border-border hover:border-destructive hover:text-destructive"
          aria-label="Smazat"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function PageEditor({ pageId, initialBlocks, onClose, onSaved }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const selected = useMemo(() => blocks.find((b) => b.id === selectedId) ?? null, [blocks, selectedId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const update = (next: Block[]) => { setBlocks(next); setDirty(true); };

  const handleAdd = (type: BlockType) => update([...blocks, newBlock(type)]);
  const handleAddInColumn = (parentId: string, colIdx: number, type: BlockType) => {
    update(blocks.map((b) => {
      if (b.id !== parentId || (b.type !== "columns2" && b.type !== "columns3")) return b;
      const cols = b.columns.map((c, i) => i === colIdx ? [...c, newBlock(type)] : c);
      return { ...b, columns: cols };
    }));
  };
  const handleDelete = (id: string) => {
    update(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };
  const handleChange = (next: Block) => update(blocks.map((b) => (b.id === next.id ? next : b)));

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = blocks.findIndex((b) => b.id === active.id);
    const newIdx = blocks.findIndex((b) => b.id === over.id);
    if (oldIdx >= 0 && newIdx >= 0) update(arrayMove(blocks, oldIdx, newIdx));
  };

  const save = async (publish: boolean) => {
    setSaving(true);
    try {
      const patch: any = { draft_blocks: blocks as any };
      if (publish) {
        patch.published_blocks = blocks as any;
        patch.is_published = true;
        patch.published_at = new Date().toISOString();
      }
      const { error } = await supabase.from("pages").update(patch).eq("id", pageId);
      if (error) throw error;
      setDirty(false);
      toast({ title: publish ? "Publikováno" : "Uloženo jako koncept" });
      onSaved?.();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col">
      {/* Toolbar */}
      <header className="h-14 border-b border-border bg-card/60 backdrop-blur flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={onClose}><X className="h-5 w-5" /></Button>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Page Builder</p>
            <p className="text-sm font-display font-bold">{dirty ? "● Neuložené změny" : "Vše uloženo"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> Uložit koncept
          </Button>
          <Button onClick={() => save(true)} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary-glow">
            <Eye className="h-4 w-4 mr-2" /> Publikovat
          </Button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-[280px_1fr] min-h-0">
        {/* Left palette */}
        <aside className="border-r border-border p-4 overflow-y-auto bg-card/30">
          <BlockPalette onAdd={handleAdd} />
          <p className="text-xs text-muted-foreground mt-4 px-1">
            Tip: klikni na blok pro úpravu, podrž ikonu vlevo pro přesun.
          </p>
        </aside>

        {/* Canvas */}
        <ScrollArea className="bg-background">
          <div className="container max-w-4xl py-10 pl-16">
            {blocks.length === 0 ? (
              <Card className="glass border-dashed border-2 p-12 text-center">
                <p className="font-display text-lg mb-2">Prázdná stránka</p>
                <p className="text-sm text-muted-foreground">Přidej první blok z palety vlevo.</p>
              </Card>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="flex flex-col gap-4">
                    {blocks.map((b) => (
                      <SortableBlockRow
                        key={b.id}
                        block={b}
                        selected={selectedId === b.id}
                        onSelect={() => setSelectedId(b.id)}
                        onDelete={() => handleDelete(b.id)}
                        onAddInColumn={
                          (b.type === "columns2" || b.type === "columns3")
                            ? (i, t) => handleAddInColumn(b.id, i, t)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Settings drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="right" className="w-[360px] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Nastavení bloku</SheetTitle>
          </SheetHeader>
          {selected && (
            <div className="mt-6">
              <BlockSettings block={selected} onChange={handleChange} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
