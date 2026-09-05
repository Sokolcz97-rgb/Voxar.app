import type { ReactNode } from "react";
import { CalendarDays, ChevronRight, Gem, Home, UsersRound } from "lucide-react";
import { ChannelSidebar, type VoxChannel } from "../ChannelSidebar";
import type { VoxGuild } from "../GuildRail";

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
    <div className="sv-sidebar-shell">
      <section className="sv-community-hero" aria-label={`Komunita ${guild.name}`}>
        <div className="sv-community-hero-art" aria-hidden="true">
          <div className="sv-community-hero-orbit" />
          <div className="sv-community-hero-ridge" />
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
        </div>
      </section>

      <nav className="sv-sidebar-quick-nav" aria-label="Navigace komunity">
        <button type="button" className="active" onClick={onHome}>
          <Home /><span>Domů</span><ChevronRight className="arrow" />
        </button>
        <button type="button" onClick={onEvents}><CalendarDays /><span>Události</span></button>
        <button type="button" onClick={onMembers}><UsersRound /><span>Členové</span></button>
        <button type="button" onClick={onBoosts}><Gem /><span>Boosty & Perky</span></button>
      </nav>

      <div className="sv-sidebar-section-title">Komunikační zóna</div>

      <div className="sv-sidebar-channels">
        <ChannelSidebar
          guildId={guildId}
          guildName={guild.name}
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
