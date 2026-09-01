import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Hash, Volume2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { EmojiPicker } from "@/components/vox/EmojiPicker";
import type { VoxChannel } from "@/components/vox/ChannelSidebar";

interface Props {
  channel: VoxChannel | null;
  categories: string[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/70 mb-1.5">{children}</div>
);

export function ChannelSettingsDialog({ channel, categories, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open || !channel) return;
    setName(channel.name);
    setEmoji(channel.emoji ?? null);
    setTopic(channel.topic ?? "");
    setCategory(channel.category ?? "");
    setBusy(false);
    setConfirmDelete(false);
  }, [open, channel]);

  if (!channel) return null;
  const Icon = channel.type === "text" ? Hash : Volume2;

  const save = async () => {
    const clean = name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64);
    if (!clean) return;
    setBusy(true);
    const { error } = await supabase.from("vox_channels").update({
      name: clean,
      emoji,
      topic: topic.trim() || null,
      category: category.trim() || null,
    }).eq("id", channel.id);
    setBusy(false);
    if (error) toast({ title: "Nelze uložit", description: error.message, variant: "destructive" });
    else { toast({ title: "Node aktualizován" }); onOpenChange(false); }
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from("vox_channels").delete().eq("id", channel.id);
    setBusy(false);
    if (error) toast({ title: "Nelze smazat", description: error.message, variant: "destructive" });
    else { toast({ title: "Node smazán" }); onOpenChange(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg holo-context-menu border-0 p-0 overflow-hidden">
        <div className="px-6 pt-5 pb-4 border-b border-primary/20 bg-gradient-to-r from-primary/10 to-transparent">
          <div className="text-[10px] font-display uppercase tracking-[0.3em] text-primary/60 mb-1">
            // NODE · KONFIGURACE · {channel.type}
          </div>
          <DialogHeader className="space-y-0">
            <DialogTitle className="font-display uppercase tracking-[0.16em] text-primary text-glow flex items-center gap-2 text-base">
              {emoji ? <span className="text-lg">{emoji}</span> : <Icon className="w-4 h-4" />}
              {name || channel.name}
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <Label>// Ikona &amp; název</Label>
            <div className="flex gap-2">
              <EmojiPicker value={emoji} onChange={setEmoji} fallback={<Icon className="w-4 h-4 text-primary/70" />} />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background/40 border-primary/30 font-display tracking-wider"
              />
            </div>
          </div>

          <div>
            <Label>// Sekce (kategorie)</Label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="vox-category-list"
              placeholder="Textové kanály"
              className="bg-background/40 border-primary/30 font-display tracking-wider"
            />
            <datalist id="vox-category-list">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className="px-2 py-1 text-[9px] font-display uppercase tracking-[0.2em] border border-primary/25 text-muted-foreground hover:text-primary hover:border-primary/60 transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>// Popis nodu</Label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="Krátký popis, který uvidí členové v hlavičce kanálu."
              className="bg-background/40 border-primary/30 resize-none"
            />
          </div>
        </div>

        <DialogFooter className="px-6 pb-5 gap-2 sm:justify-between">
          {confirmDelete ? (
            <Button variant="destructive" onClick={remove} disabled={busy} className="font-display uppercase tracking-widest text-xs">
              <Trash2 className="w-4 h-4 mr-1.5" /> Potvrdit purge
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              className="font-display uppercase tracking-widest text-xs text-destructive hover:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> Smazat
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="uppercase tracking-wider text-xs">Zavřít</Button>
            <Button
              onClick={save}
              disabled={busy || !name.trim()}
              className="uppercase tracking-wider text-xs bg-primary/20 border border-primary/60 text-primary hover:bg-primary/30 hover:text-primary shadow-[0_0_16px_hsl(var(--primary)/0.35)]"
            >
              Uložit
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
