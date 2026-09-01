import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Hash, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/vox/EmojiPicker";

export interface NewChannelPayload {
  type: "text" | "voice";
  name: string;
  emoji: string | null;
  category: string | null;
  topic: string | null;
}

interface Props {
  open: boolean;
  initialType?: "text" | "voice";
  initialCategory?: string | null;
  categories?: string[];
  onOpenChange: (v: boolean) => void;
  onCreate: (payload: NewChannelPayload) => Promise<void> | void;
}

export function CreateChannelDialog({
  open, initialType = "text", initialCategory = null, categories = [], onOpenChange, onCreate,
}: Props) {
  const [type, setType] = useState<"text" | "voice">(initialType);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setType(initialType);
      setName("");
      setEmoji(null);
      setTopic("");
      setCategory(initialCategory ?? (initialType === "text" ? "Textové kanály" : "Hlasové kanály"));
      setBusy(false);
    }
  }, [open, initialType, initialCategory]);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    try {
      await onCreate({
        type,
        name: clean,
        emoji,
        category: category.trim() || null,
        topic: topic.trim() || null,
      });
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md holo-context-menu border-0 p-6">
        <DialogHeader>
          <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/60">
            // Sekce
          </div>
          <DialogTitle className="font-display uppercase tracking-[0.18em] text-glow">
            Nový node
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["text", "voice"] as const).map((t) => {
              const Icon = t === "text" ? Hash : Volume2;
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex items-center gap-3 p-3 text-left transition-all",
                    "border font-display uppercase tracking-wider",
                    active
                      ? "border-primary/70 bg-primary/10 text-primary shadow-[inset_0_0_14px_hsl(var(--primary)/0.2),0_0_12px_hsl(var(--primary)/0.35)]"
                      : "border-primary/20 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                  style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <div>
                    <div className="text-[12px] font-semibold">{t === "text" ? "Text" : "Voice"}</div>
                    <div className="text-[9px] tracking-[0.2em] opacity-70">
                      {t === "text" ? "TX packets" : "Audio link"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/70 mb-1.5">
              // Ikona &amp; Node ID
            </div>
            <div className="flex gap-2">
              <EmojiPicker
                value={emoji}
                onChange={setEmoji}
                fallback={type === "text" ? <Hash className="w-4 h-4 text-primary/70" /> : <Volume2 className="w-4 h-4 text-primary/70" />}
              />
              <Input
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
                placeholder={type === "text" ? "obecné" : "General"}
                className="bg-background/40 border-primary/30 font-display tracking-wider focus-visible:border-primary/70 focus-visible:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/70 mb-1.5">
              // Sekce (kategorie)
            </div>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              list="vox-create-category-list"
              className="bg-background/40 border-primary/30 font-display tracking-wider"
            />
            <datalist id="vox-create-category-list">
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
            <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/70 mb-1.5">
              // Popis (nepovinné)
            </div>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="K čemu tenhle node slouží?"
              className="bg-background/40 border-primary/30 resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy} className="uppercase tracking-wider">Zrušit</Button>
          <Button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="uppercase tracking-wider bg-primary/20 border border-primary/60 text-primary hover:bg-primary/30 hover:text-primary shadow-[0_0_16px_hsl(var(--primary)/0.35)]"
          >
            {busy ? "Init…" : "Vytvořit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
