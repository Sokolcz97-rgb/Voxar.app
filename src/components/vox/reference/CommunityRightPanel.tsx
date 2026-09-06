import { CalendarDays, ChevronRight, Gamepad2, Sparkles, UsersRound } from "lucide-react";
import type { VoxMember } from "../MemberList";
import { ReferenceActiveMembers } from "../ReferenceActiveMembers";
import { useCommunityEvents } from "@/hooks/useCommunityEvents";
import { openVoxChannel, openVoxUtility } from "@/lib/voxCommunityBridge";

interface Props {
  guildId?: string;
  guildName: string;
  memberCount: number;
  onlineCount: number;
  members: VoxMember[];
  onJoinVoice: () => void;
  onShowEvents?: () => void;
  onShowMembers: () => void;
  onOpenChannel?: (channelId: string) => void;
  onMessage: (member: VoxMember) => void;
}

function eventLabel(value: string) {
  const date = new Date(value);
  const today = date.toDateString() === new Date().toDateString();
  return `${today ? "Dnes" : date.toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "short" })} ${date.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`;
}

export function CommunityRightPanel({
  guildId,
  guildName,
  memberCount,
  onlineCount,
  members,
  onShowEvents,
  onShowMembers,
  onOpenChannel,
  onMessage,
}: Props) {
  const { activeEvents, upcomingEvent } = useCommunityEvents(guildId);
  const previewAttendees = upcomingEvent?.attendees.filter((attendee) => attendee.status === "going").slice(0, 3) ?? [];
  const goingCount = upcomingEvent?.rsvp.going ?? 0;
  const extraCount = Math.max(goingCount - previewAttendees.length, 0);
  const showEvents = onShowEvents ?? (() => openVoxUtility("events"));
  const openChannel = onOpenChannel ?? openVoxChannel;

  return (
    <div className="sv-right-shell sv-right-shell-v3 sv-right-shell-v17 sv-right-shell-v18 sv-right-shell-v19 sv-right-shell-v24">
      <section className="sv-right-card sv-right-about sv-right-about-v3 sv-right-about-v18 sv-right-about-v19">
        <span className="sv-right-card-cut" aria-hidden="true" />
        <span className="sv-right-card-grid" aria-hidden="true" />
        <span className="sv-right-card-orbit" aria-hidden="true" />
        <span className="sv-right-card-beacon" aria-hidden="true" />
        <div className="sv-right-card-head">
          <div className="sv-right-card-title">O komunitě</div>
          <Sparkles className="sv-right-head-icon" aria-hidden="true" />
        </div>

        <div className="sv-right-community-heading">
          <h2>{guildName}</h2>
          <span className="sv-right-verified" title="Ověřená komunita">◆</span>
        </div>
        <p>Herní komunita, kde se potkávají lidé, nápady a nové světy. Spojujeme hráče, tvůrce a přátele. Buď součástí.</p>

        <div className="sv-right-stats sv-right-stats-v3">
          <div><UsersRound /><span className="sv-right-stat-copy"><strong>{memberCount}</strong><small>členů</small></span></div>
          <div><i className="sv-right-online-dot" /><span className="sv-right-stat-copy"><strong>{onlineCount}</strong><small>online</small></span></div>
          <div><CalendarDays /><span className="sv-right-stat-copy"><strong>{activeEvents.length}</strong><small>událostí</small></span></div>
        </div>

        <div className="sv-right-tags">
          <span>HRY</span><span>KOMUNITA</span><span>TVORBA</span><span>PŘÁTELSTVÍ</span>
        </div>
      </section>

      <section className="sv-right-card sv-right-now sv-right-now-v3 sv-right-now-v18 sv-right-now-v19">
        <span className="sv-right-card-cut" aria-hidden="true" />
        <span className="sv-right-now-scan" aria-hidden="true" />
        <span className="sv-right-now-beam" aria-hidden="true" />
        <div className="sv-right-card-head">
          <div className="sv-right-card-title">Nejbližší událost</div>
          <button type="button" className="sv-right-link-button" onClick={showEvents}>Zobrazit vše <ChevronRight /></button>
        </div>

        {upcomingEvent ? (
          <div className="sv-right-event sv-right-event-v3 sv-right-event-v18 sv-right-event-v19">
            <div className="sv-right-event-icon"><Gamepad2 /><span className="sv-right-event-live">EVENT</span></div>
            <div className="sv-right-event-copy">
              <strong>{upcomingEvent.title}</strong>
              <span>{eventLabel(upcomingEvent.starts_at)}{upcomingEvent.location ? ` · ${upcomingEvent.location}` : ""}</span>
              <div className="sv-right-event-data"><small>{goingCount} potvrzeno</small>{upcomingEvent.rsvp.interested > 0 && <small>· {upcomingEvent.rsvp.interested} má zájem</small>}</div>
              <div className="sv-right-event-people" aria-label="Účastníci události">
                {previewAttendees.map((attendee) => (
                  <span className="sv-right-event-avatar" key={attendee.user_id} title={attendee.display_name || "Člen"}>
                    {attendee.avatar_url ? <img src={attendee.avatar_url} alt="" /> : (attendee.display_name || "??").slice(0, 2).toUpperCase()}
                  </span>
                ))}
                {extraCount > 0 && <span className="sv-right-event-more">+{extraCount}</span>}
              </div>
            </div>
            <button
              type="button"
              className="sv-right-event-join"
              onClick={() => upcomingEvent.channel_id ? openChannel(upcomingEvent.channel_id) : showEvents()}
            >
              {upcomingEvent.channel_id ? "Otevřít" : "Detail"}
            </button>
          </div>
        ) : (
          <div className="sv-right-event sv-right-event-v3 sv-right-event-v18 sv-right-event-v19 is-empty">
            <div className="sv-right-event-icon"><CalendarDays /></div>
            <div className="sv-right-event-copy"><strong>Zatím nic naplánováno</strong><span>Nové komunitní akce se objeví automaticky.</span></div>
            <button type="button" className="sv-right-event-join" onClick={showEvents}>Události</button>
          </div>
        )}
      </section>

      <section className="sv-right-card sv-right-members sv-right-members-v3 sv-right-members-v18 sv-right-members-v19">
        <span className="sv-right-members-line" aria-hidden="true" />
        <span className="sv-right-members-grid" aria-hidden="true" />
        <div className="sv-right-members-head">
          <div><div className="sv-right-card-title">Aktivní členové</div></div>
          <button type="button" onClick={onShowMembers}>Zobrazit vše <ChevronRight /></button>
        </div>

        <div className="sv-right-members-list"><ReferenceActiveMembers members={members} onMessage={onMessage} /></div>

        <div className="sv-right-signature"><span>„Lepší komunity tvoří lepší hráče.“</span><strong>STUDIOVOXARIO</strong></div>
      </section>
    </div>
  );
}
