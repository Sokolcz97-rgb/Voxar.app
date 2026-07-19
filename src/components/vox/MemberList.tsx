import { Crown, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleBadge, type VoxRole } from "@/components/vox/VoxRolesPanel";

export interface VoxMember {
  user_id: string;
  nickname: string | null;
  role: "owner" | "mod" | "member";
  display_name?: string | null;
  avatar_url?: string | null;
  status?: "online" | "idle" | "dnd" | "offline";
  /** Přiřazené vlastní role (řazené podle position DESC). */
  roles?: VoxRole[];
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

/** Nejvyšší (nejvíc nahoře v seznamu) role, která hlavního člena barví/zvedá do samostatné kategorie. */
function topHoistRole(m: VoxMember): VoxRole | null {
  return (m.roles || []).find((r) => r.hoist) || null;
}
function topAnyRole(m: VoxMember): VoxRole | null {
  return (m.roles || [])[0] || null;
}

export function MemberList({ members }: { members: VoxMember[] }) {
  // Rozdělit online (dnd/idle taky "online" pro účely zvedání) vs offline
  const offline = members.filter((m) => (m.status || "offline") === "offline");
  const online = members.filter((m) => (m.status || "offline") !== "offline");

  // Skupiny podle hoist rolí (pořadí podle position DESC).
  const hoistGroups = new Map<string, { role: VoxRole; list: VoxMember[] }>();
  const onlineNoHoist: VoxMember[] = [];
  for (const m of online) {
    const top = topHoistRole(m);
    if (top) {
      const g = hoistGroups.get(top.id) || { role: top, list: [] };
      g.list.push(m);
      hoistGroups.set(top.id, g);
    } else {
      onlineNoHoist.push(m);
    }
  }
  const orderedHoist = Array.from(hoistGroups.values()).sort(
    (a, b) => (b.role.position ?? 0) - (a.role.position ?? 0),
  );

  const renderMember = (m: VoxMember) => {
    const name = m.nickname || m.display_name || m.user_id.slice(0, 8);
    const top = topAnyRole(m);
    return (
      <li
        key={m.user_id}
        className={cn(
          "flex items-center gap-2 px-2 py-1.5 rounded hover:bg-secondary/60 transition-colors",
          (m.status || "offline") === "offline" && "opacity-50",
        )}
      >
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex items-center justify-center text-xs font-semibold">
            {m.avatar_url ? (
              <img src={m.avatar_url} alt={name} className="w-full h-full object-cover" />
            ) : (
              name.slice(0, 2).toUpperCase()
            )}
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[hsl(222_35%_5%)]",
              statusColor[m.status || "offline"],
            )}
          />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-1.5">
          <span
            className="truncate text-sm font-medium"
            style={top ? { color: top.color } : undefined}
          >
            {name}
          </span>
          {top && <RoleBadge role={top} />}
        </div>
        {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        {m.role === "mod" && !top && <Shield className="w-3.5 h-3.5 text-primary shrink-0" />}
      </li>
    );
  };

  const renderGroup = (title: string, list: VoxMember[], key: string, dotClass?: string) => {
    if (!list.length) return null;
    return (
      <div key={key}>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-1 mb-1.5 flex items-center gap-1.5">
          {dotClass && <span className={cn("w-2 h-2 rounded-full", dotClass)} />}
          {title} — {list.length}
        </div>
        <ul className="space-y-0.5">{list.map(renderMember)}</ul>
      </div>
    );
  };

  return (
    <aside className="w-60 h-full bg-[hsl(222_35%_5%)] border-l border-border/40 overflow-y-auto p-3 space-y-4">
      {orderedHoist.map((g) =>
        renderGroup(g.role.name, g.list, `hoist-${g.role.id}`),
      )}
      {renderGroup("Online", onlineNoHoist, "online", statusColor.online)}
      {renderGroup(statusLabel.offline, offline, "offline", statusColor.offline)}
    </aside>
  );
}
