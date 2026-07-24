import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

function HoloShell({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <DialogContent className="sm:max-w-md holo-context-menu border-0 p-6">
      <DialogHeader>
        <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/60">
          {tag}
        </div>
        <DialogTitle className="font-display uppercase tracking-[0.18em] text-glow">
          {title}
        </DialogTitle>
      </DialogHeader>
      {children}
    </DialogContent>
  );
}

export function CreateGuildDialog({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!user || !name.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.from("vox_guilds")
      .insert({ name: name.trim(), owner_id: user.id })
      .select("id").single();
    setBusy(false);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    onCreated(data.id);
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <HoloShell tag="// Sektor" title="Nový server">
        <div className="space-y-3">
          <div className="text-[10px] font-display uppercase tracking-[0.24em] text-muted-foreground">
            Auto-init: <span className="text-primary/80">#obecné</span> · <span className="text-primary/80">General voice</span>
          </div>
          <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/70">
            // Název sektoru
          </div>
          <Input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="Např. Moje parta"
            onKeyDown={(e) => e.key === "Enter" && create()}
            className="bg-background/40 border-primary/30 font-display tracking-wider focus-visible:border-primary/70 focus-visible:ring-primary/30"
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="uppercase tracking-wider">Zrušit</Button>
          <Button
            onClick={create}
            disabled={busy || !name.trim()}
            className="uppercase tracking-wider bg-primary/20 border border-primary/60 text-primary hover:bg-primary/30 hover:text-primary shadow-[0_0_16px_hsl(var(--primary)/0.35)]"
          >
            {busy ? "Init…" : "Vytvořit"}
          </Button>
        </DialogFooter>
      </HoloShell>
    </Dialog>
  );
}

export function JoinGuildDialog({ open, onOpenChange, onJoined }: {
  open: boolean; onOpenChange: (v: boolean) => void; onJoined: (id: string) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("vox_join_by_invite", { _code: code.trim() });
    setBusy(false);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    onJoined(data as string);
    setCode("");
    onOpenChange(false);
    toast({ title: "Připojen!", description: "Vítej v novém serveru." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <HoloShell tag="// Link" title="Připojit přes pozvánku">
        <div className="space-y-3">
          <div className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/70">
            // Invite code
          </div>
          <Input
            value={code}
            autoFocus
            onChange={(e) => setCode(e.target.value)}
            placeholder="např. a1b2c3d4e5"
            onKeyDown={(e) => e.key === "Enter" && join()}
            className="bg-background/40 border-primary/30 font-display tracking-[0.2em] uppercase focus-visible:border-primary/70 focus-visible:ring-primary/30"
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="uppercase tracking-wider">Zrušit</Button>
          <Button
            onClick={join}
            disabled={busy || !code.trim()}
            className="uppercase tracking-wider bg-primary/20 border border-primary/60 text-primary hover:bg-primary/30 hover:text-primary shadow-[0_0_16px_hsl(var(--primary)/0.35)]"
          >
            {busy ? "Link…" : "Připojit"}
          </Button>
        </DialogFooter>
      </HoloShell>
    </Dialog>
  );
}
