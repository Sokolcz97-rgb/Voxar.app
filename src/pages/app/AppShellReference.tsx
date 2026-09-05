import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { GuildRail, type VoxGuild } from "@/components/vox/GuildRail";
import { ChannelSidebar, type VoxChannel } from "@/components/vox/ChannelSidebar";
import type { VoxMember } from "@/components/vox/MemberList";
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
import { ReferenceWelcomeBanner } from "@/components/vox/ReferenceWelcomeBanner";
import { ReferenceActiveMembers } from "@/components/vox/ReferenceActiveMembers";
import { useVoiceCall } from "@/contexts/VoiceCallContext";
import { useVoxHeartbeat } from "@/hooks/useVoxPresence";
import {
  AudioLines,
  Bell,
  CalendarDays,
  ChevronRight,
  Folder,
  Gem,
  Home,
  Loader2,
  MoreHorizontal,
  Search,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import voxLogo from "@/assets/vox-logo.png.asset.json";
import "./community-reference.css";
import "./community-reference-polish.css";

export default function AppShellReference() {
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
  const [view, setView] = useState<"main" | "user-settings" | "server-settings">("main");
  const [now, setNow] = useState(() => new Date());

  const { channel: voiceChannel, api: voiceApi, leaveChannel } = useVoiceCall();
  const voiceConn = voiceApi.connected ? { channel: voiceChannel, api: voiceApi as any } : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data as any));
  }, [user]);

  const loadGuilds = async () => {
    if (!user) return;
    const { data: memberships } = await supabase
      .from("vox_guild_members")
      .select("guild_id")
      .eq("user_id", user.id);

    const ids = memberships?.map((m: any) => m.guild_id) ?? [];
    if (!ids.length) {
      setGuilds([]);
      setActiveGuildId(null);
      return;
    }

    const { data } = await supabase
      .from("vox_guilds")
      .select("id, name, icon_url, cosmetic_id")
      .in("id", ids)
      .order("created_at");

    setGuilds((data ?? []) as VoxGuild[]);
    setActiveGuildId((prev) =>
      prev && data?.some((g: any) => g.id === prev)
        ? prev
        : (data?.[0]?.id ?? null),
    );
  };

  useEffect(() => { void loadGuilds(); }, [user]);

  const activeGuild = useMemo(
    () => guilds.find((g) => g.id === activeGuildId) ?? null,
    [guilds, activeGuildId],
  );

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const buildMembers = async (guildId: string, membershipRows: any[]): Promise<VoxMember[]> => {
    const ids = membershipRows.map((m: any) => m.user_id);
    const [{ data: profiles }, { data: presence }, { data: roles }, { data: memberRoles }] = await Promise.all([
      ids.length
        ? supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from("vox_presence").select("user_id, status, last_seen").in("user_id", ids)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from("vox_roles").select("*").eq("guild_id", guildId),
      supabase.from("vox_member_roles").select("user_id, role_id").eq("guild_id", guildId),
    ]);

    const profileMap = Object.fromEntries(((profiles ?? []) as any[]).map((p) => [p.user_id, p]));
    const current = Date.now();
    const presenceMap = Object.fromEntries(((presence ?? []) as any[]).map((p) => {
      const stale = current - new Date(p.last_seen).getTime() > 90_000;
      return [p.user_id, stale ? "offline" : p.status];
    }));

    const roleList = ((roles ?? []) as any[]).map((role) => ({
      ...role,
      permissions: (role.permissions ?? {}) as Record<string, boolean>,
    }));
    setAllRoles(roleList);

    const roleMap = Object.fromEntries(roleList.map((role) => [role.id, role]));
    const rolesByUser: Record<string, any[]> = {};
    ((memberRoles ?? []) as any[]).forEach((memberRole) => {
      const role = roleMap[memberRole.role_id];
      if (!role) return;
      (rolesByUser[memberRole.user_id] ||= []).push(role);
    });
    Object.values(rolesByUser).forEach((list) =>
      list.sort((a, b) => (b.position ?? 0) - (a.position ?? 0)),
    );

    return membershipRows.map((member: any) => ({
      user_id: member.user_id,
      nickname: member.nickname,
      role: member.role,
      display_name: profileMap[member.user_id]?.display_name ?? null,
      avatar_url: profileMap[member.user_id]?.avatar_url ?? null,
      status: presenceMap[member.user_id] ?? "offline",
      roles: rolesByUser[member.user_id] ?? [],
    }));
  };

  const loadGuildMembers = async () => {
    if (!activeGuildId) return;
    const { data } = await supabase
      .from("vox_guild_members")
      .select("user_id, nickname, role")
      .eq("guild_id", activeGuildId);
    setMembers(await buildMembers(activeGuildId, data ?? []));
  };

  const refreshVoice = async () => {
    const channelIds = channels.filter((channel) => channel.type === "voice").map((channel) => channel.id);
    if (!channelIds.length) {
      setVoiceParticipants({});
      return;
    }

    const { data } = await supabase
      .from("vox_voice_participants")
      .select("channel_id, user_id, is_muted, is_deafened")
      .in("channel_id", channelIds);

    const names = Object.fromEntries(
      members.map((member) => [
        member.user_id,
        member.display_name || member.nickname || member.user_id.slice(0, 6),
      ]),
    );
    const map: Record<string, any[]> = {};
    (data ?? []).forEach((participant: any) => {
      (map[participant.channel_id] ||= []).push({
        user_id: participant.user_id,
        nickname: names[participant.user_id],
        is_muted: participant.is_muted,
        is_deafened: participant.is_deafened,
      });
    });
    setVoiceParticipants(map);
  };

  useEffect(() => {
    if (!activeGuildId || !user) {
      setChannels([]);
      setMembers([]);
      setActiveChannel(null);
      return;
    }

    (async () => {
      const [{ data: channelRows }, { data: membershipRows }, { data: guildRow }] = await Promise.all([
        supabase.from("vox_channels").select("*").eq("guild_id", activeGuildId).order("position"),
        supabase.from("vox_guild_members").select("user_id, nickname, role").eq("guild_id", activeGuildId),
        supabase.from("vox_guilds").select("invite_code, owner_id").eq("id", activeGuildId).maybeSingle(),
      ]);

      setChannels((channelRows ?? []) as VoxChannel[]);
      setActiveChannel((prev) => {
        if (prev && channelRows?.some((channel: any) => channel.id === prev.id && channel.guild_id === activeGuildId)) {
          return prev;
        }
        return (channelRows?.find((channel: any) => channel.type === "text") ?? channelRows?.[0]) as VoxChannel ?? null;
      });
      setInviteCode((guildRow as any)?.invite_code ?? null);

      const selfMembership = membershipRows?.find((member: any) => member.user_id === user.id);
      setIsAdmin(selfMembership?.role === "owner" || selfMembership?.role === "mod");
      setMembers(await buildMembers(activeGuildId, membershipRows ?? []));
    })();

    const metaChannel = supabase.channel(`vox_meta_${activeGuildId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vox_channels", filter: `guild_id=eq.${activeGuildId}` },
        async () => {
          const { data } = await supabase
            .from("vox_channels")
            .select("*")
            .eq("guild_id", activeGuildId)
            .order("position");
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

    const voiceMetaChannel = supabase.channel(`vox_vp_all_${activeGuildId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vox_voice_participants" },
        () => { void refreshVoice(); },
      )
      .subscribe();

    void refreshVoice();

    return () => {
      supabase.removeChannel(metaChannel);
      supabase.removeChannel(voiceMetaChannel);
    };
  }, [activeGuildId, user]);

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
    const { data } = await supabase
      .from("vox_categories")
      .select("name, emoji")
      .eq("guild_id", activeGuildId)
      .order("position");
    setCategoryRows((data ?? []) as any[]);
  };

  useEffect(() => { void loadCategories(); }, [activeGuildId]);

  const categoryEmojis = useMemo(
    () => Object.fromEntries(categoryRows.map((category) => [category.name, category.emoji])),
    [categoryRows],
  );

  const categoryNames = useMemo(() => {
    const fromChannels = channels.map((channel) => channel.category).filter(Boolean) as string[];
    return Array.from(new Set([...categoryRows.map((category) => category.name), ...fromChannels]));
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

  Object.entries(voiceParticipants).forEach(([channelId, list]) => {
    (list ?? []).forEach((participant: any) => {
      voiceStateByUser[participant.user_id] = {
        channel_id: channelId,
        is_muted: participant.is_muted,
        is_deafened: participant.is_deafened,
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

    Object.entries(voiceConn.api.remotes ?? {}).forEach(([uid, remote]: [string, any]) => {
      if (!voiceStateByUser[uid]) return;
      voiceStateByUser[uid] = {
        ...voiceStateByUser[uid],
        level: remote.level,
        speaking: remote.level > 0.08 && !voiceStateByUser[uid].is_muted,
      };
    });
  }

  const openDM = (member: VoxMember) => navigate(`/messages?user=${member.user_id}`);
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

  const onlineCount = members.filter((member) => (member.status || "offline") !== "offline").length;
  const firstVoiceChannel = channels.find((channel) => channel.type === "voice");
  const showSoon = (title: string) => toast({ title, description: "Tahle část rozhraní se ještě dopojí na vlastní data." });

  return (
    <div className="vox-reference-shell">
      <div className="vox-reference-titlebar">
        <span>◈ &nbsp; Voxar.app — {activeGuild?.name || "StudioVoxario"}</span>
        <div className="vox-reference-window-controls" aria-hidden="true"><span>−</span><span>□</span><span>×</span></div>
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
          <button type="button" className="active" onClick={() => setView("main")}><Home /><span>Komunita</span></button>
          <button type="button" onClick={() => showSoon("Události")}><CalendarDays /><span>Události</span></button>
          <button
            type="button"
            onClick={() => {
              if (firstVoiceChannel) {
                setActiveChannel(firstVoiceChannel);
                setView("main");
              } else showSoon("Hlas");
            }}
          ><AudioLines /><span>Hlas</span></button>
          <button type="button" onClick={() => showSoon("Soubory")}><Folder /><span>Soubory</span></button>
          <button type="button" onClick={() => navigate("/obchod")}><ShoppingBag /><span>Obchod</span></button>
          <button type="button" onClick={() => navigate("/dashboard")}><MoreHorizontal /><span>Více</span></button>
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
            {profile?.avatar_url ? <img src={profile.avatar_url} alt={displayName} /> : displayName.slice(0, 2).toUpperCase()}
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
                    {activeGuild.icon_url ? <img src={activeGuild.icon_url} alt="" /> : activeGuild.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <strong>{activeGuild.name} <span aria-hidden="true" style={{ display: "inline", color: "#41dcff" }}>◆</span></strong>
                    <span>Herní komunita & tvorba</span>
                  </div>
                </div>
              </div>

              <div className="vox-reference-server-menu">
                <button type="button" className="active" onClick={() => setView("main")}><Home />Domů <ChevronRight className="ml-auto" /></button>
                <button type="button" onClick={() => showSoon("Události")}><CalendarDays />Události</button>
                <button type="button" onClick={() => showSoon("Členové")}><UsersRound />Členové</button>
                <button type="button" onClick={() => navigate("/obchod")}><Gem />Boosty & Perky</button>
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
                  onSelect={(channel) => { setActiveChannel(channel); setView("main"); }}
                  onCreateChannel={openCreateChannel}
                  isAdmin={isAdmin}
                  voiceParticipants={voiceParticipants}
                  onOpenServerSettings={() => setView("server-settings")}
                  onCategoriesChanged={() => { void loadCategories(); }}
                />
              </div>

              {voiceConn && <div className="vox-reference-call-dock"><CallDock compact /></div>}
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
                isOwner={members.find((member) => member.user_id === user.id)?.role === "owner"}
                isAdmin={isAdmin}
                onClose={() => setView("main")}
                onGuildUpdated={() => { void loadGuilds(); }}
                onGuildDeleted={() => { setView("main"); void loadGuilds(); }}
              />
            ) : activeChannel ? (
              activeChannel.type === "text" ? (
                <div className="vox-ref-chat-stage">
                  <ReferenceWelcomeBanner
                    guildName={activeGuild.name}
                    channels={channels}
                    onSelectChannel={(channel) => { setActiveChannel(channel); setView("main"); }}
                    onShowRules={() => toast({ title: "Pravidla komunity", description: "Pravidla můžeš připojit na vlastní stránku nebo kanál." })}
                  />
                  <ChatView channel={activeChannel} members={members} />
                </div>
              ) : (
                <VoiceView channel={activeChannel} />
              )
            ) : (
              <div className="vox-reference-empty"><strong>STUDIOVOXARIO</strong><span>Vyber kanál vlevo a můžeš začít.</span></div>
            )
          ) : (
            <div className="vox-reference-empty"><strong>VOXAR.APP</strong><span>Komunitní prostor pro hráče, tvůrce a přátele.</span></div>
          )}
        </section>

        <aside className="vox-reference-right">
          {activeGuild && view === "main" ? (
            <div className="vox-reference-right-stack">
              <section className="vox-reference-info-card">
                <div className="vox-reference-card-kicker">O komunitě</div>
                <h3>{activeGuild.name}</h3>
                <p>Herní komunita, kde se potkávají lidé, nápady a nové světy. Spojujeme hráče, tvůrce a přátele.</p>
                <div className="vox-reference-stat-row">
                  <span><UsersRound /><b>{members.length}</b><small>členů</small></span>
                  <span><span className="vox-reference-online-dot" /><b>{onlineCount}</b><small>online</small></span>
                  <span><CalendarDays /><b>6</b><small>událostí</small></span>
                </div>
                <div className="vox-reference-tags"><span>HRY</span><span>KOMUNITA</span><span>TVORBA</span><span>PŘÁTELSTVÍ</span></div>
              </section>

              <section className="vox-reference-info-card vox-reference-event-card">
                <div className="vox-reference-card-kicker">Právě se děje</div>
                <div className="vox-reference-event-row">
                  <div className="vox-reference-event-icon">🎮</div>
                  <div className="min-w-0 flex-1"><strong>Páteční herní večer</strong><span>Dnes 20:00 · Hlasový kanál</span></div>
                  <button
                    type="button"
                    onClick={() => {
                      if (firstVoiceChannel) {
                        setActiveChannel(firstVoiceChannel);
                        setView("main");
                      } else showSoon("Hlasový kanál");
                    }}
                  >Připojit se</button>
                </div>
              </section>

              <section className="vox-reference-members-card">
                <div className="vox-ref-right-section-title"><span>Aktivní členové</span><button type="button" onClick={() => showSoon("Všichni členové")}>Zobrazit vše →</button></div>
                <ReferenceActiveMembers members={members} onMessage={openDM} />
                <div className="vox-reference-footer-mark">— StudioVoxario · Lepší komunity tvoří lepší hráče.</div>
              </section>
            </div>
          ) : (
            <div className="vox-reference-empty"><span>Nastavení komunity</span></div>
          )}
        </aside>
      </main>

      <div className="vox-reference-clock">
        <span>{now.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</span>
        <span>{now.toLocaleDateString("cs-CZ")}</span>
      </div>

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
