import { Crown, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoxMember {
  user_id: string;
  nickname: string | null;
  role: "owner" | "mod" | "member";
  display_name?: string | null;
  avatar_url?: string | null;
  status?: "online" | "idle" | "dnd" | "offline";
}

const statusColor: Record<string, string> = {
  online: "bg-emerald-400",
  idle: "bg-amber-400",
  dnd: "bg-red-500",
  offline: "bg-gray-500",
};

const statusLabel: Record<string, string> = {
  online: "Online",
  idle: "Nepřítomen",
  dnd: "Nerušit",
  offline: "Offline",
};

export function MemberList({ members }: { members: VoxMember[] }) {
  const groups: Record<string, VoxMember[]> = { online: [], idle: [], dnd: [], offline: [] };
  members.forEach((m) => groups[m.status || "offline"].push(m));

  return (
    <aside className="w-60 h-full bg-[hsl(222_35%_5%)] border-l border-border/40 overflow-y-auto p-3 space-y-4">
      {Object.entries(groups).map(([status, list]) => {
        if (!list.length) return null;
        return (
          <div key={status}>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 mb-1.5">
              {statusLabel[status]} — {list.length}
            </div>
            <ul className="space-y-0.5">
              {list.map((m) => {
                const name = m.nickname || m.display_name || m.user_id.slice(0, 8);
                return (
                  <li key={m.user_id} className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/60 transition-colors",
                    status === "offline" && "opacity-50"
                  )}>
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-xs font-semibold">
                        {m.avatar_url
                          ? <img src={m.avatar_url} alt={name} className="w-full h-full object-cover" />
                          : name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className={cn(
                        "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[hsl(222_35%_5%)]",
                        statusColor[m.status || "offline"]
                      )} />
                    </div>
                    <span className="truncate text-sm">{name}</span>
                    {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-amber-400 ml-auto shrink-0" />}
                    {m.role === "mod" && <Shield className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </aside>
  );
}
