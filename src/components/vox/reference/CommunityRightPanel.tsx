import { CalendarDays, ChevronRight, Gamepad2, Sparkles, UsersRound } from "lucide-react";
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
  const previewMembers = members.slice(0, 3);
  const extraCount = Math.max(memberCount - previewMembers.length, 0);

  return (
    <div className="sv-right-shell sv-right-shell-v3">
      <section className="sv-right-card sv-right-about sv-right-about-v3">
        <div className="sv-right-card-head">
          <div className="sv-right-card-title">O komunitě</div>
          <Sparkles className="sv-right-head-icon" aria-hidden="true" />
        </div>

        <div className="sv-right-community-heading">
          <h2>{guildName}</h2>
          <span className="sv-right-verified" title="Ověřená komunita">◆</span>
        </div>
        <p>Herní komunita, kde se potkávají lidé, nápady a nové světy. Spojujeme hráče, tvůrce a přátele.</p>

        <div className="sv-right-stats sv-right-stats-v3">
          <div>
            <UsersRound />
            <span className="sv-right-stat-copy"><strong>{memberCount}</strong><small>členů</small></span>
          </div>
          <div>
            <i className="sv-right-online-dot" />
            <span className="sv-right-stat-copy"><strong>{onlineCount}</strong><small>online</small></span>
          </div>
          <div>
            <CalendarDays />
            <span className="sv-right-stat-copy"><strong>6</strong><small>událostí</small></span>
          </div>
        </div>

        <div className="sv-right-tags">
          <span>HRY</span><span>KOMUNITA</span><span>TVORBA</span><span>PŘÁTELSTVÍ</span>
        </div>
      </section>

      <section className="sv-right-card sv-right-now sv-right-now-v3">
        <div className="sv-right-card-head">
          <div className="sv-right-card-title">Právě se děje</div>
          <button type="button" className="sv-right-link-button" onClick={onJoinVoice}>
            Zobrazit vše <ChevronRight />
          </button>
        </div>

        <div className="sv-right-event sv-right-event-v3">
          <div className="sv-right-event-icon"><Gamepad2 /></div>
          <div className="sv-right-event-copy">
            <strong>Páteční herní večer</strong>
            <span>Dnes 20:00 · Hlasový kanál</span>
            <div className="sv-right-event-people" aria-label="Účastníci události">
              {previewMembers.map((member) => (
                <span className="sv-right-event-avatar" key={member.user_id} title={member.display_name || member.nickname || "Člen"}>
                  {member.avatar_url
                    ? <img src={member.avatar_url} alt="" />
                    : (member.display_name || member.nickname || "??").slice(0, 2).toUpperCase()}
                </span>
              ))}
              {extraCount > 0 && <span className="sv-right-event-more">+{extraCount}</span>}
            </div>
          </div>
          <button type="button" onClick={onJoinVoice}>Připojit se</button>
        </div>
      </section>

      <section className="sv-right-card sv-right-members sv-right-members-v3">
        <div className="sv-right-members-head">
          <div className="sv-right-card-title">Aktivní členové</div>
          <button type="button" onClick={onShowMembers}>Zobrazit vše <ChevronRight /></button>
        </div>

        <div className="sv-right-members-list">
          <ReferenceActiveMembers members={members} onMessage={onMessage} />
        </div>

        <div className="sv-right-signature">
          <span>„Lepší komunity tvoří lepší hráče.“</span>
          <strong>STUDIOVOXARIO</strong>
        </div>
      </section>
    </div>
  );
}
