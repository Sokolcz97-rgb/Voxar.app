import { CalendarDays, Gamepad2, UsersRound } from "lucide-react";
import type { VoxMember } from "../MemberList";
import { ReferenceActiveMembers } from "../ReferenceActiveMembers";

interface Props {
  guildName: string;
  memberCount: number;
  onlineCount: number;
  members: VoxMember[];
  onJoinVoice: () => void;
  onShowMembers: () => void;
  onMessage: (member: VoxMember) => void;
}

export function CommunityRightPanel({
  guildName,
  memberCount,
  onlineCount,
  members,
  onJoinVoice,
  onShowMembers,
  onMessage,
}: Props) {
  return (
    <div className="sv-right-shell">
      <section className="sv-right-card sv-right-about">
        <div className="sv-right-card-title">O komunitě</div>
        <h2>{guildName}</h2>
        <p>Herní komunita, kde se potkávají lidé, nápady a nové světy. Spojujeme hráče, tvůrce a přátele.</p>

        <div className="sv-right-stats">
          <div><UsersRound /><strong>{memberCount}</strong><span>členů</span></div>
          <div><i className="sv-right-online-dot" /><strong>{onlineCount}</strong><span>online</span></div>
          <div><CalendarDays /><strong>6</strong><span>událostí</span></div>
        </div>

        <div className="sv-right-tags">
          <span>HRY</span><span>KOMUNITA</span><span>TVORBA</span><span>PŘÁTELSTVÍ</span>
        </div>
      </section>

      <section className="sv-right-card sv-right-now">
        <div className="sv-right-card-title">Právě se děje</div>
        <div className="sv-right-event">
          <div className="sv-right-event-icon"><Gamepad2 /></div>
          <div className="sv-right-event-copy">
            <strong>Páteční herní večer</strong>
            <span>Dnes 20:00 · Hlasový kanál</span>
          </div>
          <button type="button" onClick={onJoinVoice}>Připojit se</button>
        </div>
      </section>

      <section className="sv-right-card sv-right-members">
        <div className="sv-right-members-head">
          <div className="sv-right-card-title">Aktivní členové</div>
          <button type="button" onClick={onShowMembers}>Zobrazit vše →</button>
        </div>
        <div className="sv-right-members-list">
          <ReferenceActiveMembers members={members} onMessage={onMessage} />
        </div>
        <div className="sv-right-signature">StudioVoxario · Lepší komunity tvoří lepší hráče.</div>
      </section>
    </div>
  );
}
