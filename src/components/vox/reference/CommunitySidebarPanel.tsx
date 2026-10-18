import { useEffect, type ReactNode } from "react";
import { CalendarDays, ChevronRight, Gem, Home, UsersRound } from "lucide-react";
import type { VoxChannel } from "../ChannelSidebar";
import type { VoxGuild } from "../GuildRail";
import { CommunityChannelList } from "./CommunityChannelList";
import { openVoxUtility, publishVoxCommunityContext, subscribeVoxChannel } from "@/lib/voxCommunityBridge";

interface Props {
  guild: VoxGuild;
  guildId: string;
  inviteCode: string | null;
  channels: VoxChannel[];
  categoryEmojis: Record<string, string | null>;
  activeChannelId: string | null;
  isAdmin: boolean;
  voiceParticipants: Record<string, any[]>;
  selfPanel: ReactNode;
  onSelectChannel: (channel: VoxChannel) => void;
  onCreateChannel: (type: "text" | "voice", category?: string | null) => void;
  onOpenServerSettings: () => void;
  onCategoriesChanged: () => void;
  onHome: () => void;
  onEvents: () => void;
  onMembers: () => void;
  onBoosts: () => void;
}

export function CommunitySidebarPanel({
  guild,
  guildId,
  inviteCode,
  channels,
  categoryEmojis,
  activeChannelId,
  isAdmin,
  voiceParticipants,
  selfPanel,
  onSelectChannel,
  onCreateChannel,
  onOpenServerSettings,
  onCategoriesChanged,
  onHome,
}: Props) {
  useEffect(() => {
    publishVoxCommunityContext({ guildId, isAdmin });
    return () => publishVoxCommunityContext({ guildId: null, isAdmin: false });
  }, [guildId, isAdmin]);

  useEffect(() => subscribeVoxChannel((channelId) => {
    const channel = channels.find((item) => item.id === channelId);
    if (channel) onSelectChannel(channel);
  }), [channels, onSelectChannel]);

  return (
    <div className="sv-sidebar-shell">
      <div className="sv-sidebar-slogan">
        <span>„VÍCE NEŽ HLAS. KOMUNITA, KTERÁ TVOŘÍ.“</span>
        <i className="sv-sidebar-slogan-accent" aria-hidden="true" />
      </div>

      <section className="sv-community-hero" aria-label={`Komunita ${guild.name}`}>
        <div className="sv-community-hero-art" aria-hidden="true">
          <img className="sv-community-hero-image" src="/vox/reference/sidebar-world-v30.webp" alt="" />
        </div>

        <div className="sv-community-identity">
          <div className="sv-community-logo">
            {guild.icon_url ? <img src={guild.icon_url} alt="" /> : <span>{guild.name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="sv-community-copy">
            <div className="sv-community-name-row">
              <strong>{guild.name}</strong>
              <i aria-hidden="true" />
            </div>
            <span>Herní komunita & tvorba</span>
          </div>
        </div>
      </section>

      <nav className="sv-sidebar-quick-nav" aria-label="Navigace komunity">
        <button type="button" className="active" onClick={() => { openVoxUtility(null); onHome(); }}>
          <Home /><span>Domů</span><ChevronRight className="arrow" />
        </button>
        <button type="button" onClick={() => openVoxUtility("events")}><CalendarDays /><span>Události</span></button>
        <button type="button" onClick={() => openVoxUtility("members")}><UsersRound /><span>Členové</span></button>
        <button type="button" onClick={() => openVoxUtility("store")}><Gem /><span>Boosty & Perky</span></button>
      </nav>

      <div className="sv-sidebar-channels">
        <CommunityChannelList
          guildId={guildId}
          inviteCode={inviteCode}
          channels={channels}
          categoryEmojis={categoryEmojis}
          activeId={activeChannelId}
          onSelect={onSelectChannel}
          onCreateChannel={onCreateChannel}
          isAdmin={isAdmin}
          voiceParticipants={voiceParticipants}
          onOpenServerSettings={onOpenServerSettings}
          onCategoriesChanged={onCategoriesChanged}
        />
      </div>

      <div className="sv-sidebar-self">{selfPanel}</div>
    </div>
  );
}
