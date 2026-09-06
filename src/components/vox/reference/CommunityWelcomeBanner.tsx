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
  const rulesChannel = channels.find((channel) =>
    channel.type === "text" && ["pravidla", "rules", "pravidla-komunity"].includes(channel.name.toLowerCase()),
  );
  const introChannel = channels.find((channel) =>
    channel.type === "text" && ["představ-se", "predstav-se", "introductions"].includes(channel.name.toLowerCase()),
  );
  const voiceChannel = channels.find((channel) => channel.type === "voice");
  const currentTime = new Date().toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
  const canShowRules = !!rulesChannel || !!onShowRules;

  return (
    <section className="sv-welcome sv-welcome-v17 sv-welcome-v18 sv-welcome-v19 sv-welcome-v24" aria-label="Vítej v komunitě">
      <span className="sv-welcome-corner sv-welcome-corner-left" aria-hidden="true" />
      <span className="sv-welcome-corner sv-welcome-corner-right" aria-hidden="true" />
      <span className="sv-welcome-edge sv-welcome-edge-top" aria-hidden="true" />
      <span className="sv-welcome-edge sv-welcome-edge-bottom" aria-hidden="true" />

      <div className="sv-welcome-copy">
        <div className="sv-welcome-eyebrow">
          <span className="sv-welcome-mark">
            {guildIconUrl ? <img src={guildIconUrl} alt="" /> : guildName.slice(0, 2).toUpperCase()}
          </span>
          <strong>{guildName.toUpperCase()}</strong>
          <span className="sv-welcome-app">APP</span>
          <span className="sv-welcome-time" title="Aktuální čas">{currentTime}</span>
        </div>

        <h2>Vítej v komunitě!</h2>
        <p>Jsme rádi, že jsi tady. Voxar.app je místo pro hráče, tvůrce a přátele.</p>
        <p>Respektuj ostatní, užívej si atmosféru a tvoř s námi něco většího.</p>

        <div className="sv-welcome-actions">
          <button
            type="button"
            onClick={() => rulesChannel ? onSelectChannel(rulesChannel) : onShowRules?.()}
            disabled={!canShowRules}
            title={rulesChannel ? `Přejít do #${rulesChannel.name}` : "Pravidla komunity"}
          >
            <BookOpen /><span>{rulesChannel ? "Přečíst pravidla" : onShowRules ? "Vytvořit kanál pravidel" : "Pravidla nezveřejněna"}</span>
          </button>
          <button
            type="button"
            onClick={() => introChannel && onSelectChannel(introChannel)}
            disabled={!introChannel}
            title={introChannel ? `Přejít do #${introChannel.name}` : "Kanál pro představení zatím není vytvořený"}
          >
            <UserRound /><span>Představ se</span>
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => voiceChannel && onSelectChannel(voiceChannel)}
            disabled={!voiceChannel}
            title={voiceChannel ? `Přejít do ${voiceChannel.name}` : "Hlasový kanál zatím není vytvořený"}
          >
            <Mic2 /><span>Připojit se na hlas</span>
          </button>
        </div>
      </div>

      <div className="sv-welcome-art" aria-hidden="true">
        <img className="sv-welcome-scene-image" src="/vox/reference/welcome-world-v30.webp" alt="" />
        <div className="sv-welcome-stars" />
        <div className="sv-welcome-starfield" />
        <div className="sv-welcome-clouds" />
        <div className="sv-welcome-nebula" />
        <div className="sv-welcome-aurora" />
        <div className="sv-welcome-planet-shadow" />
        <div className="sv-welcome-beam sv-welcome-beam-a" />
        <div className="sv-welcome-beam sv-welcome-beam-b" />
        <div className="sv-welcome-gateway" />
        <div className="sv-welcome-portal"><i /><b /><em /><span /></div>
        <div className="sv-welcome-spires sv-welcome-spires-back" />
        <div className="sv-welcome-spires sv-welcome-spires-front" />
        <div className="sv-welcome-cityline" />
        <div className="sv-welcome-city-glow" />
        <div className="sv-welcome-ridge sv-welcome-ridge-a" />
        <div className="sv-welcome-ridge sv-welcome-ridge-b" />
        <div className="sv-welcome-reflection" />
        <div className="sv-welcome-lightline" />
        <div className="sv-welcome-scan" />
        <div className="sv-welcome-motto">GOOD<br />PEOPLE<br />BETTER<br />WORLDS</div>
      </div>
    </section>
  );
}
