import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { GuildRail, type VoxGuild } from "@/components/vox/GuildRail";
import { ChannelSidebar, type VoxChannel } from "@/components/vox/ChannelSidebar";
import { MemberList, type VoxMember } from "@/components/vox/MemberList";
import { SelfPanel } from "@/components/vox/SelfPanel";
import { ChatView } from "@/components/vox/ChatView";
import { VoiceView } from "@/components/vox/VoiceView";
import { CreateGuildDialog, JoinGuildDialog } from "@/components/vox/CreateGuildDialog";
import { AppUserSettings } from "@/components/vox/AppUserSettings";
import { AppServerSettings } from "@/components/vox/AppServerSettings";
import { CreateChannelDialog } from "@/components/vox/CreateChannelDialog";
import { DesktopUpdateFab } from "@/components/vox/DesktopUpdateFab";
import { AppAuthGate } from "@/components/vox/AppAuthGate";
import { CallDock } from "@/components/vox/CallDock";
import { useVoiceCall } from "@/contexts/VoiceCallContext";
import { useVoxHeartbeat } from "@/hooks/useVoxPresence";
import {
  AudioLines,
  Bell,
  CalendarDays,
  Folder,
  Home,
  Loader2,
  MoreHorizontal,
  Search,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import voxLogo from "@/assets/vox-logo.png.asset.json";
import "./community-reference.css";

export default function AppShell() {
  useVoxHeartbeat("online");
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [guilds, setGuilds] = useState<VoxGuild[]>([]);
  const [activeGuildId, setActiveGuildId] = useState<string | null>(null);
  const [channels, setChannels] = useState<VoxChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState<VoxChannel | null>(null);
  const [members, setMembers] = useState<VoxMember[]>([]);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [voiceParticipants, setVoiceParticipants] = useState<Record<string, any[]>>({});

  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const { channel: voiceChannel, api: voiceApi, leaveChannel } = useVoiceCall();
  const voiceConn = voiceApi.connected ? { channel: voiceChannel, api: voiceApi as any } : null;

  const [view, setView] = useState<"main" | "user-settings" | "server-settings">("main");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data as any));
  }, [user]);

  const loadGuilds = async () => {
    if (!user) return;
    const { data: memberships } = await supabase.from("vox_guild_members").select("guild_id").eq("user_id", user.id);
    const ids = memberships?.map((m: any) => m.guild_id) ?? [];
    if (!ids.length) {
      setGuilds([]);
      setActiveGuildId(null);
      return;
    }
    const { data } = await supabase.from("vox_guilds")
      .select("id, name, icon_url, cosmetic_id")
      .in("id", ids)
      .order("created_at");
    setGuilds((data ?? []) as VoxGuild[]);
    setActiveGuildId((prev) => prev && data?.some((g: any) => g.id === prev) ? prev : (data?.[0]?.id ?? null));
  };

  useEffect(() => { void loadGuilds(); }, [user]);

  const activeGuild = useMemo(
    () => guilds.find((g) => g.id === activeGuildId) ?? null,
    [guilds, activeGuildId],
  );
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!activeGuildId || !user) {
      setChannels([]);
      setMembers([]);
      setActiveChannel(null);
      return;
    }

    (async () => {
      const [{ data: chs }, { data: memb }, { data: g }] = await Promise.all([
        supabase.from("vox_channels").select("*").eq("guild_id", activeGuildId).order("position"),
        supabase.from("vox_guild_members").select("user_id, nickname, role").eq("guild_id", activeGuildId),
        supabase.from("vox_guilds").select("invite_code, owner_id").eq("id", activeGuildId).maybeSingle(),
      ]);

      setChannels((chs ?? []) as VoxChannel[]);
      setActiveChannel((prev) => {
        if (prev && chs?.some((c: any) => c.id === prev.id && c.guild_id === activeGuildId)) return prev;
        return (chs?.find((c: any) => c.type === "text") ?? chs?.[0]) as VoxChannel ?? null;
      });
      setInviteCode((g as any)?.invite_code ?? null);

      const myMember = memb?.find((m: any) => m.user_id === user.id);
      setIsAdmin(myMember?.role === "owner" || myMember?.role === "mod");
      setMembers(await buildMembers(activeGuildId, memb ?? []));
    })();

    const ch = supabase.channel(`vox_meta_${activeGuildId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vox_channels", filter: `guild_id=eq.${activeGuildId}` },
        async () => {
          const { data } = await supabase.from("vox_channels").select("*").eq("guild_id", activeGuildId).order("position");
          setChannels((data ?? []) as VoxChannel[]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vox_guild_members", filter: `guild_id=eq.${activeGuildId}` },
        () => { void loadGuildMembers(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vox_roles", filter: `guild_id=eq.${activeGuildId}` },
        () => { void loadGuildMembers(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vox_member_roles", filter: `guild_id=eq.${activeGuildId}` },
        () => { void loadGuildMembers(); },
      )
      .subscribe();

    const vp = supabase.channel(`vox_vp_all_${activeGuildId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vox_voice_participants" },
        () => refreshVoice(),
      )
      .subscribe();
    void refreshVoice();

    return () => {
      supabase.removeChannel(ch);
      supabase.removeChannel(vp);
    };
  }, [activeGuildId, user]);

  const buildMembers = async (guildId: string, memb: any[]): Promise<VoxMember[]> => {
    const ids = memb.map((m: any) => m.user_id);
    const [{ data: profs }, { data: pres }, { data: roles }, { data: memberRoles }] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from("vox_presence").select("user_id, status, last_seen").in("user_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("vox_roles").select("*").eq("guild_id", guildId),
      supabase.from("vox_member_roles").select("user_id, role_id").eq("guild_id", guildId),
    ]);

    const profMap = Object.fromEntries(((profs ?? []) as any[]).map((p) => [p.user_id, p]));
    const now = Date.now();
    const presMap = Object.fromEntries(((pres ?? []) as any[]).map((p) => {
      const stale = now - new Date(p.last_seen).getTime() > 90_000;
      return [p.user_id, stale ? "offline" : p.status];
    }));

    const rolesList = ((roles ?? []) as any[]).map((r) => ({
      ...r,
      permissions: (r.permissions ?? {}) as Record<string, boolean>,
    }));
    setAllRoles(rolesList);

    const roleMap = Object.fromEntries(rolesList.map((r) => [r.id, r]));
    const userRoles: Record<string, any[]> = {};
    ((memberRoles ?? []) as any[]).forEach((mr) => {
      const r = roleMap[mr.role_id];
      if (!r) return;
      (userRoles[mr.user_id] ||= []).push(r);
    });
    Object.values(userRoles).forEach((list) => list.sort((a, b) => (b.position ?? 0) - (a.position ?? 0)));

    return memb.map((m: any) => ({
      user_id: m.user_id,
      nickname: m.nickname,
      role: m.role,
      display_name: profMap[m.user_id]?.display_name ?? null,
      avatar_url: profMap[m.user_id]?.avatar_url ?? null,
      status: presMap[m.user_id] ?? "offline",
      roles: userRoles[m.user_id] ?? [],
    }));
  };

  const loadGuildMembers = async () => {
    if (!activeGuildId) return;
    const { data: memb } = await supabase.from("vox_guild_members")
      .select("user_id, nickname, role")
      .eq("guild_id", activeGuildId);
    setMembers(await buildMembers(activeGuildId, memb ?? []));
  };

  const refreshVoice = async () => {
    const chIds = channels.filter((c) => c.type === "voice").map((c) => c.id);
    if (!chIds.length) {
      setVoiceParticipants({});
      return;
    }

    const { data } = await supabase.from("vox_voice_participants")
      .select("channel_id, user_id, is_muted, is_deafened")
      .in("channel_id", chIds);

    const map: Record<string, any[]> = {};
    const memberNames = Object.fromEntries(
      members.map((m) => [m.user_id, m.display_name || m.nickname || m.user_id.slice(0, 6)]),
    );

    (data ?? []).forEach((p: any) => {
      (map[p.channel_id] ||= []).push({
        user_id: p.user_id,
        nickname: memberNames[p.user_id],
        is_muted: p.is_muted,
        is_deafened: p.is_deafened,
      });
    });
    setVoiceParticipants(map);
  };

  useEffect(() => { void refreshVoice(); }, [channels, members]);

  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createChannelType, setCreateChannelType] = useState<"text" | "voice">("text");
  const [createChannelCategory, setCreateChannelCategory] = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<Array<{ name: string; emoji: string | null }>>([]);

  const loadCategories = async () => {
    if (!activeGuildId) {
      setCategoryRows([]);
      return;
    }
    const { data } = await supabase.from("vox_categories")
      .select("name, emoji")
      .eq("guild_id", activeGuildId)
      .order("position");
    setCategoryRows((data ?? []) as any[]);
  };

  useEffect(() => { void loadCategories(); }, [activeGuildId]);

  const categoryEmojis = useMemo(
    () => Object.fromEntries(categoryRows.map((c) => [c.name, c.emoji])),
    [categoryRows],
  );

  const categoryNames = useMemo(() => {
    const fromChannels = channels.map((c) => c.category).filter(Boolean) as string[];
    return Array.from(new Set([...categoryRows.map((c) => c.name), ...fromChannels]));
  }, [categoryRows, channels]);

  const openCreateChannel = (type: "text" | "voice", category?: string | null) => {
    if (!activeGuildId) return;
    setCreateChannelType(type);
    setCreateChannelCategory(category ?? null);
    setCreateChannelOpen(true);
  };

  const createChannel = async (payload: {
    type: "text" | "voice";
    name: string;
    emoji: string | null;
    category: string | null;
    topic: string | null;
  }) => {
    if (!activeGuildId) return;
    const { error } = await supabase.from("vox_channels").insert({
      guild_id: activeGuildId,
      name: payload.name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64),
      type: payload.type,
      emoji: payload.emoji,
      topic: payload.topic,
      category: payload.category ?? (payload.type === "text" ? "Textové kanály" : "Hlasové kanály"),
      position: channels.length,
    });

    if (error) {
      toast({ title: "Nelze vytvořit kanál", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "Kanál vytvořen" });
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <AppAuthGate />;

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Uživatel";

  const voiceStateByUser: Record<string, {
    channel_id: string;
    is_muted?: boolean;
    is_deafened?: boolean;
    speaking?: boolean;
    level?: number;
  }> = {};

  Object.entries(voiceParticipants).forEach(([chId, list]) => {
    (list ?? []).forEach((p: any) => {
      voiceStateByUser[p.user_id] = {
        channel_id: chId,
        is_muted: p.is_muted,
        is_deafened: p.is_deafened,
      };
    });
  });

  if (voiceConn?.api) {
    const selfLevel: number = voiceConn.api.selfLevel ?? 0;
    if (voiceStateByUser[user.id]) {
      voiceStateByUser[user.id] = {
        ...voiceStateByUser[user.id],
        level: selfLevel,
        speaking: selfLevel > 0.08 && !voiceConn.api.muted,
      };
    }

    const remotes = voiceConn.api.remotes ?? {};
    Object.entries(remotes).forEach(([uid, r]: [string, any]) => {
      if (voiceStateByUser[uid]) {
        voiceStateByUser[uid] = {
          ...voiceStateByUser[uid],
          level: r.level,
          speaking: r.level > 0.08 && !voiceStateByUser[uid].is_muted,
        };
      }
    });
  }

  const openDM = (m: VoxMember) => {
    navigate(`/messages?user=${m.user_id}`);
  };

  const selfSpeaking = !!(
    voiceConn?.api
    && (voiceConn.api.selfLevel ?? 0) > 0.08
    && !voiceConn.api.muted
  );

  const selfPanel = (
    <SelfPanel
      displayName={displayName}
      avatarUrl={profile?.avatar_url}
      status="Online"
      muted={voiceConn?.api?.muted ?? false}
      deafened={voiceConn?.api?.deafened ?? false}
      speaking={selfSpeaking}
      connectedChannelName={voiceConn?.channel?.name ?? null}
      onToggleMute={() => voiceConn?.api?.toggleMute?.()}
      onToggleDeafen={() => voiceConn?.api?.toggleDeafen?.()}
      onLeaveVoice={() => void leaveChannel()}
      onOpenSettings={() => setView("user-settings")}
    />
  );

  const onlineCount = members.filter((m) => (m.status || "offline") !== "offline").length;
  const showSoon = (title: string) => toast({ title, description: "Tahle sekce bude napojená v další části rozhraní." });
  const firstVoiceChannel = channels.find((channel) => channel.type === "voice");

  return (
    <div className="vox-reference-shell">
      <div className="vox-reference-titlebar">
        <span>◈ &nbsp; Voxar.app — {activeGuild?.name || "StudioVoxario"}</span>
        <div className="vox-reference-window-controls" aria-hidden="true">
          <span>−</span><span>□</span><span>×</span>
        </div>
      </div>

      <header className="vox-reference-topbar">
        <div className="vox-reference-brand">
          <img src={voxLogo.url} alt="Voxar.app" />
          <div className="vox-reference-brand-copy">
            <strong>VOXAR.APP</strong>
            <span>STUDIOVOXARIO</span>
          </div>
        </div>

        <nav className="vox-reference-nav" aria-label="Hlavní navigace">
          <button type="button" className="active" onClick={() => setView("main")}>
            <Home /><span>Komunita</span>
          </button>
          <button type="button" onClick={() => showSoon("Události")}>
            <CalendarDays /><span>Události</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (firstVoiceChannel) {
                setActiveChannel(firstVoiceChannel);
                setView("main");
              } else {
                showSoon("Hlas");
              }
            }}
          >
            <AudioLines /><span>Hlas</span>
          </button>
          <button type="button" onClick={() => showSoon("Soubory")}>
            <Folder /><span>Soubory</span>
          </button>
          <button type="button" onClick={() => navigate("/obchod")}>
            <ShoppingBag /><span>Obchod</span>
          </button>
          <button type="button" onClick={() => navigate("/dashboard")}>
            <MoreHorizontal /><span>Více</span>
          </button>
        </nav>

        <div className="vox-reference-tools">
          <label className="vox-reference-search">
            <Search className="w-4 h-4" />
            <input placeholder="Hledat v komunitě..." aria-label="Hledat v komunitě" />
            <kbd>Ctrl K</kbd>
          </label>
          <button type="button" className="text-sky-200/80 hover:text-cyan-300" onClick={() => showSoon("Oznámení")}>
            <Bell className="w-5 h-5" />
          </button>
          <button type="button" className="vox-reference-avatar" onClick={() => setView("user-settings")} title="Nastavení profilu">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt={displayName} />
              : displayName.slice(0, 2).toUpperCase()}
          </button>
        </div>
      </header>

      <main className="vox-reference-workspace">
        <aside className="vox-reference-rail">
          <GuildRail
            guilds={guilds}
            activeId={activeGuildId}
            onSelect={(id) => { setActiveGuildId(id); setView("main"); }}
            onCreate={() => setCreateOpen(true)}
            onJoin={() => setJoinOpen(true)}
          />
        </aside>

        <section className="vox-reference-sidebar">
          {activeGuild ? (
            <>
              <div className="vox-reference-community-card">
                <div className="vox-reference-community-cover" />
                <div className="vox-reference-community-title-row">
                  <div className="vox-reference-community-mark">
                    {activeGuild.icon_url
                      ? <img src={activeGuild.icon_url} alt="" />
                      : activeGuild.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <strong>{activeGuild.name}</strong>
                    <span>Herní komunita & tvorba</span>
                  </div>
                </div>
              </div>

              <div className="vox-reference-server-menu">
                <button type="button" className="active" onClick={() => setView("main")}><Home />Domů</button>
                <button type="button" onClick={() => showSoon("Události")}><CalendarDays />Události</button>
                <button type="button" onClick={() => showSoon("Členové")}><UsersRound />Členové</button>
                <button type="button" onClick={() => navigate("/obchod")}><ShoppingBag />Boosty & Perky</button>
              </div>

              <div className="vox-reference-section-label">Komunikační zóna</div>
              <div className="vox-reference-channel-wrap min-h-0 flex-1">
                <ChannelSidebar
                  guildId={activeGuildId}
                  guildName={activeGuild.name}
                  inviteCode={inviteCode}
                  channels={channels}
                  categoryEmojis={categoryEmojis}
                  activeId={activeChannel?.id ?? null}
                  onSelect={(ch) => { setActiveChannel(ch); setView("main"); }}
                  onCreateChannel={openCreateChannel}
                  isAdmin={isAdmin}
                  voiceParticipants={voiceParticipants}
                  onOpenServerSettings={() => setView("server-settings")}
                  onCategoriesChanged={() => { void loadCategories(); }}
                />
              </div>

              {voiceConn && (
                <div className="vox-reference-call-dock">
                  <CallDock compact />
                </div>
              )}
              <div className="vox-reference-self-wrap">{selfPanel}</div>
            </>
          ) : (
            <div className="vox-reference-empty">
              <strong>SV</strong>
              <span>Zatím nejsi v žádné komunitě.</span>
              <div className="vox-ref-inline-actions">
                <button type="button" onClick={() => setCreateOpen(true)}>Vytvořit komunitu</button>
                <button type="button" onClick={() => setJoinOpen(true)}>Připojit se</button>
              </div>
            </div>
          )}
        </section>

        <section className="vox-reference-center">
          {activeGuild ? (
            view === "user-settings" ? (
              <AppUserSettings onClose={() => setView("main")} />
            ) : view === "server-settings" ? (
              <AppServerSettings
                guild={activeGuild}
                channels={channels}
                members={members}
                inviteCode={inviteCode}
                isOwner={members.find((m) => m.user_id === user.id)?.role === "owner"}
                isAdmin={isAdmin}
                onClose={() => setView("main")}
                onGuildUpdated={() => { void loadGuilds(); }}
                onGuildDeleted={() => { setView("main"); void loadGuilds(); }}
              />
            ) : activeChannel ? (
              activeChannel.type === "text"
                ? <ChatView channel={activeChannel} members={members} />
                : <VoiceView channel={activeChannel} />
            ) : (
              <div className="vox-reference-empty">
                <strong>STUDIOVOXARIO</strong>
                <span>Vyber kanál vlevo a můžeš začít.</span>
              </div>
            )
          ) : (
            <div className="vox-reference-empty">
              <strong>VOXAR.APP</strong>
              <span>Komunitní prostor pro hráče, tvůrce a přátele.</span>
            </div>
          )}
        </section>

        <aside className="vox-reference-right">
          {activeGuild && view === "main" ? (
            <div className="vox-reference-right-stack">
              <section className="vox-reference-info-card">
                <div className="vox-reference-card-kicker">O komunitě</div>
                <h3>{activeGuild.name}</h3>
                <p>Herní komunita, kde se potkávají lidé, nápady a nové světy.</p>
                <div className="vox-reference-stat-row">
                  <span><UsersRound /> <b>{members.length}</b><small>členů</small></span>
                  <span><span className="vox-reference-online-dot" /> <b>{onlineCount}</b><small>online</small></span>
                  <span><CalendarDays /> <b>6</b><small>událostí</small></span>
                </div>
                <div className="vox-reference-tags"><span>HRY</span><span>KOMUNITA</span><span>TVORBA</span><span>PŘÁTELSTVÍ</span></div>
              </section>

              <section className="vox-reference-info-card vox-reference-event-card">
                <div className="vox-reference-card-kicker">Právě se děje</div>
                <div className="vox-reference-event-row">
                  <div className="vox-reference-event-icon">🎮</div>
                  <div className="min-w-0 flex-1">
                    <strong>Páteční herní večer</strong>
                    <span>Dnes 20:00 · Hlasový kanál</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (firstVoiceChannel) setActiveChannel(firstVoiceChannel);
                      else showSoon("Hlasový kanál");
                    }}
                  >
                    Připojit se
                  </button>
                </div>
              </section>

              <section className="vox-reference-members-card min-h-0 flex-1">
                <MemberList
                  members={members}
                  guildId={activeGuildId}
                  currentUserId={user.id}
                  allRoles={allRoles}
                  canModerate={isAdmin}
                  voiceState={voiceStateByUser}
                  onMessage={openDM}
                />
              </section>
            </div>
          ) : (
            <div className="vox-reference-empty"><span>Nastavení komunity</span></div>
          )}
        </aside>
      </main>

      <CreateGuildDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async (id) => { await loadGuilds(); setActiveGuildId(id); }}
      />
      <JoinGuildDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onJoined={async (id) => { await loadGuilds(); setActiveGuildId(id); }}
      />
      <CreateChannelDialog
        open={createChannelOpen}
        initialType={createChannelType}
        initialCategory={createChannelCategory}
        categories={categoryNames}
        onOpenChange={setCreateChannelOpen}
        onCreate={createChannel}
      />

      <DesktopUpdateFab />
    </div>
  );
}
