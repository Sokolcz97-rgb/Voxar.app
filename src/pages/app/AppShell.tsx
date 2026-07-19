import { useEffect, useMemo, useState } from "react";
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
import { useVoxHeartbeat } from "@/hooks/useVoxPresence";
import { Loader2 } from "lucide-react";

export default function AppShell() {
  useVoxHeartbeat("online");
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

  // Voice connection tracking across channels
  const [voiceConn, setVoiceConn] = useState<{ channel: VoxChannel | null; api: any } | null>(null);

  // In-app view: main content, user settings, or server settings
  const [view, setView] = useState<"main" | "user-settings" | "server-settings">("main");

  // Note: do NOT redirect to /auth — that would kick the user out of the
  // Discord-like app shell into the marketing site, which confused visitors.
  // We render an in-app login gate below when !user.

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name, avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data as any));
  }, [user]);

  // Load guilds
  const loadGuilds = async () => {
    if (!user) return;
    const { data: memberships } = await supabase.from("vox_guild_members").select("guild_id").eq("user_id", user.id);
    const ids = memberships?.map((m: any) => m.guild_id) ?? [];
    if (!ids.length) { setGuilds([]); setActiveGuildId(null); return; }
    const { data } = await supabase.from("vox_guilds").select("id, name, icon_url").in("id", ids).order("created_at");
    setGuilds((data ?? []) as VoxGuild[]);
    setActiveGuildId((prev) => prev && data?.some((g: any) => g.id === prev) ? prev : (data?.[0]?.id ?? null));
  };

  useEffect(() => { loadGuilds(); }, [user]);

  const activeGuild = useMemo(() => guilds.find((g) => g.id === activeGuildId) ?? null, [guilds, activeGuildId]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!activeGuildId || !user) { setChannels([]); setMembers([]); setActiveChannel(null); return; }
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

    // realtime channels + members + roles
    const ch = supabase.channel(`vox_meta_${activeGuildId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_channels", filter: `guild_id=eq.${activeGuildId}` },
        async () => {
          const { data } = await supabase.from("vox_channels").select("*").eq("guild_id", activeGuildId).order("position");
          setChannels((data ?? []) as VoxChannel[]);
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_guild_members", filter: `guild_id=eq.${activeGuildId}` },
        () => { void loadGuildMembers(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_roles", filter: `guild_id=eq.${activeGuildId}` },
        () => { void loadGuildMembers(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_member_roles", filter: `guild_id=eq.${activeGuildId}` },
        () => { void loadGuildMembers(); })
      .subscribe();

    // Voice participants across all channels of this guild
    const vp = supabase.channel(`vox_vp_all_${activeGuildId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_voice_participants" }, () => refreshVoice())
      .subscribe();
    refreshVoice();

    return () => { supabase.removeChannel(ch); supabase.removeChannel(vp); };
  }, [activeGuildId, user]);

  /** Rozšíří členy o profil, presence a přiřazené vlastní role (seřazené podle position DESC). */
  const buildMembers = async (guildId: string, memb: any[]): Promise<VoxMember[]> => {
    const ids = memb.map((m: any) => m.user_id);
    const [{ data: profs }, { data: pres }, { data: roles }, { data: memberRoles }] = await Promise.all([
      ids.length ? supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
      ids.length ? supabase.from("vox_presence").select("user_id, status, last_seen").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
      supabase.from("vox_roles").select("*").eq("guild_id", guildId),
      supabase.from("vox_member_roles").select("user_id, role_id").eq("guild_id", guildId),
    ]);
    const profMap = Object.fromEntries(((profs ?? []) as any[]).map((p) => [p.user_id, p]));
    const now = Date.now();
    const presMap = Object.fromEntries(((pres ?? []) as any[]).map((p) => {
      const stale = now - new Date(p.last_seen).getTime() > 90_000;
      return [p.user_id, stale ? "offline" : p.status];
    }));
    const roleMap = Object.fromEntries(((roles ?? []) as any[]).map((r) => [r.id, {
      ...r,
      permissions: (r.permissions ?? {}) as Record<string, boolean>,
    }]));
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
    const { data: memb } = await supabase.from("vox_guild_members").select("user_id, nickname, role").eq("guild_id", activeGuildId);
    setMembers(await buildMembers(activeGuildId, memb ?? []));
  };

  const refreshVoice = async () => {
    const chIds = channels.filter(c => c.type === "voice").map(c => c.id);
    if (!chIds.length) { setVoiceParticipants({}); return; }
    const { data } = await supabase.from("vox_voice_participants")
      .select("channel_id, user_id, is_muted").in("channel_id", chIds);
    const map: Record<string, any[]> = {};
    const memberNames = Object.fromEntries(members.map(m => [m.user_id, m.display_name || m.nickname || m.user_id.slice(0, 6)]));
    (data ?? []).forEach((p: any) => {
      (map[p.channel_id] ||= []).push({ user_id: p.user_id, nickname: memberNames[p.user_id], is_muted: p.is_muted });
    });
    setVoiceParticipants(map);
  };

  useEffect(() => { void refreshVoice(); }, [channels, members]);

  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [createChannelType, setCreateChannelType] = useState<"text" | "voice">("text");

  const openCreateChannel = (type: "text" | "voice") => {
    if (!activeGuildId) return;
    setCreateChannelType(type);
    setCreateChannelOpen(true);
  };

  const createChannel = async (type: "text" | "voice", name: string) => {
    if (!activeGuildId) return;
    const { error } = await supabase.from("vox_channels").insert({
      guild_id: activeGuildId,
      name: name.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 64),
      type,
      category: type === "text" ? "Textové kanály" : "Hlasové kanály",
      position: channels.length,
    });
    if (error) {
      toast({ title: "Nelze vytvořit kanál", description: error.message, variant: "destructive" });
      throw error;
    }
    toast({ title: "Kanál vytvořen" });
  };

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <AppAuthGate />;

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Uživatel";

  const selfPanel = (
    <SelfPanel
      displayName={displayName}
      avatarUrl={profile?.avatar_url}
      status="Online"
      muted={voiceConn?.api?.muted ?? false}
      deafened={voiceConn?.api?.deafened ?? false}
      connectedChannelName={voiceConn?.channel?.name ?? null}
      onToggleMute={() => voiceConn?.api?.toggleMute?.()}
      onToggleDeafen={() => voiceConn?.api?.toggleDeafen?.()}
      onLeaveVoice={() => voiceConn?.api?.leave?.()}
      onOpenSettings={() => setView("user-settings")}
    />
  );

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-background text-foreground">
      <GuildRail
        guilds={guilds}
        activeId={activeGuildId}
        onSelect={(id) => { setActiveGuildId(id); setView("main"); }}
        onCreate={() => setCreateOpen(true)}
        onJoin={() => setJoinOpen(true)}
      />

      {activeGuild ? (
        <>
          <div className="flex flex-col">
            <ChannelSidebar
              guildName={activeGuild.name}
              inviteCode={inviteCode}
              channels={channels}
              activeId={activeChannel?.id ?? null}
              onSelect={(ch) => { setActiveChannel(ch); setView("main"); }}
              onCreateChannel={openCreateChannel}
              isAdmin={isAdmin}
              voiceParticipants={voiceParticipants}
              onOpenServerSettings={() => setView("server-settings")}
            />
            {selfPanel}
          </div>

          <div className="flex-1 flex min-w-0">
            {view === "user-settings" ? (
              <AppUserSettings onClose={() => setView("main")} />
            ) : view === "server-settings" ? (
              <AppServerSettings
                guild={activeGuild}
                channels={channels}
                members={members}
                inviteCode={inviteCode}
                isOwner={members.find(m => m.user_id === user.id)?.role === "owner"}
                isAdmin={isAdmin}
                onClose={() => setView("main")}
                onGuildUpdated={() => { void loadGuilds(); }}
                onGuildDeleted={() => { setView("main"); void loadGuilds(); }}
              />
            ) : activeChannel ? (
              <>
                {activeChannel.type === "text"
                  ? <ChatView channel={activeChannel} members={members} />
                  : <VoiceView
                      channel={activeChannel}
                      onConnectionChange={(ch, api) => setVoiceConn({ channel: ch, api })}
                    />}
                <MemberList members={members} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                Vyber kanál
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* No active guild: still show a persistent sidebar with SelfPanel */}
          <div className="w-60 flex flex-col bg-[hsl(222_35%_5%)] border-r border-border/40">
            <div className="h-12 px-4 flex items-center border-b border-border/50 shadow-sm">
              <span className="font-semibold text-sm truncate">StudioVoxario</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 text-sm text-muted-foreground">
              Zatím žádný server. Vytvoř si vlastní nebo se připoj přes pozvánku.
            </div>
            {selfPanel}
          </div>

          <div className="flex-1 flex min-w-0">
            {view === "user-settings" ? (
              <AppUserSettings onClose={() => setView("main")} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
                <div className="text-3xl font-bold">Vítej ve StudioVoxario</div>
                <p className="text-muted-foreground max-w-md">
                  Nemáš zatím žádný server. Vytvoř si vlastní nebo se připoj přes pozvánkový kód.
                </p>
                <div className="flex gap-3">
                  <button className="px-5 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:opacity-90" onClick={() => setCreateOpen(true)}>
                    Vytvořit server
                  </button>
                  <button className="px-5 py-2 rounded-md bg-secondary hover:bg-secondary/80" onClick={() => setJoinOpen(true)}>
                    Připojit se
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <CreateGuildDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={async (id) => { await loadGuilds(); setActiveGuildId(id); }} />
      <JoinGuildDialog open={joinOpen} onOpenChange={setJoinOpen} onJoined={async (id) => { await loadGuilds(); setActiveGuildId(id); }} />
      <CreateChannelDialog
        open={createChannelOpen}
        initialType={createChannelType}
        onOpenChange={setCreateChannelOpen}
        onCreate={createChannel}
      />
      <DesktopUpdateFab />
    </div>
  );
}
