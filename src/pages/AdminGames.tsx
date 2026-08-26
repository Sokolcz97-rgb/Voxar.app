import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

type Game = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  connection_type: "ip_port" | "invite_code";
  steam_appid: number | null;
  position: number;
  is_active: boolean;
  color_tag: string;
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const AdminGames = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);

  // form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [conn, setConn] = useState<"ip_port" | "invite_code">("ip_port");
  const [steamId, setSteamId] = useState<string>("");
  const [position, setPosition] = useState<string>("100");
  const [colorTag, setColorTag] = useState<string>("#22d3ee");

  // steam search
  const [steamQ, setSteamQ] = useState("");
  const [steamResults, setSteamResults] = useState<Array<{ appid: number; name: string; icon_url: string | null }>>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("games").select("*").order("position");
    setGames((data ?? []) as Game[]);
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setName(""); setSlug(""); setDescription(""); setIconUrl("");
    setConn("ip_port"); setSteamId(""); setPosition("100"); setColorTag("#22d3ee"); setColorTag("#22d3ee");
    setSteamQ(""); setSteamResults([]);
    setOpen(true);
  };

  const openEdit = (g: Game) => {
    setEditing(g);
    setName(g.name); setSlug(g.slug); setDescription(g.description ?? "");
    setIconUrl(g.icon_url ?? ""); setConn(g.connection_type);
    setSteamId(g.steam_appid?.toString() ?? ""); setPosition(g.position.toString());
    setColorTag(g.color_tag || "#22d3ee");
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) return toast.error("Vyplň název a slug");
    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      icon_url: iconUrl.trim() || null,
      connection_type: conn,
      steam_appid: steamId ? parseInt(steamId, 10) : null,
      position: parseInt(position, 10) || 100,
      color_tag: colorTag,
    };
    const res = editing
      ? await supabase.from("games").update(payload).eq("id", editing.id)
      : await supabase.from("games").insert(payload);
    if (res.error) return toast.error(res.error.message);
    toast.success(editing ? "Hra upravena" : "Hra přidána");
    setOpen(false);
    load();
  };

  const handleDelete = async (g: Game) => {
    if (!confirm(`Smazat hru "${g.name}"? Smaže i všechny její servery.`)) return;
    const { error } = await supabase.from("games").delete().eq("id", g.id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    load();
  };

  const searchSteam = async () => {
    if (!steamQ.trim()) return;
    setSearching(true);
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/steam-search?q=${encodeURIComponent(steamQ)}`,
      { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
    );
    const json = await res.json();
    setSteamResults(json.results ?? []);
    setSearching(false);
  };

  const pickSteam = (it: { appid: number; name: string; icon_url: string | null }) => {
    setName(it.name);
    setSlug(slugify(it.name));
    setIconUrl(it.icon_url ?? "");
    setSteamId(it.appid.toString());
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Administrace</p>
            <h1 className="font-display font-black text-4xl mt-2">Hry</h1>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Přidat hru</Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((g) => (
            <Card key={g.id} className="glass border-border p-4">
              <div className="flex items-start gap-3">
                {g.icon_url ? (
                  <img loading="lazy" decoding="async" src={g.icon_url} alt="" className="h-12 w-12 rounded" />
                ) : (
                  <div className="h-12 w-12 rounded bg-primary/10 border border-primary/30" />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-bold truncate flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: g.color_tag, boxShadow: `0 0 10px ${g.color_tag}` }} />
                    <span className="truncate">{g.name}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">/{g.slug}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {g.connection_type === "ip_port" ? "IP + port" : "Invite kód"}
                    {g.steam_appid ? ` · Steam ${g.steam_appid}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                  <Pencil className="h-3 w-3 mr-1" />Upravit
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => handleDelete(g)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Upravit hru" : "Přidat hru"}</DialogTitle>
          </DialogHeader>

          {!editing && (
            <div className="space-y-2 p-3 rounded-md bg-background/40 border border-border">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Vyhledat na Steamu (volitelné)
              </Label>
              <div className="flex gap-2">
                <Input
                  value={steamQ}
                  onChange={(e) => setSteamQ(e.target.value)}
                  placeholder="Counter-Strike, Rust…"
                  onKeyDown={(e) => e.key === "Enter" && searchSteam()}
                />
                <Button size="sm" onClick={searchSteam} disabled={searching}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              {steamResults.length > 0 && (
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {steamResults.map((r) => (
                    <button
                      key={r.appid}
                      onClick={() => pickSteam(r)}
                      className="w-full flex items-center gap-2 p-2 rounded hover:bg-primary/10 text-left text-sm"
                    >
                      {r.icon_url && <img loading="lazy" decoding="async" src={r.icon_url} alt="" className="h-6 w-12 object-cover rounded" />}
                      <span className="truncate">{r.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">#{r.appid}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Název</Label>
                <Input value={name} onChange={(e) => {
                  setName(e.target.value);
                  if (!editing) setSlug(slugify(e.target.value));
                }} />
              </div>
              <div>
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
              </div>
            </div>
            <div>
              <Label>Popis</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Barevný tag</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={colorTag}
                  onChange={(e) => setColorTag(e.target.value)}
                  className="h-9 w-14 bg-transparent border border-border p-1 cursor-pointer"
                />
                <Input value={colorTag} onChange={(e) => setColorTag(e.target.value)} placeholder="#22d3ee" />
              </div>
            </div>
            <div>
              <Label>Ikona URL</Label>
              <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Typ připojení</Label>
                <Select value={conn} onValueChange={(v) => setConn(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ip_port">IP + port (Hytale, Minecraft…)</SelectItem>
                    <SelectItem value="invite_code">Invite kód (Windrose…)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Steam AppID</Label>
                <Input value={steamId} onChange={(e) => setSteamId(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
            <div>
              <Label>Pořadí</Label>
              <Input value={position} onChange={(e) => setPosition(e.target.value.replace(/\D/g, ""))} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Zrušit</Button>
            <Button onClick={handleSave}>{editing ? "Uložit" : "Přidat"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminGames;
