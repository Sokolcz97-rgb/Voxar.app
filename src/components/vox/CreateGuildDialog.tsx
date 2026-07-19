import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vytvořit server</DialogTitle>
          <DialogDescription>Nový server dostane textový kanál <b>#obecné</b> a hlasový kanál <b>General</b>.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Název serveru</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Např. Moje parta" onKeyDown={(e) => e.key === "Enter" && create()} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={create} disabled={busy || !name.trim()}>Vytvořit</Button>
        </DialogFooter>
      </DialogContent>
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Připojit se přes pozvánku</DialogTitle>
          <DialogDescription>Vlož pozvánkový kód, který ti někdo poslal.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Pozvánkový kód</Label>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="např. a1b2c3d4e5" onKeyDown={(e) => e.key === "Enter" && join()} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={join} disabled={busy || !code.trim()}>Připojit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
