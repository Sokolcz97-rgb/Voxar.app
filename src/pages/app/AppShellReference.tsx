import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { GuildRail, type VoxGuild } from "@/components/vox/GuildRail";
import type { VoxChannel } from "@/components/vox/ChannelSidebar";
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
import { CommunitySidebarPanel } from "@/components/vox/reference/CommunitySidebarPanel";
import { CommunityRightPanel } from "@/components/vox/reference/CommunityRightPanel";
import { CommunityTopbar } from "@/components/vox/reference/CommunityTopbar";
import { useVoiceCall } from "@/contexts/VoiceCallContext";
import { useVoxHeartbeat } from "@/hooks/useVoxPresence";
import { openVoxUtility } from "@/lib/voxCommunityBridge";
import { Loader2 } from "lucide-react";
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
  const [voiceParticipants, setVoiceParticipants] = useState<Record<string, any[]>>({});
  const [profile, setProfile] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [mobileChannelsOpen, setMobileChannelsOpen] = useState(false);
  const [view, setView] = useState<"main" | "user-settings" | "server-settings">("main");
  const [now, setNow] = useState(() => new Date());

  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createChannelType, setCreateChannelType] = useState<"text" | "voice">("text");
  const [createChannelCategory, setCreateChannelCategory] = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<Array<{ name: string; emoji: string | null }>>([]);

  const { channel: voiceChannel, api: voiceApi, leaveChannel } = useVoiceCall();
  const voiceConn = voiceApi.connected ? { channel: voiceChannel, api: voiceApi as any } : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
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

    const ids = memberships?.map((membership: any) => membership.guild_id) ?? [];
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
    setActiveGuildId((current) =>
      current && data?.some((guild: any) => guild.id === current)
        ? current
        : (data?.[0]?.id ?? null),
    );
  };

  useEffect(() => { void loadGuilds(); }, [user]);

  const activeGuild = useMemo(
    () => guilds.find((guild) => guild.id === activeGuildId) ?? null,
    [guilds, activeGuildId],
  );

  const buildMembers = async (guildId: string, membershipRows: any[]): Promise<VoxMember[]> => {
    const ids = membershipRows.map((membership: any) => membership.user_id);
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

    const profileMap = Object.fromEntries(((profiles ?? []) as any[]).map((item) => [item.user_id, item]));
    const currentTime = Date.now();
    const presenceMap = Object.fromEntries(((presence ?? []) as any[]).map((item) => {
      const stale = currentTime - new Date(item.last_seen).getTime() > 90_000;
      return [item.user_id, stale ? "offline" : item.status];
    }));

    const roleList = ((roles ?? []) as any[]).map((role) => ({
      ...role,
      permissions: (role.permissions ?? {}) as Record<string, boolean>,
    }));
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

    return membershipRows.map((membership: any) => ({
      user_id: membership.user_id,
      nickname: membership.nickname,
      role: membership.role,
      display_name: profileMap[membership.user_id]?.display_name ?? null,
      avatar_url: profileMap[membership.user_id]?.avatar_url ?? null,
      status: presenceMap[membership.user_id] ?? "offline",
      roles: rolesByUser[membership.user_id] ?? [],
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
    const channelIds = channels
      .filter((channel) => channel.type === "voice")
      .map((channel) => channel.id);

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
      setActiveChannel((current) => {
        if (current && channelRows?.some((channel: any) => channel.id === current.id && channel.guild_id === activeGuildId)) {
          return current;
        }
        return (channelRows?.find((channel: any) => channel.type === "text") ?? channelRows?.[0]) as VoxChannel ?? null;
      });
      setInviteCode((guildRow as any)?.invite_code ?? null);

      const selfMembership = membershipRows?.find((membership: any) => membership.user_id === user.id);
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
  const missingVoice = () => toast({ title: "Hlasový kanál není vytvořený", description: isAdmin ? "V seznamu kanálů jej můžeš přidat tlačítkem +." : "Požádej správce komunity o vytvoření hlasového kanálu." });
  const goHome = () => {
    const home = channels.find((c) => c.type === "text" && ["obecné", "general"].includes(c.name.toLowerCase())) ?? channels.find((c) => c.type === "text");
    if (home) setActiveChannel(home);
    setView("main");
    openVoxUtility(null);
  };
  const selectChannel = (channel: VoxChannel) => {
    setMobileChannelsOpen(false);
    setActiveChannel(channel);
    setView("main");
  };

  return (
    <div id="voxar-community" className={`vox-reference-shell sv-shell-v4 sv-refined${mobileChannelsOpen ? " mobile-nav-open" : ""}${view !== "main" ? " is-settings-view" : ""}`}>
      <CommunityTopbar
        displayName={displayName}
        avatarUrl={profile?.avatar_url}
        onCommunity={goHome}
        activeGuildId={activeGuildId}
        isGuildAdmin={isAdmin}
        onOpenChannel={(id) => { const target = channels.find(c => c.id === id); if (target) selectChannel(target); }}
        onEvents={() => openVoxUtility("events")}
        onVoice={() => {
          if (firstVoiceChannel) selectChannel(firstVoiceChannel);
          else missingVoice();
        }}
        onFiles={() => openVoxUtility("files")}
        onStore={() => navigate("/obchod")}
        onMore={() => navigate("/dashboard")}
        onNotifications={() => openVoxUtility("notifications")}
        onProfile={() => setView("user-settings")}
      />

      <button type="button" className="sv-mobile-channel-toggle" aria-expanded={mobileChannelsOpen} onClick={() => setMobileChannelsOpen(open => !open)}>{mobileChannelsOpen ? "Zavřít seznam kanálů" : "Komunity a kanály"}</button>
      <main className={`sv-workspace${view !== "main" ? " is-settings" : ""}`}>
        <aside className="sv-workspace-rail vox-reference-rail">
          <GuildRail
            guilds={guilds}
            activeId={activeGuildId}
            onSelect={(id) => { setActiveGuildId(id); setView("main"); }}
            onCreate={() => setCreateOpen(true)}
            onJoin={() => setJoinOpen(true)}
          />
        </aside>

        <section className="sv-workspace-sidebar vox-reference-sidebar">
          {activeGuild && activeGuildId ? (
            <CommunitySidebarPanel
              guild={activeGuild}
              guildId={activeGuildId}
              inviteCode={inviteCode}
              channels={channels}
              categoryEmojis={categoryEmojis}
              activeChannelId={activeChannel?.id ?? null}
              isAdmin={isAdmin}
              voiceParticipants={voiceParticipants}
              selfPanel={selfPanel}
              callDock={voiceConn ? <CallDock compact /> : undefined}
              onSelectChannel={selectChannel}
              onCreateChannel={openCreateChannel}
              onOpenServerSettings={() => setView("server-settings")}
              onCategoriesChanged={() => { void loadCategories(); }}
              onHome={goHome}
              onEvents={() => openVoxUtility("events")}
              onMembers={() => openVoxUtility("members")}
              onBoosts={() => navigate("/obchod")}
            />
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

        <section className="sv-workspace-center vox-reference-center">
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
                <ChatView
                  key={activeChannel.id}
                  channel={activeChannel}
                  members={members}
                  guildName={activeGuild.name}
                  guildIconUrl={activeGuild.icon_url}
                  channels={channels}
                  onSelectChannel={selectChannel}
                  onShowRules={isAdmin ? () => openCreateChannel("text", "Informace") : undefined}
                />
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

        {view === "main" && (
          <aside className="sv-workspace-right vox-reference-right">
            {activeGuild ? (
              <CommunityRightPanel
                guildId={activeGuildId ?? undefined}
                guildName={activeGuild.name}
                memberCount={members.length}
                onlineCount={onlineCount}
                members={members}
                onJoinVoice={() => {
                  if (firstVoiceChannel) selectChannel(firstVoiceChannel);
                  else missingVoice();
                }}
                onShowMembers={() => openVoxUtility("members")}
                onMessage={(member) => member.user_id === user.id ? setView("user-settings") : navigate(`/messages?user=${member.user_id}`)}
              />
            ) : (
              <div className="vox-reference-empty"><span>Komunita</span></div>
            )}
          </aside>
        )}
      </main>

      <div className="sv-workspace-clock">
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
