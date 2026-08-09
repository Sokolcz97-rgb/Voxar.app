import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type DiscordServer = {
  id: string;
  name: string;
  description: string | null;
  invite_url: string;
  icon_url: string | null;
  is_featured: boolean;
  is_active: boolean;
  position: number;
};

const empty: Partial<DiscordServer> = {
  name: "",
  description: "",
  invite_url: "",
  icon_url: "",
  is_featured: false,
  is_active: true,
  position: 100,
};

const AdminDiscord = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<DiscordServer[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<DiscordServer>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("discord_servers")
      .select("*")
      .order("is_featured", { ascending: false })
      .order("position");
    if (error) return toast.error(error.message);
    setItems((data ?? []) as DiscordServer[]);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(empty);
    setOpen(true);
  };

  const openEdit = (s: DiscordServer) => {
    setEditing(s);
    setOpen(true);
  };

  const save = async () => {
    if (!editing.name || !editing.invite_url) {
      toast.error("Vyplň název a invite URL");
      return;
    }
    setSaving(true);
    const payload = {
      name: editing.name!,
      description: editing.description || null,
      invite_url: editing.invite_url!,
      icon_url: editing.icon_url || null,
      is_featured: !!editing.is_featured,
      is_active: editing.is_active ?? true,
      position: editing.position ?? 100,
    };
    const { error } = editing.id
      ? await supabase.from("discord_servers").update(payload).eq("id", editing.id)
      : await supabase
          .from("discord_servers")
          .insert({ ...payload, created_by: user?.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Uloženo");
    setOpen(false);
    load();
  };

  const del = async (s: DiscordServer) => {
    if (!confirm(`Smazat "${s.name}"?`)) return;
    const { error } = await supabase.from("discord_servers").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    load();
  };

  const setFeatured = async (s: DiscordServer) => {
    const { error } = await supabase
      .from("discord_servers")
      .update({ is_featured: true, is_active: true })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success(`"${s.name}" je nyní zvýrazněný na úvodce`);
    load();
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">
              Discord
            </p>
            <h1 className="font-display font-black text-4xl md:text-5xl mt-2">
              Discord servery
            </h1>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Spravuj seznam Discord serverů. Označený server jako "Featured" se
              zobrazí jako tlačítko na úvodní stránce (jen jeden).
            </p>
          </div>
          <Button
            onClick={openNew}
            className="bg-primary text-primary-foreground hover:bg-primary-glow"
          >
            <Plus className="h-4 w-4 mr-1" /> Přidat Discord
          </Button>
        </div>

        {items.length === 0 ? (
          <Card className="glass border-border p-10 text-center text-muted-foreground">
            Žádné Discord servery zatím nejsou.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((s) => (
              <Card
                key={s.id}
                className={`glass border-border p-5 transition-all ${
                  s.is_featured ? "border-primary/60" : ""
                }`}
              >
                <div className="flex items-start gap-3 mb-3">
                  {s.icon_url ? (
                    <img loading="lazy" decoding="async"
                      src={s.icon_url}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-[#5865F2]/20 border border-[#5865F2]/40 flex items-center justify-center font-bold text-[#5865F2]">
                      D
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold truncate">{s.name}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.is_featured && (
                        <Badge className="bg-primary/20 text-primary border-primary/40 gap-1">
                          <Star className="h-3 w-3" /> Featured
                        </Badge>
                      )}
                      {!s.is_active && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Skryto
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {s.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {s.description}
                  </p>
                )}

                <a
                  href={s.invite_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 truncate max-w-full"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{s.invite_url}</span>
                </a>

                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  {!s.is_featured && (
                    <Button size="sm" variant="ghost" onClick={() => setFeatured(s)}>
                      <Star className="h-3 w-3 mr-1" /> Featured
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil className="h-3 w-3 mr-1" /> Upravit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive ml-auto"
                    onClick={() => del(s)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing.id ? "Upravit Discord" : "Přidat Discord"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Název *</Label>
              <Input
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="NeonHub Community"
              />
            </div>
            <div>
              <Label>Invite URL *</Label>
              <Input
                value={editing.invite_url ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, invite_url: e.target.value })
                }
                placeholder="https://discord.gg/xxxxxx"
              />
            </div>
            <div>
              <Label>Popis</Label>
              <Textarea
                value={editing.description ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, description: e.target.value })
                }
                placeholder="Krátký popis komunity…"
                rows={3}
              />
            </div>
            <div>
              <Label>Ikona (URL)</Label>
              <Input
                value={editing.icon_url ?? ""}
                onChange={(e) =>
                  setEditing({ ...editing, icon_url: e.target.value })
                }
                placeholder="https://…/icon.png"
              />
            </div>
            <div>
              <Label>Pozice</Label>
              <Input
                type="number"
                value={editing.position ?? 100}
                onChange={(e) =>
                  setEditing({ ...editing, position: Number(e.target.value) })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label className="cursor-pointer">Aktivní</Label>
                <p className="text-xs text-muted-foreground">
                  Pokud vypnuto, nezobrazuje se veřejně.
                </p>
              </div>
              <Switch
                checked={editing.is_active ?? true}
                onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-primary/30 p-3 bg-primary/5">
              <div>
                <Label className="cursor-pointer">Zvýraznit na úvodce</Label>
                <p className="text-xs text-muted-foreground">
                  Jen jeden server může být zvýrazněný — ostatní se odznačí.
                </p>
              </div>
              <Switch
                checked={editing.is_featured ?? false}
                onCheckedChange={(v) => setEditing({ ...editing, is_featured: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Zrušit
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary-glow"
            >
              {saving ? "Ukládám…" : "Uložit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDiscord;
