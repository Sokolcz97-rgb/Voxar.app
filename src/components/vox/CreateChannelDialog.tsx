import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Hash, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  initialType?: "text" | "voice";
  onOpenChange: (v: boolean) => void;
  onCreate: (type: "text" | "voice", name: string) => Promise<void> | void;
}

export function CreateChannelDialog({ open, initialType = "text", onOpenChange, onCreate }: Props) {
  const [type, setType] = useState<"text" | "voice">(initialType);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setType(initialType);
      setName("");
      setBusy(false);
    }
  }, [open, initialType]);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    try {
      await onCreate(type, clean);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vytvořit kanál</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(["text", "voice"] as const).map((t) => {
              const Icon = t === "text" ? Hash : Volume2;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-3 text-left transition-colors",
                    type === t ? "border-primary bg-primary/10" : "border-border hover:bg-secondary/60"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <div>
                    <div className="text-sm font-medium">{t === "text" ? "Textový" : "Hlasový"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {t === "text" ? "Posílejte zprávy" : "Připojte se hlasem"}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <Label>Název kanálu</Label>
            <Input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void submit(); }}
              placeholder={type === "text" ? "obecné" : "General"}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Zrušit</Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>{busy ? "Vytvářím…" : "Vytvořit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
