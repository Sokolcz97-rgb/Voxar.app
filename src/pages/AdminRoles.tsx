import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Shield, Plus, Trash2, Pencil } from "lucide-react";
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

const MODULE_LABELS: Record<string, string> = {
  forum: "Fórum",
  tickets: "Tickety",
  servers: "Servery",
  pages: "Page Builder",
  messages: "Zprávy",
  profiles: "Profily",
  admin: "Administrace",
};

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

const AdminRoles = () => {
  const { isAdmin } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  // role_id -> Set of permission_id
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // form
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");

  const loadAll = async () => {
    const [{ data: r }, { data: p }, { data: rp }] = await Promise.all([
      supabase.from("roles").select("*").order("position"),
      supabase.from("permissions").select("*").order("position"),
      supabase.from("role_permissions").select("role_id, permission_id"),
    ]);
    setRoles((r ?? []) as Role[]);
    setPerms((p ?? []) as Permission[]);
    const m: Record<string, Set<string>> = {};
    (rp ?? []).forEach((row: any) => {
      if (!m[row.role_id]) m[row.role_id] = new Set();
      m[row.role_id].add(row.permission_id);
    });
    setMatrix(m);
    if (!activeRoleId && r && r.length) setActiveRoleId(r[0].id);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const permsByModule = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    perms.forEach((p) => {
      if (!groups[p.module]) groups[p.module] = [];
      groups[p.module].push(p);
    });
    return groups;
  }, [perms]);

  const togglePermission = async (roleId: string, permId: string) => {
    const role = roles.find((r) => r.id === roleId);
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

  const handleSave = async () => {
    if (!name.trim() || !slug.trim()) return toast.error("Vyplň název a slug");
    const payload: any = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      color,
    };
    if (editingRole) {
      // builtin slug protected by trigger
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
    loadAll();
  };

  const handleDelete = async (r: Role) => {
    if (r.is_builtin) return toast.error("Vestavěnou roli nelze smazat");
    if (!confirm(`Smazat roli "${r.name}"? Všem uživatelům s touto rolí bude odebrána.`)) return;
    const { error } = await supabase.from("roles").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    if (activeRoleId === r.id) setActiveRoleId(null);
    clearPermissionsCache();
    loadAll();
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

  const activeRole = roles.find((r) => r.id === activeRoleId);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" /> Zpět
        </Link>

        <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Administrace</p>
            <h1 className="font-display font-black text-3xl md:text-4xl mt-2 flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" /> Role & Oprávnění
            </h1>
            <p className="text-muted-foreground mt-2">
              Spravuj role a nastav, co každá role smí dělat napříč webem.
            </p>
          </div>
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nová role</Button>
        </div>

        <div className="grid lg:grid-cols-[280px,1fr] gap-6">
          {/* Roles sidebar */}
          <Card className="glass border-border p-3 h-fit">
            <div className="text-xs uppercase tracking-wider text-muted-foreground px-2 py-1">Role</div>
            <div className="space-y-1">
              {roles.map((r) => {
                const active = r.id === activeRoleId;
                return (
                  <div
                    key={r.id}
                    className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer transition ${
                      active ? "bg-primary/15 border border-primary/40" : "hover:bg-primary/5 border border-transparent"
                    }`}
                    onClick={() => setActiveRoleId(r.id)}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: r.color ?? "hsl(var(--muted-foreground))" }}
                    />
                    <span className="flex-1 text-sm truncate">{r.name}</span>
                    {r.is_builtin && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                        built-in
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Permissions matrix */}
          {activeRole ? (
            <Card className="glass border-border p-5">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: activeRole.color ?? "hsl(var(--muted-foreground))" }}
                    />
                    <h2 className="font-display font-bold text-2xl">{activeRole.name}</h2>
                    {activeRole.is_builtin && (
                      <Badge variant="outline">vestavěná</Badge>
                    )}
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
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(activeRole)}>
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
                              checked
                                ? "bg-primary/10 border-primary/40"
                                : "bg-background/40 border-border hover:border-primary/30"
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
              <Input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                disabled={editingRole?.is_builtin}
              />
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
            <Button onClick={handleSave}>{editingRole ? "Uložit" : "Vytvořit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRoles;
