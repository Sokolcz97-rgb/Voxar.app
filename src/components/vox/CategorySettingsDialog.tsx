import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { EmojiPicker } from "@/components/vox/EmojiPicker";

interface Props {
  guildId: string | null;
  /** Original category name (null = creating a new one). */
  category: string | null;
  emoji: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export function CategorySettingsDialog({ guildId, category, emoji: initialEmoji, open, onOpenChange, onSaved }: Props) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(category ?? "");
    setEmoji(initialEmoji ?? null);
    setBusy(false);
  }, [open, category, initialEmoji]);

  const save = async () => {
    if (!guildId) return;
    const clean = name.trim().slice(0, 64);
    if (!clean) return;
    setBusy(true);

    // Upsert the category metadata row (emoji + name).
    const { data: existing } = await supabase
      .from("vox_categories").select("id").eq("guild_id", guildId).eq("name", category ?? clean).maybeSingle();

    const res = existing
      ? await supabase.from("vox_categories").update({ name: clean, emoji }).eq("id", existing.id)
      : await supabase.from("vox_categories").insert({ guild_id: guildId, name: clean, emoji });

    if (res.error) {
      setBusy(false);
      return toast({ title: "Nelze uložit sekci", description: res.error.message, variant: "destructive" });
    }

    // Rename all channels that referenced the old category name.
    if (category && category !== clean) {
      const { error } = await supabase.from("vox_channels")
        .update({ category: clean }).eq("guild_id", guildId).eq("category", category);
      if (error) {
        setBusy(false);
        return toast({ title: "Kanály se nepřejmenovaly", description: error.message, variant: "destructive" });
      }
    }

    setBusy(false);
    toast({ title: category ? "Sekce aktualizována" : "Sekce vytvořena" });
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md holo-context-menu border-0 p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="text-[10px] font-display uppercase tracking-[0.3em] text-primary/60 mb-1">
            // SEKCE · KONFIGURACE
          </div>
          <DialogHeader className="space-y-0">
            <DialogTitle className="font-display uppercase tracking-[0.16em] text-primary text-glow flex items-center gap-2 text-base">
              {emoji ? <span className="text-lg">{emoji}</span> : <Layers className="w-4 h-4" />}
              {name || "Nová sekce"}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/70 mb-1.5">
            // Ikona &amp; název sekce
          </div>
          <div className="flex gap-2">
            <EmojiPicker value={emoji} onChange={setEmoji} fallback={<Layers className="w-4 h-4 text-primary/70" />} />
            <Input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
              placeholder="Hlasové kanály"
              className="bg-background/40 border-primary/30 font-display tracking-wider"
            />
          </div>
        </div>

        <DialogFooter className="px-6 pb-5">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="uppercase tracking-wider text-xs">Zrušit</Button>
          <Button
            onClick={save}
            disabled={busy || !name.trim()}
            className="uppercase tracking-wider text-xs bg-primary/20 border border-primary/60 text-primary hover:bg-primary/30 hover:text-primary shadow-[0_0_16px_hsl(var(--primary)/0.35)]"
          >
            Uložit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
