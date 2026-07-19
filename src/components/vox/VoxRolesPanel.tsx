import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Shield, Crown, Star, User, Heart, Zap, Award, Gem, Flame, Upload, ArrowUp, ArrowDown, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoxMember } from "@/components/vox/MemberList";

/**
 * Vestavěné ikony rolí (Lucide). Server ukládá jen slug (`icon: string`),
 * takže rozšíření katalogu je otázka jednoho řádku.
 */
export const ROLE_ICONS: Record<string, any> = {
  Crown, Shield, Star, User, Heart, Zap, Award, Gem, Flame,
};

/** Ovládaná sada oprávnění — server nezná pevnou strukturu, jsou to jen klíče v jsonb. */
export const PERMISSIONS: { key: string; label: string; hint: string }[] = [
  { key: "manage_server",    label: "Spravovat server",   hint: "Měnit název, ikonu a nastavení serveru." },
  { key: "manage_channels",  label: "Spravovat kanály",   hint: "Vytvářet, přejmenovat a mazat kanály." },
  { key: "manage_roles",     label: "Spravovat role",     hint: "Vytvářet role, upravovat oprávnění a přiřazovat je." },
  { key: "manage_messages",  label: "Spravovat zprávy",   hint: "Mazat a upravovat cizí zprávy." },
  { key: "kick_members",     label: "Vyhodit členy",      hint: "Odebrat člena ze serveru." },
  { key: "ban_members",      label: "Zabanovat členy",    hint: "Trvale zablokovat člena." },
  { key: "create_invite",    label: "Vytvořit pozvánku",  hint: "Získat pozvánkový kód pro server." },
  { key: "mention_everyone", label: "Zmínit @everyone",   hint: "Poslat notifikaci všem členům." },
];

export type VoxRole = {
  id: string;
  guild_id: string;
  name: string;
  color: string;
  icon: string | null;
  badge_url: string | null;
  position: number;
  is_default: boolean;
  hoist: boolean;
  permissions: Record<string, boolean>;
};

export function RoleBadge({ role, size = "sm" }: { role: Pick<VoxRole, "name" | "color" | "icon" | "badge_url">; size?: "sm" | "md" }) {
  const Icon = role.icon && ROLE_ICONS[role.icon];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium border",
        size === "sm" ? "text-[10.5px] px-1.5 py-0.5" : "text-xs px-2 py-0.5"
      )}
      style={{ color: role.color, borderColor: `${role.color}55`, background: `${role.color}12` }}
    >
      {role.badge_url ? (
        <img src={role.badge_url} alt="" className="w-3 h-3 rounded-sm object-cover" />
      ) : Icon ? (
        <Icon className="w-3 h-3" />
      ) : null}
      {role.name}
    </span>
  );
}

interface Props {
  guildId: string;
  canManage: boolean;
  members: VoxMember[];
}

export function VoxRolesPanel({ guildId, canManage, members }: Props) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<VoxRole[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({}); // user_id -> role_ids
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from("vox_roles").select("*").eq("guild_id", guildId).order("position", { ascending: false }),
      supabase.from("vox_member_roles").select("user_id, role_id").eq("guild_id", guildId),
    ]);
    setRoles((r || []) as VoxRole[]);
    const map: Record<string, string[]> = {};
    (a || []).forEach((row: any) => {
      (map[row.user_id] ||= []).push(row.role_id);
    });
    setAssignments(map);
    setLoading(false);
    if (!selectedId && r && r.length) setSelectedId(r[0].id);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [guildId]);

  const selected = useMemo(() => roles.find(r => r.id === selectedId) || null, [roles, selectedId]);

  const createRole = async () => {
    setCreating(true);
    const { data, error } = await supabase.from("vox_roles").insert({
      guild_id: guildId,
      name: `Nová role ${roles.length + 1}`,
      color: "#94a3b8",
      icon: "Star",
      position: 10,
      permissions: Object.fromEntries(PERMISSIONS.map(p => [p.key, false])),
    }).select().single();
    setCreating(false);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    setRoles([data as VoxRole, ...roles]);
    setSelectedId((data as VoxRole).id);
  };

  const patchRole = async (id: string, patch: Partial<VoxRole>) => {
    setRoles(rs => rs.map(r => r.id === id ? { ...r, ...patch } as VoxRole : r));
    const { error } = await supabase.from("vox_roles").update(patch as any).eq("id", id);
    if (error) { toast({ title: "Chyba", description: error.message, variant: "destructive" }); load(); }
  };

  const deleteRole = async (id: string) => {
    if (!window.confirm("Smazat tuto roli? Ztratíš přiřazení všem členům.")) return;
    const { error } = await supabase.from("vox_roles").delete().eq("id", id);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    setRoles(rs => rs.filter(r => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const swapPositions = async (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= roles.length || j >= roles.length) return;
    const a = roles[i], b = roles[j];
    const next = [...roles];
    next[i] = { ...a, position: b.position };
    next[j] = { ...b, position: a.position };
    // Roles list is displayed in position DESC; keep sort stable.
    next.sort((x, y) => y.position - x.position);
    setRoles(next);
    await Promise.all([
      supabase.from("vox_roles").update({ position: b.position }).eq("id", a.id),
      supabase.from("vox_roles").update({ position: a.position }).eq("id", b.id),
    ]);
  };

  const toggleAssignment = async (userId: string, roleId: string, on: boolean) => {
    if (on) {
      const { error } = await supabase.from("vox_member_roles").insert({ guild_id: guildId, user_id: userId, role_id: roleId });
      if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setAssignments(a => ({ ...a, [userId]: [...(a[userId] || []), roleId] }));
    } else {
      const { error } = await supabase.from("vox_member_roles").delete()
        .eq("guild_id", guildId).eq("user_id", userId).eq("role_id", roleId);
      if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
      setAssignments(a => ({ ...a, [userId]: (a[userId] || []).filter(r => r !== roleId) }));
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const uploadBadge = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected || !user) return;
    if (file.size > 1 * 1024 * 1024) return toast({ title: "Max 1 MB", variant: "destructive" });
    const path = `${user.id}/role-badges/${selected.id}-${Date.now()}.${(file.name.split(".").pop() || "png").toLowerCase()}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    patchRole(selected.id, { badge_url: data.publicUrl });
  };

  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Načítám role…</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      {/* Seznam rolí */}
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Role serveru</span>
          {canManage && (
            <Button size="sm" variant="ghost" onClick={createRole} disabled={creating} className="h-7 px-2">
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
        {roles.map((r, idx) => (
          <div
            key={r.id}
            className={cn(
              "group w-full flex items-center gap-1 text-left px-2 py-1.5 rounded text-sm",
              selectedId === r.id ? "bg-primary/15" : "hover:bg-secondary/60",
            )}
          >
            <button onClick={() => setSelectedId(r.id)} className="flex items-center gap-2 flex-1 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
              <span className="flex-1 truncate">{r.name}</span>
              {r.hoist && <span className="text-[9.5px] text-primary/80 uppercase tracking-wider">hoist</span>}
              {r.is_default && <span className="text-[10px] text-muted-foreground">výchozí</span>}
            </button>
            {canManage && (
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5">
                <button
                  disabled={idx === 0}
                  onClick={() => swapPositions(idx, idx - 1)}
                  className="p-0.5 rounded hover:bg-secondary disabled:opacity-30"
                  title="Nahoru"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  disabled={idx === roles.length - 1}
                  onClick={() => swapPositions(idx, idx + 1)}
                  className="p-0.5 rounded hover:bg-secondary disabled:opacity-30"
                  title="Dolů"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detail role */}
      <div>
        {!selected && <div className="text-sm text-muted-foreground">Vyber roli vlevo, nebo vytvoř novou.</div>}
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <RoleBadge role={selected} size="md" />
              {canManage && !selected.is_default && (
                <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => deleteRole(selected.id)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Smazat
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Název</Label>
                <Input
                  className="mt-1.5" value={selected.name}
                  disabled={!canManage}
                  onChange={(e) => setRoles(rs => rs.map(r => r.id === selected.id ? { ...r, name: e.target.value } : r))}
                  onBlur={(e) => patchRole(selected.id, { name: e.target.value.trim() || selected.name })}
                />
              </div>
              <div>
                <Label>Barva</Label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="color" disabled={!canManage} value={selected.color}
                    onChange={(e) => patchRole(selected.id, { color: e.target.value })}
                    className="w-10 h-10 rounded border border-border/40 bg-transparent"
                  />
                  <Input value={selected.color} disabled={!canManage}
                    onChange={(e) => patchRole(selected.id, { color: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-md border border-border/40 p-3">
              <div>
                <div className="text-sm font-medium">Zobrazit členy s touto rolí odděleně</div>
                <div className="text-[11px] text-muted-foreground">
                  Členové budou v seznamu členů vedeni v samostatné kategorii pod názvem role (podobně jako na Discordu).
                </div>
              </div>
              <Switch
                checked={!!selected.hoist}
                disabled={!canManage}
                onCheckedChange={(v) => patchRole(selected.id, { hoist: v })}
              />
            </div>

            <div>
              <Label>Ikona</Label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {Object.keys(ROLE_ICONS).map(k => {
                  const I = ROLE_ICONS[k];
                  return (
                    <button
                      key={k} disabled={!canManage}
                      onClick={() => patchRole(selected.id, { icon: k, badge_url: null })}
                      className={cn(
                        "w-8 h-8 rounded border flex items-center justify-center transition",
                        selected.icon === k && !selected.badge_url ? "border-primary bg-primary/15" : "border-border/40 hover:bg-secondary/60"
                      )}
                      title={k}
                    >
                      <I className="w-4 h-4" style={{ color: selected.color }} />
                    </button>
                  );
                })}
                {canManage && (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadBadge} />
                    <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} className="h-8">
                      <Upload className="w-3.5 h-3.5 mr-1" /> Vlastní badge
                    </Button>
                    {selected.badge_url && (
                      <Button size="sm" variant="ghost" onClick={() => patchRole(selected.id, { badge_url: null })} className="h-8">
                        Odebrat
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Oprávnění</Label>
              <div className="space-y-2 rounded-md border border-border/40 p-3">
                {PERMISSIONS.map(p => (
                  <div key={p.key} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm">{p.label}</div>
                      <div className="text-[11px] text-muted-foreground">{p.hint}</div>
                    </div>
                    <Switch
                      checked={!!selected.permissions?.[p.key]}
                      disabled={!canManage}
                      onCheckedChange={(v) => patchRole(selected.id, {
                        permissions: { ...(selected.permissions || {}), [p.key]: v },
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Členové s touto rolí</Label>
              <div className="space-y-1 max-h-72 overflow-y-auto rounded-md border border-border/40 p-2">
                {members.length === 0 && <div className="text-sm text-muted-foreground p-2">Žádní členové.</div>}
                {members.map(m => {
                  const has = (assignments[m.user_id] || []).includes(selected.id);
                  return (
                    <label key={m.user_id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/50 cursor-pointer">
                      <input
                        type="checkbox" checked={has} disabled={!canManage}
                        onChange={(e) => toggleAssignment(m.user_id, selected.id, e.target.checked)}
                      />
                      <div className="w-6 h-6 rounded-full bg-primary/20 overflow-hidden flex items-center justify-center text-[10px] font-semibold">
                        {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-full h-full object-cover" /> : (m.display_name || "?").slice(0,2).toUpperCase()}
                      </div>
                      <span className="text-sm truncate">{m.display_name || m.nickname || m.user_id.slice(0,8)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
