import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Search, UserCog } from "lucide-react";

type AppRole = "admin" | "editor" | "user";
const ALL_ROLES: AppRole[] = ["admin", "editor", "user"];

interface ProfileRow {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

const AdminUsers = () => {
  const { t } = useTranslation();
  const { user, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, AppRole[]>>({});
  const [loading, setLoading] = useState(false);

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
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
      const map: Record<string, AppRole[]> = {};
      (roles ?? []).forEach((r: { user_id: string; role: AppRole }) => {
        map[r.user_id] = [...(map[r.user_id] ?? []), r.role];
      });
      setRolesByUser(map);
    } else {
      setRolesByUser({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load("");
  }, []);

  const toggleRole = async (uid: string, role: AppRole) => {
    if (uid === user?.id && role === "admin") {
      toast.error(t("adminUsers.cantRemoveSelf"));
      return;
    }
    const has = (rolesByUser[uid] ?? []).includes(role);
    if (has) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
      if (error) return toast.error(error.message);
      setRolesByUser((m) => ({ ...m, [uid]: (m[uid] ?? []).filter((r) => r !== role) }));
      toast.success(t("adminUsers.roleRemoved"));
    } else {
      const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
      if (error) return toast.error(error.message);
      setRolesByUser((m) => ({ ...m, [uid]: [...(m[uid] ?? []), role] }));
      toast.success(t("adminUsers.roleAdded"));
    }
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

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>

        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">{t("adminUsers.section")}</p>
          <h1 className="font-display font-black text-3xl md:text-4xl mt-2 flex items-center gap-3">
            <UserCog className="h-8 w-8 text-primary" /> {t("adminUsers.title")}
          </h1>
          <p className="text-muted-foreground mt-2">{t("adminUsers.subtitle")}</p>
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
            const userRoles = rolesByUser[p.user_id] ?? [];
            const initials = (p.display_name || p.username || "?").slice(0, 2).toUpperCase();
            return (
              <Card key={p.user_id} className="glass border-border p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar className="h-11 w-11 border border-border">
                    {p.avatar_url && <AvatarImage src={p.avatar_url} />}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="font-display font-bold truncate">{p.display_name || p.username || t("common.player")}</div>
                    <div className="text-xs text-muted-foreground truncate">@{p.username || "—"}</div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {userRoles.length === 0 && <Badge variant="outline" className="text-xs">user</Badge>}
                      {userRoles.map((r) => (
                        <Badge key={r} variant={r === "admin" ? "default" : "secondary"} className="text-xs">
                          {r}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {ALL_ROLES.filter((r) => r !== "user").map((role) => {
                    const active = userRoles.includes(role);
                    return (
                      <Button
                        key={role}
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() => toggleRole(p.user_id, role)}
                        className={active ? "" : "border-border"}
                      >
                        {active ? `− ${role}` : `+ ${role}`}
                      </Button>
                    );
                  })}
                </div>
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
