import { MessageCircle, ShieldCheck } from "lucide-react";
import type { VoxMember } from "./MemberList";

interface Props {
  members: VoxMember[];
  currentUserId?: string | null;
  onMessage: (member: VoxMember) => void;
  onSelf?: (member: VoxMember) => void;
}

const statusText: Record<string, string> = {
  online: "Online",
  idle: "Nepřítomen",
  dnd: "Nerušit",
  offline: "Offline",
};

const activityText: Record<string, string> = {
  online: "Aktivní v komunitě",
  idle: "Chvíli mimo",
  dnd: "Nerušit",
  offline: "Naposledy offline",
};

export function ReferenceActiveMembers({ members, currentUserId, onMessage, onSelf }: Props) {
  const visible = [...members]
    .sort((a, b) => {
      const order: Record<string, number> = { online: 0, idle: 1, dnd: 2, offline: 3 };
      return (order[a.status || "offline"] ?? 3) - (order[b.status || "offline"] ?? 3);
    })
    .slice(0, 7);

  return (
    <div className="vox-ref-active-members vox-ref-active-members-v18">
      {visible.map((member) => {
        const name = member.nickname || member.display_name || member.user_id.slice(0, 8);
        const topRole = member.roles?.[0];
        const status = member.status || "offline";
        const isSelf = member.user_id === currentUserId;
        return (
          <button
            type="button"
            key={member.user_id}
            className={`vox-ref-active-member status-${status}`}
            onClick={() => isSelf ? onSelf?.(member) : onMessage(member)}
            title={isSelf ? `Otevřít profil ${name}` : `Napsat uživateli ${name}`}
          >
            <span className="vox-ref-member-avatar" style={topRole?.color ? { borderColor: topRole.color } : undefined}>
              {member.avatar_url
                ? <img src={member.avatar_url} alt="" />
                : name.slice(0, 2).toUpperCase()}
              <i className={`status-${status}`} />
            </span>
            <span className="vox-ref-member-copy">
              <span className="vox-ref-member-line">
                <strong style={topRole?.color ? { color: topRole.color } : undefined}>{name}</strong>
                {topRole && <em>{topRole.name}</em>}
                {!topRole && (member.role === "owner" || member.role === "mod") && <ShieldCheck />}
              </span>
              <span className="vox-ref-member-activity">
                <small>{activityText[status] || statusText[status] || "Offline"}</small>
                <i aria-hidden="true" />
                <small>{statusText[status] || "Offline"}</small>
              </span>
            </span>
            {!isSelf && <MessageCircle className="vox-ref-member-message" />}
            <span className="vox-ref-member-edge" aria-hidden="true" />
          </button>
        );
      })}

      {visible.length === 0 && (
        <div className="vox-ref-active-empty">Nikdo tu zatím není online.</div>
      )}
    </div>
  );
}
