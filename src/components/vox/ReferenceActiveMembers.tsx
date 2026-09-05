import { MessageCircle, ShieldCheck } from "lucide-react";
import type { VoxMember } from "./MemberList";

interface Props {
  members: VoxMember[];
  onMessage: (member: VoxMember) => void;
}

const statusText: Record<string, string> = {
  online: "Online",
  idle: "Nepřítomen",
  dnd: "Nerušit",
  offline: "Offline",
};

export function ReferenceActiveMembers({ members, onMessage }: Props) {
  const visible = [...members]
    .sort((a, b) => {
      const order: Record<string, number> = { online: 0, idle: 1, dnd: 2, offline: 3 };
      return (order[a.status || "offline"] ?? 3) - (order[b.status || "offline"] ?? 3);
    })
    .slice(0, 7);

  return (
    <div className="vox-ref-active-members">
      {visible.map((member) => {
        const name = member.nickname || member.display_name || member.user_id.slice(0, 8);
        const topRole = member.roles?.[0];
        const status = member.status || "offline";
        return (
          <button
            type="button"
            key={member.user_id}
            className="vox-ref-active-member"
            onClick={() => onMessage(member)}
            title={`Napsat uživateli ${name}`}
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
              <small>{statusText[status] || "Offline"}</small>
            </span>
            <MessageCircle className="vox-ref-member-message" />
          </button>
        );
      })}

      {visible.length === 0 && (
        <div className="vox-ref-active-empty">Nikdo tu zatím není online.</div>
      )}
    </div>
  );
}
