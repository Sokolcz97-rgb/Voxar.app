import { BookOpen, Mic2, UserRound } from "lucide-react";
import type { VoxChannel } from "../ChannelSidebar";

interface Props {
  guildName: string;
  guildIconUrl?: string | null;
  channels: VoxChannel[];
  onSelectChannel: (channel: VoxChannel) => void;
  onShowRules?: () => void;
}

export function CommunityWelcomeBanner({
  guildName,
  guildIconUrl,
  channels,
  onSelectChannel,
  onShowRules,
}: Props) {
  const introChannel = channels.find((channel) =>
    channel.type === "text"
    && ["představ-se", "predstav-se", "introductions"].includes(channel.name.toLowerCase()),
  );
  const voiceChannel = channels.find((channel) => channel.type === "voice");

  return (
    <section className="sv-welcome" aria-label="Vítej v komunitě">
      <div className="sv-welcome-copy">
        <div className="sv-welcome-eyebrow">
          <span className="sv-welcome-mark">
            {guildIconUrl
              ? <img src={guildIconUrl} alt="" />
              : guildName.slice(0, 2).toUpperCase()}
          </span>
          <strong>{guildName.toUpperCase()}</strong>
          <span className="sv-welcome-app">APP</span>
          <span className="sv-welcome-time">20:12</span>
        </div>

        <h2>Vítej v komunitě!</h2>
        <p>Jsme rádi, že jsi tady. Voxar.app je místo pro hráče, tvůrce a přátele.</p>
        <p>Respektuj ostatní, užívej si atmosféru a tvoř s námi něco většího.</p>

        <div className="sv-welcome-actions">
          <button type="button" onClick={onShowRules}>
            <BookOpen />
            <span>Přečíst pravidla</span>
          </button>
          <button
            type="button"
            onClick={() => introChannel && onSelectChannel(introChannel)}
            disabled={!introChannel}
          >
            <UserRound />
            <span>Představ se</span>
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => voiceChannel && onSelectChannel(voiceChannel)}
            disabled={!voiceChannel}
          >
            <Mic2 />
            <span>Připojit se na hlas</span>
          </button>
        </div>
      </div>

      <div className="sv-welcome-art" aria-hidden="true">
        <div className="sv-welcome-stars" />
        <div className="sv-welcome-portal"><i /></div>
        <div className="sv-welcome-ridge sv-welcome-ridge-a" />
        <div className="sv-welcome-ridge sv-welcome-ridge-b" />
        <div className="sv-welcome-motto">GOOD<br />PEOPLE<br />BETTER<br />WORLDS</div>
      </div>
    </section>
  );
}
