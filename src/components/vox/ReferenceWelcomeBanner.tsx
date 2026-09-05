import { BookOpen, Mic2, UserRound } from "lucide-react";
import type { VoxChannel } from "./ChannelSidebar";

interface Props {
  guildName: string;
  channels: VoxChannel[];
  onSelectChannel: (channel: VoxChannel) => void;
  onShowRules?: () => void;
}

export function ReferenceWelcomeBanner({ guildName, channels, onSelectChannel, onShowRules }: Props) {
  const introChannel = channels.find((c) => c.type === "text" && ["představ-se", "predstav-se", "introductions"].includes(c.name.toLowerCase()));
  const voiceChannel = channels.find((c) => c.type === "voice");

  return (
    <section className="vox-ref-welcome-banner" aria-label="Vítej v komunitě">
      <div className="vox-ref-welcome-copy">
        <div className="vox-ref-welcome-eyebrow">
          <span className="vox-ref-welcome-mark">SV</span>
          <strong>{guildName.toUpperCase()}</strong>
          <span className="vox-ref-app-pill">APP</span>
          <span className="vox-ref-welcome-time">20:12</span>
        </div>
        <h2>Vítej v komunitě!</h2>
        <p>Jsme rádi, že jsi tady. Voxar.app je místo pro hráče, tvůrce a přátele.</p>
        <p>Respektuj ostatní, užívej si atmosféru a tvoř s námi něco většího.</p>

        <div className="vox-ref-welcome-actions">
          <button type="button" onClick={onShowRules}>
            <BookOpen /> Přečíst pravidla
          </button>
          <button
            type="button"
            onClick={() => introChannel && onSelectChannel(introChannel)}
            disabled={!introChannel}
          >
            <UserRound /> Představ se
          </button>
          <button
            type="button"
            className="primary"
            onClick={() => voiceChannel && onSelectChannel(voiceChannel)}
            disabled={!voiceChannel}
          >
            <Mic2 /> Připojit se na hlas
          </button>
        </div>
      </div>

      <div className="vox-ref-welcome-visual" aria-hidden="true">
        <div className="vox-ref-portal" />
        <div className="vox-ref-mountains" />
        <div className="vox-ref-welcome-motto">GOOD<br />PEOPLE<br />BETTER<br />WORLDS</div>
      </div>
    </section>
  );
}
