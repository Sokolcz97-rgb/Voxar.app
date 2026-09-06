import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Loader2, MessageCircle, Search, ShieldCheck, Signal, UserRound, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getVoxCommunityContext, subscribeVoxCommunityContext } from "@/lib/voxCommunityBridge";

 type MemberFilter = "all" | "online" | "staff";

type DirectoryRole = {
  id: string;
  name: string;
  color: string | null;
  position: number;
  badge_url?: string | null;
};

type DirectoryMember = {
  user_id: string;
  nickname: string | null;
  role: string;
  joined_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  last_seen: string | null;
  roles: DirectoryRole[];
};

const db = supabase as any;

function roleLabel(role: string) {
  if (role === "owner") return "Vlastník";
  if (role === "mod") return "Moderátor";
  return "Člen";
}

function statusLabel(status: string) {
  if (status === "online") return "Online";
  if (status === "idle") return "Pryč";
  if (status === "dnd") return "Nerušit";
  return "Offline";
}

function initials(member: DirectoryMember) {
  return (member.display_name || member.nickname || "VX").slice(0, 2).toUpperCase();
}

export function CommunityMembers({ guildId }: { guildId?: string | null }) {
  const navigate = useNavigate();
  const [resolvedGuildId, setResolvedGuildId] = useState<string | null>(() => guildId ?? getVoxCommunityContext().guildId);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MemberFilter>("all");

  useEffect(() => {
    if (guildId !== undefined) {
      setResolvedGuildId(guildId ?? null);
      return;
    }
    setResolvedGuildId(getVoxCommunityContext().guildId);
    return subscribeVoxCommunityContext((context) => setResolvedGuildId(context.guildId));
  }, [guildId]);

  const load = useCallback(async () => {
    if (!resolvedGuildId) {
      setMembers([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [{ data: membershipRows, error: membershipError }, { data: roleRows }, { data: memberRoleRows }] = await Promise.all([
        db.from("vox_guild_members").select("user_id,nickname,role,joined_at").eq("guild_id", resolvedGuildId),
        db.from("vox_roles").select("id,name,color,position,badge_url").eq("guild_id", resolvedGuildId),
        db.from("vox_member_roles").select("user_id,role_id").eq("guild_id", resolvedGuildId),
      ]);
      if (membershipError) throw membershipError;

      const memberships = (membershipRows ?? []) as any[];
      const ids = memberships.map((row) => row.user_id);
      const [{ data: profiles }, { data: presence }] = await Promise.all([
        ids.length ? supabase.from("profiles").select("user_id,display_name,avatar_url").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
        ids.length ? db.from("vox_presence").select("user_id,status,last_seen").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
      ]);

      const profileMap = Object.fromEntries(((profiles ?? []) as any[]).map((profile) => [profile.user_id, profile]));
      const presenceMap = Object.fromEntries(((presence ?? []) as any[]).map((item) => [item.user_id, item]));
      const roleMap = Object.fromEntries(((roleRows ?? []) as any[]).map((role) => [role.id, role]));
      const customRoles: Record<string, DirectoryRole[]> = {};
      ((memberRoleRows ?? []) as any[]).forEach((entry) => {
        const role = roleMap[entry.role_id];
        if (!role) return;
        (customRoles[entry.user_id] ||= []).push(role as DirectoryRole);
      });
      Object.values(customRoles).forEach((list) => list.sort((a, b) => (b.position ?? 0) - (a.position ?? 0)));

      const now = Date.now();
      setMembers(memberships.map((membership) => {
        const presenceRow = presenceMap[membership.user_id];
        const lastSeen = presenceRow?.last_seen || null;
        const stale = !lastSeen || now - new Date(lastSeen).getTime() > 90_000;
        return {
          user_id: membership.user_id,
          nickname: membership.nickname ?? null,
          role: membership.role || "member",
          joined_at: membership.joined_at ?? null,
          display_name: profileMap[membership.user_id]?.display_name ?? null,
          avatar_url: profileMap[membership.user_id]?.avatar_url ?? null,
          status: stale ? "offline" : (presenceRow?.status || "offline"),
          last_seen: lastSeen,
          roles: customRoles[membership.user_id] ?? [],
        } as DirectoryMember;
      }));
    } catch (err) {
      setError((err as Error).message || "Členy se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, [resolvedGuildId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!resolvedGuildId) return;
    const channel = supabase
      .channel(`vox_member_directory_${resolvedGuildId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_guild_members", filter: `guild_id=eq.${resolvedGuildId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_member_roles", filter: `guild_id=eq.${resolvedGuildId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_roles", filter: `guild_id=eq.${resolvedGuildId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_presence" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [resolvedGuildId, load]);

  const counts = useMemo(() => ({
    all: members.length,
    online: members.filter((member) => member.status !== "offline").length,
    staff: members.filter((member) => member.role === "owner" || member.role === "mod").length,
  }), [members]);

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("cs");
    const statusRank: Record<string, number> = { online: 0, idle: 1, dnd: 2, offline: 3 };
    return members
      .filter((member) => filter === "all" || (filter === "online" ? member.status !== "offline" : member.role === "owner" || member.role === "mod"))
      .filter((member) => {
        if (!q) return true;
        const haystack = [member.display_name, member.nickname, roleLabel(member.role), ...member.roles.map((role) => role.name)].filter(Boolean).join(" ").toLocaleLowerCase("cs");
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const staffA = a.role === "owner" ? 0 : a.role === "mod" ? 1 : 2;
        const staffB = b.role === "owner" ? 0 : b.role === "mod" ? 1 : 2;
        const status = (statusRank[a.status] ?? 4) - (statusRank[b.status] ?? 4);
        if (status !== 0) return status;
        if (staffA !== staffB) return staffA - staffB;
        return (a.display_name || a.nickname || "").localeCompare(b.display_name || b.nickname || "", "cs");
      });
  }, [members, query, filter]);

  return (
    <div className="sv-feature-page sv-members-page">
      <div className="sv-feature-toolbar sv-members-toolbar">
        <div>
          <span className="sv-feature-kicker">COMMUNITY DIRECTORY // REALTIME</span>
          <h2>Členové komunity</h2>
          <p>Aktivita, role a rychlý kontakt na jednom místě.</p>
        </div>
        <div className="sv-members-summary">
          <div><UsersRound /><span><strong>{counts.all}</strong><small>celkem</small></span></div>
          <div><Signal /><span><strong>{counts.online}</strong><small>online</small></span></div>
          <div><ShieldCheck /><span><strong>{counts.staff}</strong><small>tým</small></span></div>
        </div>
      </div>

      {!resolvedGuildId ? (
        <div className="sv-feature-empty"><UsersRound /><strong>Vyber komunitu</strong><span>Seznam členů se zobrazuje pro aktivní komunitu.</span></div>
      ) : loading ? (
        <div className="sv-feature-loading"><Loader2 className="animate-spin" /> Načítám členy…</div>
      ) : error ? (
        <div className="sv-feature-empty"><UsersRound /><strong>Členy se nepodařilo načíst</strong><span>{error}</span></div>
      ) : (
        <>
          <div className="sv-members-controls">
            <label className="sv-members-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat podle jména nebo role…" /></label>
            <div className="sv-members-filters">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Všichni <b>{counts.all}</b></button>
              <button className={filter === "online" ? "active" : ""} onClick={() => setFilter("online")}>Online <b>{counts.online}</b></button>
              <button className={filter === "staff" ? "active" : ""} onClick={() => setFilter("staff")}>Tým <b>{counts.staff}</b></button>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="sv-feature-empty"><Search /><strong>Nic nenalezeno</strong><span>Zkus změnit hledání nebo filtr.</span></div>
          ) : (
            <div className="sv-members-grid">
              {visible.map((member) => {
                const name = member.display_name || member.nickname || `Člen ${member.user_id.slice(0, 6)}`;
                return (
                  <article className={`sv-member-card status-${member.status}`} key={member.user_id}>
                    <div className="sv-member-card-glow" aria-hidden="true" />
                    <div className="sv-member-avatar">
                      {member.avatar_url ? <img src={member.avatar_url} alt="" /> : <span>{initials(member)}</span>}
                      <i className={`status-${member.status}`} title={statusLabel(member.status)} />
                    </div>
                    <div className="sv-member-main">
                      <div className="sv-member-name-row"><strong>{name}</strong>{member.role === "owner" ? <Crown title="Vlastník" /> : member.role === "mod" ? <ShieldCheck title="Moderátor" /> : null}</div>
                      {member.nickname && member.nickname !== member.display_name && <small className="sv-member-nickname">{member.nickname}</small>}
                      <div className="sv-member-role-row">
                        <span className={`sv-member-system-role role-${member.role}`}>{roleLabel(member.role)}</span>
                        {member.roles.slice(0, 3).map((role) => <span className="sv-member-custom-role" key={role.id} style={{ borderColor: role.color || undefined, color: role.color || undefined }}>{role.name}</span>)}
                        {member.roles.length > 3 && <span className="sv-member-role-more">+{member.roles.length - 3}</span>}
                      </div>
                    </div>
                    <div className="sv-member-side">
                      <span className={`sv-member-status status-${member.status}`}><i />{statusLabel(member.status)}</span>
                      {member.joined_at && <small>od {new Date(member.joined_at).toLocaleDateString("cs-CZ", { month: "short", year: "numeric" })}</small>}
                    </div>
                    <button className="sv-member-message" type="button" title={`Napsat ${name}`} onClick={() => navigate(`/messages?user=${member.user_id}`)}><MessageCircle /><span>Napsat</span></button>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
