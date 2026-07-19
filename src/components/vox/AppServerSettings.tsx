import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Server as ServerIcon, Link2, Users, Trash2, X, Copy, RefreshCcw, Check, Hash, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoxGuild } from "@/components/vox/GuildRail";
import type { VoxChannel } from "@/components/vox/ChannelSidebar";
import type { VoxMember } from "@/components/vox/MemberList";

type Tab = "overview" | "invite" | "channels" | "members" | "danger";

interface Props {
  guild: VoxGuild;
  channels: VoxChannel[];
  members: VoxMember[];
  inviteCode: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onGuildUpdated: () => void;
  onGuildDeleted: () => void;
}

export function AppServerSettings({
  guild, channels, members, inviteCode, isOwner, isAdmin, onClose, onGuildUpdated, onGuildDeleted,
}: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");

  const [name, setName] = useState(guild.name);
  const [iconUrl, setIconUrl] = useState(guild.icon_url ?? "");
  const [description, setDescription] = useState("");
  const [invite, setInvite] = useState(inviteCode);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(guild.name);
    setIconUrl(guild.icon_url ?? "");
    setInvite(inviteCode);
  }, [guild.id, inviteCode]);

  const saveOverview = async () => {
    setSaving(true);
    const { error } = await supabase.from("vox_guilds").update({
      name: name.trim() || guild.name,
      icon_url: iconUrl.trim() || null,
    }).eq("id", guild.id);
    setSaving(false);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else { toast({ title: "Uloženo", description: "Server aktualizován." }); onGuildUpdated(); }
  };

  const copyInvite = () => {
    if (!invite) return;
    navigator.clipboard.writeText(invite);
    setCopied(true);
    toast({ title: "Zkopírováno", description: "Pozvánkový kód ve schránce." });
    setTimeout(() => setCopied(false), 1500);
  };

  const regenerateInvite = async () => {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
    const { error } = await supabase.from("vox_guilds").update({ invite_code: code }).eq("id", guild.id);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    setInvite(code);
    onGuildUpdated();
    toast({ title: "Vytvořen nový kód" });
  };

  const renameChannel = async (ch: VoxChannel) => {
    const n = window.prompt("Nový název kanálu:", ch.name);
    if (!n) return;
    const { error } = await supabase.from("vox_channels").update({
      name: n.trim().toLowerCase().replace(/\s+/g, "-"),
    }).eq("id", ch.id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
  };
  const deleteChannel = async (ch: VoxChannel) => {
    if (!window.confirm(`Smazat kanál "${ch.name}"?`)) return;
    const { error } = await supabase.from("vox_channels").delete().eq("id", ch.id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
  };

  const kickMember = async (m: VoxMember) => {
    if (!window.confirm(`Odebrat ${m.display_name || m.nickname || "člena"}?`)) return;
    const { error } = await supabase.from("vox_guild_members").delete()
      .eq("guild_id", guild.id).eq("user_id", m.user_id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else toast({ title: "Odebráno" });
  };
  const setRole = async (m: VoxMember, role: "member" | "mod" | "owner") => {
    const { error } = await supabase.from("vox_guild_members").update({ role })
      .eq("guild_id", guild.id).eq("user_id", m.user_id);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
  };

  const deleteGuild = async () => {
    const { error } = await supabase.from("vox_guilds").delete().eq("id", guild.id);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    toast({ title: "Server smazán" });
    onGuildDeleted();
  };
  const leaveGuild = async () => {
    if (!user) return;
    const { error } = await supabase.from("vox_guild_members").delete()
      .eq("guild_id", guild.id).eq("user_id", user.id);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    toast({ title: "Opustil jsi server" });
    onGuildDeleted();
  };

  const tabs: { key: Tab; label: string; icon: any; adminOnly?: boolean }[] = [
    { key: "overview", label: "Přehled", icon: ServerIcon, adminOnly: true },
    { key: "invite", label: "Pozvánky", icon: Link2 },
    { key: "channels", label: "Kanály", icon: Hash, adminOnly: true },
    { key: "members", label: "Členové", icon: Users },
    { key: "danger", label: isOwner ? "Nebezpečná zóna" : "Opustit server", icon: Trash2 },
  ];

  return (
    <div className="flex-1 flex bg-[hsl(220_30%_4%)] overflow-hidden">
      <aside className="w-64 shrink-0 border-r border-border/40 bg-[hsl(222_35%_5%)] p-4 overflow-y-auto">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 mb-2 truncate">{guild.name}</div>
        <nav className="space-y-0.5">
          {tabs.filter(t => !t.adminOnly || isAdmin).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                tab === t.key ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{tabs.find(t => t.key === tab)?.label}</h1>
            <Button variant="ghost" size="icon" onClick={onClose} title="Zavřít">
              <X className="w-5 h-5" />
            </Button>
          </div>

          {tab === "overview" && isAdmin && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/20 overflow-hidden flex items-center justify-center text-2xl font-bold">
                  {iconUrl
                    ? <img src={iconUrl} alt="" className="w-full h-full object-cover" />
                    : name.slice(0, 2).toUpperCase()}
                </div>
                <div className="text-sm text-muted-foreground">Profil serveru — jméno a ikona jsou viditelné všem členům.</div>
              </div>
              <div>
                <Label>Název serveru</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" />
              </div>
              <div>
                <Label>URL ikony serveru</Label>
                <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://…" className="mt-1.5" />
              </div>
              <div>
                <Label>Popis (interně)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1.5" />
              </div>
              <Button onClick={saveOverview} disabled={saving}>{saving ? "Ukládám…" : "Uložit"}</Button>
            </div>
          )}

          {tab === "invite" && (
            <div className="space-y-5">
              <div>
                <Label>Pozvánkový kód</Label>
                <div className="mt-1.5 flex gap-2">
                  <Input value={invite ?? ""} readOnly className="font-mono" />
                  <Button variant="secondary" onClick={copyInvite} title="Kopírovat">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  {isAdmin && (
                    <Button variant="secondary" onClick={regenerateInvite} title="Vygenerovat nový">
                      <RefreshCcw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tento kód je unikátní pro tento server. Sdílej ho jen s lidmi, které chceš pozvat.
                </p>
              </div>
            </div>
          )}

          {tab === "channels" && isAdmin && (
            <div className="space-y-2">
              {channels.length === 0 && <div className="text-sm text-muted-foreground">Žádné kanály.</div>}
              {channels.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/40">
                  {c.type === "text" ? <Hash className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span className="flex-1 truncate">{c.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => renameChannel(c)}>Přejmenovat</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteChannel(c)}>Smazat</Button>
                </div>
              ))}
            </div>
          )}

          {tab === "members" && (
            <div className="space-y-1.5">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-secondary/40">
                  <div className="w-8 h-8 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center text-xs font-semibold">
                    {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.display_name || m.nickname || "?").slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{m.display_name || m.nickname || m.user_id.slice(0,8)}</div>
                    <div className="text-[11px] text-muted-foreground">{m.role}</div>
                  </div>
                  {isOwner && m.user_id !== user?.id && (
                    <>
                      {m.role !== "mod" && <Button size="sm" variant="ghost" onClick={() => setRole(m, "mod")}>Povýšit</Button>}
                      {m.role === "mod" && <Button size="sm" variant="ghost" onClick={() => setRole(m, "member")}>Sundat</Button>}
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => kickMember(m)}>Kick</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === "danger" && (
            <div className="space-y-4">
              {isOwner ? (
                <div className="p-4 rounded-md border border-destructive/40 bg-destructive/5">
                  <div className="font-semibold text-destructive mb-1">Smazat server</div>
                  <p className="text-sm text-muted-foreground mb-3">Tato akce je nevratná. Smaže všechny kanály, zprávy a členy.</p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">Smazat "{guild.name}"</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Opravdu smazat server?</AlertDialogTitle>
                        <AlertDialogDescription>Tuto akci nelze vzít zpět.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Zrušit</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteGuild}>Smazat</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ) : (
                <div className="p-4 rounded-md border border-destructive/40 bg-destructive/5">
                  <div className="font-semibold text-destructive mb-1">Opustit server</div>
                  <p className="text-sm text-muted-foreground mb-3">Přijdeš o přístup ke kanálům, můžeš se ale připojit zpět pozvánkou.</p>
                  <Button variant="destructive" onClick={leaveGuild}>Opustit "{guild.name}"</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
