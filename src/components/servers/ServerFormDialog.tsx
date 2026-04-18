import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Game = {
  id: string;
  name: string;
  connection_type: "ip_port" | "invite_code";
};

type Server = {
  id: string;
  game_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  ip: string | null;
  port: number | null;
  invite_code: string | null;
  website_url: string | null;
  discord_url: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  games: Game[];
  editing: Server | null;
  onSaved: () => void;
}

export function ServerFormDialog({ open, onOpenChange, games, editing, onSaved }: Props) {
  const { user } = useAuth();
  const [gameId, setGameId] = useState<string>("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState<string>("");
  const [inviteCode, setInviteCode] = useState("");
  const [website, setWebsite] = useState("");
  const [discord, setDiscord] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setGameId(editing.game_id);
      setName(editing.name);
      setDescription(editing.description ?? "");
      setIp(editing.ip ?? "");
      setPort(editing.port?.toString() ?? "");
      setInviteCode(editing.invite_code ?? "");
      setWebsite(editing.website_url ?? "");
      setDiscord(editing.discord_url ?? "");
    } else {
      setGameId(games[0]?.id ?? "");
      setName("");
      setDescription("");
      setIp("");
      setPort("");
      setInviteCode("");
      setWebsite("");
      setDiscord("");
    }
  }, [open, editing, games]);

  const game = games.find((g) => g.id === gameId);

  const handleSave = async () => {
    if (!user || !gameId || !name.trim()) {
      toast.error("Vyplň hru a název");
      return;
    }
    if (game?.connection_type === "ip_port" && !ip.trim()) {
      toast.error("Vyplň IP adresu");
      return;
    }
    if (game?.connection_type === "invite_code" && !inviteCode.trim()) {
      toast.error("Vyplň invite kód");
      return;
    }

    setSaving(true);
    const payload = {
      game_id: gameId,
      owner_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      ip: game?.connection_type === "ip_port" ? ip.trim() : null,
      port: game?.connection_type === "ip_port" && port ? parseInt(port, 10) : null,
      invite_code: game?.connection_type === "invite_code" ? inviteCode.trim() : null,
      website_url: website.trim() || null,
      discord_url: discord.trim() || null,
    };

    const res = editing
      ? await supabase.from("servers").update(payload).eq("id", editing.id)
      : await supabase.from("servers").insert(payload);

    setSaving(false);
    if (res.error) return toast.error(res.error.message);

    toast.success(editing ? "Server upraven" : "Server přidán");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Upravit server" : "Přidat server"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Hra</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger><SelectValue placeholder="Vyber hru" /></SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Název serveru</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>

          <div>
            <Label>Popis (volitelné)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          {game?.connection_type === "ip_port" ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Label>IP adresa / hostname</Label>
                <Input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="play.example.com" />
              </div>
              <div>
                <Label>Port</Label>
                <Input
                  value={port}
                  onChange={(e) => setPort(e.target.value.replace(/\D/g, ""))}
                  placeholder="25565"
                />
              </div>
            </div>
          ) : (
            <div>
              <Label>Invite kód</Label>
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="ABC123"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Web (volitelné)</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </div>
            <div>
              <Label>Discord (volitelné)</Label>
              <Input value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.gg/" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Ukládám…" : editing ? "Uložit" : "Přidat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
