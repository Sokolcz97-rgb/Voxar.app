import { useEffect, useState } from "react";
import { X, Save, Eye, Monitor, Tablet, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInlineEditor } from "@/contexts/InlineEditorContext";
import { BlockPalette } from "./BlockPalette";
import { BlockSettings } from "./BlockSettings";
import type { BlockType } from "@/lib/pageBuilder/types";

const DEVICE_WIDTHS = { desktop: "100%", tablet: "820px", mobile: "390px" };

export function InlineEditorChrome() {
  const ed = useInlineEditor();
  const [insertAt, setInsertAt] = useState<number | null>(null);

  useEffect(() => {
    const h = (e: any) => setInsertAt(e.detail?.index ?? null);
    window.addEventListener("inline-editor:insert-at", h);
    return () => window.removeEventListener("inline-editor:insert-at", h);
  }, []);

  if (!ed.active) return null;

  const handleAdd = (type: BlockType) => {
    ed.addBlock(type, insertAt ?? undefined);
    setInsertAt(null);
  };

  const selected = ed.blocks.find((b) => b.id === ed.selectedId) ?? null;

  return (
    <>
      {/* TOP TOOLBAR */}
      <div className="fixed top-0 inset-x-0 z-[90] h-14 bg-card border-b-2 border-primary/40 backdrop-blur flex items-center justify-between px-4 shadow-lg">
        <div className="flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={ed.exit} title="Zavřít editor">
            <X className="h-5 w-5" />
          </Button>
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Inline editor</p>
            <p className="text-sm font-display font-bold">
              /{ed.slug === "home" ? "" : ed.slug}
              <span className="ml-2 text-xs text-muted-foreground">
                {ed.dirty ? "● Neuložené změny" : "Vše uloženo"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 bg-background/60 rounded-md p-1 border border-border">
          {(["desktop", "tablet", "mobile"] as const).map((d) => {
            const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
            return (
              <button key={d} onClick={() => ed.setDevice(d)}
                className={`p-1.5 rounded transition-colors ${
                  ed.device === d ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
                }`}
                title={d}>
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {insertAt !== null && (
            <span className="text-xs text-primary mr-2 hidden md:inline">
              Vyber blok z palety pro vložení na pozici {insertAt + 1}
            </span>
          )}
          <Button variant="outline" onClick={ed.saveDraft} disabled={ed.saving}>
            {ed.saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Uložit koncept
          </Button>
          <Button onClick={ed.publish} disabled={ed.saving}
            className="bg-primary text-primary-foreground hover:bg-primary-glow">
            <Eye className="h-4 w-4 mr-2" /> Publikovat
          </Button>
        </div>
      </div>

      {/* LEFT PALETTE */}
      <aside className="fixed left-0 top-14 bottom-0 z-[85] w-72 border-r border-border bg-card/95 backdrop-blur">
        <ScrollArea className="h-full">
          <div className="p-3">
            <BlockPalette onAdd={handleAdd} />
            <p className="text-xs text-muted-foreground mt-3 px-1">
              Tip: klikni na blok přímo na stránce pro úpravu.
            </p>
          </div>
        </ScrollArea>
      </aside>

      {/* SETTINGS SHEET (right) */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && ed.setSelected(null)}>
        <SheetContent side="right" className="w-[380px] sm:w-[420px] z-[120]">
          <SheetHeader><SheetTitle>Nastavení bloku</SheetTitle></SheetHeader>
          {selected && (
            <ScrollArea className="h-[calc(100vh-80px)] mt-4 pr-4">
              <BlockSettings block={selected} onChange={ed.updateBlock} />
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Wraps the page content with editor padding/device-frame when active.
 */
export function InlineEditorFrame({ children }: { children: React.ReactNode }) {
  const { active, device } = useInlineEditor();
  if (!active) return <>{children}</>;

  const width = DEVICE_WIDTHS[device];
  return (
    <div className="pt-14 pl-72">
      <div
        className="mx-auto transition-all duration-300 bg-background min-h-[calc(100vh-3.5rem)] shadow-2xl"
        style={{
          maxWidth: width,
          outline: device !== "desktop" ? "1px solid hsl(var(--border))" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}
