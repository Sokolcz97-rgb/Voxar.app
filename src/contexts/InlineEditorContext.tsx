import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Block, BlockType } from "@/lib/pageBuilder/types";
import { newBlock } from "@/lib/pageBuilder/types";

interface InlineEditorState {
  active: boolean;
  pageId: string | null;
  slug: string | null;
  blocks: Block[];
  selectedId: string | null;
  settingsOpen: boolean;
  dirty: boolean;
  device: "desktop" | "tablet" | "mobile";
  start: (pageId: string, slug: string, blocks: Block[]) => void;
  exit: () => void;
  setSelected: (id: string | null) => void;
  openSettings: (id: string) => void;
  closeSettings: () => void;
  setDevice: (d: "desktop" | "tablet" | "mobile") => void;
  addBlock: (type: BlockType, atIndex?: number) => void;
  updateBlock: (b: Block) => void;
  removeBlock: (id: string) => void;
  moveBlock: (id: string, dir: -1 | 1) => void;
  saveDraft: () => Promise<void>;
  publish: () => Promise<void>;
  saving: boolean;
}

const Ctx = createContext<InlineEditorState | undefined>(undefined);

export function InlineEditorProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [pageId, setPageId] = useState<string | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);

  const start = useCallback((id: string, s: string, init: Block[]) => {
    setPageId(id); setSlug(s); setBlocks(init); setSelectedId(null); setSettingsOpen(false);
    setDirty(false); setDevice("desktop"); setActive(true);
  }, []);

  const exit = useCallback(() => {
    if (dirty && !confirm("Máš neuložené změny. Opravdu zavřít editor?")) return;
    setActive(false); setPageId(null); setSlug(null); setBlocks([]); setSelectedId(null); setSettingsOpen(false); setDirty(false);
  }, [dirty]);

  const openSettings = useCallback((id: string) => { setSelectedId(id); setSettingsOpen(true); }, []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);


  const update = useCallback((next: Block[]) => { setBlocks(next); setDirty(true); }, []);

  const addBlock = useCallback((type: BlockType, atIndex?: number) => {
    const nb = newBlock(type);
    if (atIndex === undefined) update([...blocks, nb]);
    else update([...blocks.slice(0, atIndex), nb, ...blocks.slice(atIndex)]);
    setSelectedId(nb.id);
  }, [blocks, update]);

  const updateBlock = useCallback((b: Block) => {
    update(blocks.map((x) => (x.id === b.id ? b : x)));
  }, [blocks, update]);

  const removeBlock = useCallback((id: string) => {
    update(blocks.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [blocks, selectedId, update]);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    const idx = blocks.findIndex((b) => b.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    update(next);
  }, [blocks, update]);

  const persist = useCallback(async (publish: boolean) => {
    if (!pageId) return;
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
      toast({ title: publish ? "Publikováno" : "Koncept uložen" });
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [pageId, blocks]);

  const saveDraft = useCallback(() => persist(false), [persist]);
  const publish = useCallback(() => persist(true), [persist]);

  // Warn on unload while dirty
  useEffect(() => {
    if (!active) return;
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [active, dirty]);

  const value = useMemo<InlineEditorState>(() => ({
    active, pageId, slug, blocks, selectedId, settingsOpen, dirty, device,
    start, exit, setSelected: setSelectedId, openSettings, closeSettings, setDevice,
    addBlock, updateBlock, removeBlock, moveBlock,
    saveDraft, publish, saving,
  }), [active, pageId, slug, blocks, selectedId, settingsOpen, dirty, device, start, exit, openSettings, closeSettings,
       addBlock, updateBlock, removeBlock, moveBlock, saveDraft, publish, saving]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useInlineEditor = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInlineEditor must be used within InlineEditorProvider");
  return ctx;
};
