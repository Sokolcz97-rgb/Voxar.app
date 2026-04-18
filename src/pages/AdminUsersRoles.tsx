import { useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Shield, Search, UserCog, ChevronDown, Plus, Trash2, Pencil } from "lucide-react";
import { clearPermissionsCache } from "@/hooks/usePermissions";

type Role = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  is_builtin: boolean;
  position: number;
};

type Permission = {
  id: string;
  module: string;
  action: string;
  label: string;
  description: string | null;
  position: number;
};

interface ProfileRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

const BUILTIN_ENUM = new Set(["admin", "editor", "user", "banned", "content_creator"]);

const MODULE_LABELS: Record<string, string> = {
  forum: "Fórum",
  tickets: "Tickety",
  servers: "Servery",
  pages: "Page Builder",
  messages: "Zprávy",
  profiles: "Profily",
  admin: "Administrace",
  discord: "Discord",
  streams: "Streamy",
  site: "Web",
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

const AdminUsersRoles = () => {
  const { user, isAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "roles" ? "roles" : "users";

  // Shared roles
  const [allRoles, setAllRoles] = useState<Role[]>([]);

  // Users tab state
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Roles tab state
  const [perms, setPerms] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const loadRoles = async () => {
    const { data } = await supabase.from("roles").select("*").order("position");
    setAllRoles((data ?? []) as Role[]);
    if (!activeRoleId && data && data.length) setActiveRoleId(data[0].id);
  };

  const loadUsers = async (q: string) => {
    setLoadingUsers(true);
    let query = supabase.from("profiles").select("user_id, username, display_name, avatar_url").limit(50);
    if (q.trim()) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    const { data: profs } = await query;
    setProfiles(profs ?? []);
    if (profs && profs.length) {
      const ids = profs.map((p) => p.user_id);
      const { data: ur } = await supabase
        .from("user_roles")
        .select("user_id, role, role_id")
        .in("user_id", ids);
      const { data: rolesAll } = await supabase.from("roles").select("id, slug");
      const slugToId = new Map<string, string>();
      (rolesAll ?? []).forEach((r: any) => slugToId.set(r.slug, r.id));
      const map: Record<string, string[]> = {};
      (ur ?? []).forEach((r: any) => {
        const rid = r.role_id ?? slugToId.get(r.role);
        if (!rid) return;
        map[r.user_id] = [...(map[r.user_id] ?? []), rid];
      });
      setRolesByUser(map);
    } else {
      setRolesByUser({});
    }
    setLoadingUsers(false);
  };

  const loadPermsMatrix = async () => {
    const [{ data: p }, { data: rp }] = await Promise.all([
      supabase.from("permissions").select("*").order("position"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);
    setPerms((p ?? []) as Permission[]);
    const m: Record<string, Set<string>> = {};
    (rp ?? []).forEach((row: any) => {
      if (!m[row.role_id]) m[row.role_id] = new Set();
      m[row.role_id].add(row.permission_id);
    });
    setMatrix(m);
  };

  useEffect(() => {
    loadRoles();
    loadUsers("");
    loadPermsMatrix();
  }, []);

  const toggleRole = async (uid: string, role: Role) => {
    const has = (rolesByUser[uid] ?? []).includes(role.id);
    if (uid === user?.id && role.slug === "admin" && has) {
      toast.error("Nemůžeš si odebrat admin roli");
      return;
    }
    if (uid === user?.id && role.slug === "banned" && !has) {
      toast.error("Nemůžeš zabanovat sám sebe");
      return;
    }
    if (has) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", uid)
        .or(`role_id.eq.${role.id},role.eq.${role.slug}`);
      if (error) return toast.error(error.message);
      setRolesByUser((m) => ({ ...m, [uid]: (m[uid] ?? []).filter((r) => r !== role.id) }));
      toast.success("Role odebrána");
    } else {
      const roleEnum: any = BUILTIN_ENUM.has(role.slug) ? role.slug : "user";
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: uid, role: roleEnum, role_id: role.id });
      if (error) return toast.error(error.message);
      setRolesByUser((m) => ({ ...m, [uid]: [...(m[uid] ?? []), role.id] }));
      toast.success("Role přidána");
    }
    if (uid === user?.id) clearPermissionsCache();
  };

  const permsByModule = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    perms.forEach((p) => {
      if (!groups[p.module]) groups[p.module] = [];
      groups[p.module].push(p);
    });
    return groups;
  }, [perms]);

  const togglePermission = async (roleId: string, permId: string) => {
    const role = allRoles.find((r) => r.id === roleId);
    if (role?.slug === "admin") {
      toast.error("Admin má vždy všechna oprávnění");
      return;
    }
    const has = matrix[roleId]?.has(permId);
    if (has) {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId)
        .eq("permission_id", permId);
      if (error) return toast.error(error.message);
      setMatrix((m) => {
        const next = { ...m };
        next[roleId] = new Set(next[roleId]);
        next[roleId].delete(permId);
        return next;
      });
    } else {
      const { error } = await supabase
        .from("role_permissions")
        .insert({ role_id: roleId, permission_id: permId });
      if (error) return toast.error(error.message);
      setMatrix((m) => {
        const next = { ...m };
        next[roleId] = new Set(next[roleId] ?? []);
        next[roleId].add(permId);
        return next;
      });
    }
    clearPermissionsCache();
  };

  const openNew = () => {
    setEditingRole(null);
    setName(""); setSlug(""); setDescription(""); setColor("#3b82f6");
    setOpenCreate(true);
  };

  const openEdit = (r: Role) => {
    setEditingRole(r);
    setName(r.name); setSlug(r.slug); setDescription(r.description ?? "");
    setColor(r.color ?? "#3b82f6");
    setOpenCreate(true);
  };

  const handleSaveRole = async () => {
    if (!name.trim() || !slug.trim()) return toast.error("Vyplň název a slug");
    const payload: any = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      color,
    };
    if (editingRole) {
      if (editingRole.is_builtin) delete payload.slug;
      const { error } = await supabase.from("roles").update(payload).eq("id", editingRole.id);
      if (error) return toast.error(error.message);
      toast.success("Role uložena");
    } else {
      payload.is_builtin = false;
      payload.position = 200;
      const { error } = await supabase.from("roles").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Role vytvořena");
    }
    setOpenCreate(false);
    loadRoles();
  };

  const handleDeleteRole = async (r: Role) => {
    if (r.is_builtin) return toast.error("Vestavěnou roli nelze smazat");
    if (!confirm(`Smazat roli "${r.name}"? Všem uživatelům s touto rolí bude odebrána.`)) return;
    const { error } = await supabase.from("roles").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    if (activeRoleId === r.id) setActiveRoleId(null);
    clearPermissionsCache();
    loadRoles();
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 -z-10 gradient-hero" />
        <Navbar />
        <main className="container py-10">
          <Card className="glass border-border p-10 text-center">
            <Shield className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="font-display font-bold text-2xl">Pouze pro adminy</h2>
          </Card>
        </main>
      </div>
    );
  }

  const roleById = (id: string) => allRoles.find((r) => r.id === id);
  const activeRole = allRoles.find((r) => r.id === activeRoleId);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" /> Zpět
        </Link>

        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Administrace</p>
          <h1 className="font-display font-black text-3xl md:text-4xl mt-2 flex items-center gap-3">
            <UserCog className="h-8 w-8 text-primary" /> Uživatelé, role &amp; oprávnění
          </h1>
          <p className="text-muted-foreground mt-2">
            Spravuj uživatelské účty, vytvářej role a nastav, co každá role smí dělat.
          </p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="space-y-6">
          <TabsList>
            <TabsTrigger value="users"><UserCog className="h-4 w-4 mr-1" />Uživatelé</TabsTrigger>
            <TabsTrigger value="roles"><Shield className="h-4 w-4 mr-1" />Role &amp; oprávnění</TabsTrigger>
          </TabsList>

          {/* USERS TAB */}
          <TabsContent value="users" className="space-y-6">
            <Card className="glass border-border p-4">
              <form
                onSubmit={(e) => { e.preventDefault(); loadUsers(search); }}
                className="flex gap-2"
              >
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Hledat podle jména..."
                    className="pl-9 bg-background/50"
                  />
                </div>
                <Button type="submit" disabled={loadingUsers}>Hledat</Button>
              </form>
            </Card>

            <div className="space-y-3">
              {profiles.map((p) => {
                const userRoleIds = rolesByUser[p.user_id] ?? [];
                const initials = (p.display_name || p.username || "?").slice(0, 2).toUpperCase();
                return (
                  <Card key={p.user_id} className="glass border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Avatar className="h-11 w-11 border border-border">
                        {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-display font-bold truncate">
                          {p.display_name || p.username || "Hráč"}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">@{p.username || "—"}</div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {userRoleIds.length === 0 && (
                            <Badge variant="outline" className="text-xs">žádná role</Badge>
                          )}
                          {userRoleIds.map((rid) => {
                            const r = roleById(rid);
                            if (!r) return null;
                            return (
                              <Badge
                                key={rid}
                                variant={r.slug === "admin" ? "default" : r.slug === "banned" ? "destructive" : "secondary"}
                                className="text-xs"
                                style={r.color && r.slug !== "admin" && r.slug !== "banned" ? { backgroundColor: `${r.color}33`, color: r.color, borderColor: `${r.color}66` } : undefined}
                              >
                                {r.name}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          Přiřadit role <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 bg-card/95 backdrop-blur-md" align="end">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Role</div>
                        <div className="space-y-1 max-h-72 overflow-y-auto">
                          {allRoles.map((r) => {
                            const active = userRoleIds.includes(r.id);
                            return (
                              <label
                                key={r.id}
                                className="flex items-center gap-2 p-2 rounded hover:bg-primary/10 cursor-pointer"
                              >
                                <Checkbox checked={active} onCheckedChange={() => toggleRole(p.user_id, r)} />
                                <span className="text-sm flex-1">{r.name}</span>
                                {r.is_builtin && (
                                  <span className="text-[10px] uppercase text-muted-foreground">built-in</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </Card>
                );
              })}
              {!loadingUsers && profiles.length === 0 && (
                <Card className="glass border-border p-10 text-center text-muted-foreground">
                  Žádné výsledky
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ROLES TAB */}
          <TabsContent value="roles" className="space-y-6">
            <div className="flex justify-end">
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nová role</Button>
            </div>

            <div className="grid lg:grid-cols-[280px,1fr] gap-6">
              <Card className="glass border-border p-3 h-fit">
                <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-1">Role</div>
                <div className="space-y-1">
                  {allRoles.map((r) => {
                    const active = r.id === activeRoleId;
                    return (
                      <div
                        key={r.id}
                        className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition ${
                          active ? "bg-primary/15 border border-primary/40" : "hover:bg-primary/5 border border-transparent"
                        }`}
                        onClick={() => setActiveRoleId(r.id)}
                      >
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: r.color ?? "hsl(var(--muted-foreground))" }} />
                        <span className="flex-1 text-sm truncate">{r.name}</span>
                        {r.is_builtin && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">built-in</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>

              {activeRole ? (
                <Card className="glass border-border p-5">
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ background: activeRole.color ?? "hsl(var(--muted-foreground))" }} />
                        <h2 className="font-display font-bold text-2xl">{activeRole.name}</h2>
                        {activeRole.is_builtin && <Badge variant="outline">vestavěná</Badge>}
                      </div>
                      {activeRole.description && (
                        <p className="text-sm text-muted-foreground mt-1">{activeRole.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">slug: <code>{activeRole.slug}</code></p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(activeRole)}>
                        <Pencil className="h-3 w-3 mr-1" />Upravit
                      </Button>
                      {!activeRole.is_builtin && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeleteRole(activeRole)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {activeRole.slug === "admin" && (
                    <div className="text-sm p-3 rounded-md bg-primary/10 border border-primary/30 mb-4">
                      Admin má automaticky všechna oprávnění a nelze je odebrat.
                    </div>
                  )}

                  <div className="space-y-5">
                    {Object.entries(permsByModule).map(([module, list]) => (
                      <div key={module}>
                        <div className="font-display font-bold text-sm uppercase tracking-wider text-primary mb-2">
                          {MODULE_LABELS[module] ?? module}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {list.map((p) => {
                            const checked = matrix[activeRole.id]?.has(p.id) ?? false;
                            return (
                              <label
                                key={p.id}
                                className={`flex items-start gap-2 p-3 rounded-md border transition ${
                                  checked ? "bg-primary/10 border-primary/40" : "bg-background/40 border-border hover:border-primary/30"
                                } ${activeRole.slug === "admin" ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={activeRole.slug === "admin"}
                                  onCheckedChange={() => togglePermission(activeRole.id, p.id)}
                                  className="mt-0.5"
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium">{p.label}</div>
                                  {p.description && (
                                    <div className="text-xs text-muted-foreground">{p.description}</div>
                                  )}
                                  <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                                    <code>{p.module}.{p.action}</code>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : (
                <Card className="glass border-border p-10 text-center text-muted-foreground">
                  Vyber roli vlevo
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Upravit roli" : "Nová role"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Název</Label>
              <Input value={name} onChange={(e) => {
                setName(e.target.value);
                if (!editingRole) setSlug(slugify(e.target.value));
              }} />
            </div>
            <div>
              <Label>Slug {editingRole?.is_builtin && <span className="text-xs text-muted-foreground">(vestavěná — nelze měnit)</span>}</Label>
              <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} disabled={editingRole?.is_builtin} />
            </div>
            <div>
              <Label>Popis</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label>Barva</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-14 rounded border border-border bg-transparent cursor-pointer"
                />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenCreate(false)}>Zrušit</Button>
            <Button onClick={handleSaveRole}>{editingRole ? "Uložit" : "Vytvořit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersRoles;
