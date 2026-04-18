import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Search, UserCog, ChevronDown } from "lucide-react";
import { clearPermissionsCache } from "@/hooks/usePermissions";

type Role = {
  id: string;
  slug: string;
  name: string;
  color: string | null;
  is_builtin: boolean;
  position: number;
};

interface ProfileRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

const BUILTIN_ENUM = new Set(["admin", "editor", "user", "banned", "content_creator"]);

const AdminUsers = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  // user_id -> array of role_ids
  const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const loadRoles = async () => {
    const { data } = await supabase.from("roles").select("*").order("position");
    setAllRoles((data ?? []) as Role[]);
  };

  const load = async (q: string) => {
    setLoading(true);
    let query = supabase.from("profiles").select("user_id, username, display_name, avatar_url").limit(50);
    if (q.trim()) {
      query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`);
    }
    const { data: profs } = await query;
    setProfiles(profs ?? []);
    if (profs && profs.length) {
      const ids = profs.map((p) => p.user_id);
      const { data: ur } = await supabase
        .from("user_roles")
        .select("user_id, role, role_id")
        .in("user_id", ids);
      // Build map of user -> role_ids; fallback resolve slug -> id
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
    setLoading(false);
  };

  useEffect(() => {
    loadRoles();
    load("");
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
      // Delete by user_id + role_id, or fallback by slug for legacy rows
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", uid)
        .or(`role_id.eq.${role.id},role.eq.${role.slug}`);
      if (error) return toast.error(error.message);
      setRolesByUser((m) => ({ ...m, [uid]: (m[uid] ?? []).filter((r) => r !== role.id) }));
      toast.success("Role odebrána");
    } else {
      // For builtin enum roles, also set role enum; for custom roles use 'user' placeholder
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

  if (!isAdmin) {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 -z-10 gradient-hero" />
        <Navbar />
        <main className="container py-10">
          <Card className="glass border-border p-10 text-center">
            <Shield className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="font-display font-bold text-2xl">{t("adminUsers.adminOnly")}</h2>
            <p className="text-muted-foreground mt-2">{t("adminUsers.adminOnlyDesc")}</p>
          </Card>
        </main>
      </div>
    );
  }

  const roleById = (id: string) => allRoles.find((r) => r.id === id);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>

        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">{t("adminUsers.section")}</p>
            <h1 className="font-display font-black text-3xl md:text-4xl mt-2 flex items-center gap-3">
              <UserCog className="h-8 w-8 text-primary" /> {t("adminUsers.title")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("adminUsers.subtitle")}</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/admin/roles"><Shield className="h-4 w-4 mr-1" />Spravovat role & oprávnění</Link>
          </Button>
        </div>

        <Card className="glass border-border p-4 mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              load(search);
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("adminUsers.searchPlaceholder")}
                className="pl-9 bg-background/50"
              />
            </div>
            <Button type="submit" disabled={loading}>{t("common.search")}</Button>
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
                      {p.display_name || p.username || t("common.player")}
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
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                      Role
                    </div>
                    <div className="space-y-1 max-h-72 overflow-y-auto">
                      {allRoles.map((r) => {
                        const active = userRoleIds.includes(r.id);
                        return (
                          <label
                            key={r.id}
                            className="flex items-center gap-2 p-2 rounded hover:bg-primary/10 cursor-pointer"
                          >
                            <Checkbox
                              checked={active}
                              onCheckedChange={() => toggleRole(p.user_id, r)}
                            />
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
          {!loading && profiles.length === 0 && (
            <Card className="glass border-border p-10 text-center text-muted-foreground">
              {t("adminUsers.noResults")}
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminUsers;
