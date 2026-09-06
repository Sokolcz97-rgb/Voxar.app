import type { ReactNode } from "react";
import { CalendarDays, ChevronRight, Gem, Home, UsersRound } from "lucide-react";
import type { VoxChannel } from "../ChannelSidebar";
import type { VoxGuild } from "../GuildRail";
import { CommunityChannelList } from "./CommunityChannelList";

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
  callDock?: ReactNode;
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
  callDock,
  onSelectChannel,
  onCreateChannel,
  onOpenServerSettings,
  onCategoriesChanged,
  onHome,
  onEvents,
  onMembers,
  onBoosts,
}: Props) {
  return (
    <div className="sv-sidebar-shell sv-sidebar-shell-v3 sv-sidebar-shell-v17 sv-sidebar-shell-v18">
      <div className="sv-sidebar-slogan">
        <span>„VÍCE NEŽ HLAS. KOMUNITA, KTERÁ TVOŘÍ.“</span>
        <i className="sv-sidebar-slogan-accent" aria-hidden="true" />
      </div>

      <section className="sv-community-hero sv-community-hero-v3 sv-community-hero-v17 sv-community-hero-v18" aria-label={`Komunita ${guild.name}`}>
        <span className="sv-community-hero-frame sv-community-hero-frame-a" aria-hidden="true" />
        <span className="sv-community-hero-frame sv-community-hero-frame-b" aria-hidden="true" />
        <div className="sv-community-hero-art" aria-hidden="true">
          <div className="sv-community-hero-stars" />
          <div className="sv-community-hero-aurora" />
          <div className="sv-community-hero-glow" />
          <div className="sv-community-hero-orbit" />
          <div className="sv-community-hero-moon" />
          <div className="sv-community-hero-beacon" />
          <div className="sv-community-hero-city sv-community-hero-city-back" />
          <div className="sv-community-hero-city sv-community-hero-city-front" />
          <div className="sv-community-hero-ridge sv-community-hero-ridge-back" />
          <div className="sv-community-hero-ridge sv-community-hero-ridge-front" />
          <div className="sv-community-hero-grid" />
          <div className="sv-community-hero-scan" />
        </div>

        <div className="sv-community-identity">
          <div className="sv-community-logo">
            {guild.icon_url
              ? <img src={guild.icon_url} alt="" />
              : <span>{guild.name.slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="sv-community-copy">
            <div className="sv-community-name-row">
              <strong>{guild.name}</strong>
              <i aria-hidden="true" />
            </div>
            <span>Herní komunita & tvorba</span>
          </div>
          <span className="sv-community-hero-badge" aria-hidden="true">COMMUNITY</span>
        </div>
      </section>

      <nav className="sv-sidebar-quick-nav" aria-label="Navigace komunity">
        <button type="button" className="active" onClick={onHome}>
          <span className="sv-sidebar-nav-accent" aria-hidden="true" />
          <Home /><span>Domů</span><ChevronRight className="arrow" />
        </button>
        <button type="button" onClick={onEvents}><CalendarDays /><span>Události</span></button>
        <button type="button" onClick={onMembers}><UsersRound /><span>Členové</span></button>
        <button type="button" onClick={onBoosts}><Gem /><span>Boosty & Perky</span></button>
      </nav>

      <div className="sv-sidebar-section-title">
        <span>Komunikační zóna</span>
        <i aria-hidden="true" />
      </div>

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

      {callDock ? <div className="sv-sidebar-call-dock">{callDock}</div> : null}
      <div className="sv-sidebar-self">{selfPanel}</div>
    </div>
  );
}
