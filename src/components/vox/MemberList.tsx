import { useState } from "react";
import { Crown, Shield, Mic, MicOff, HeadphoneOff, Volume2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleBadge, type VoxRole } from "@/components/vox/VoxRolesPanel";
import { UserContextMenu } from "@/components/vox/UserContextMenu";
import { UserProfileModal } from "@/components/vox/UserProfileModal";

export interface VoxMember {
  user_id: string;
  nickname: string | null;
  role: "owner" | "mod" | "member";
  display_name?: string | null;
  avatar_url?: string | null;
  status?: "online" | "idle" | "dnd" | "offline";
  roles?: VoxRole[];
}

export interface VoiceUserState {
  channel_id?: string;
  is_muted?: boolean;
  is_deafened?: boolean;
  speaking?: boolean;
  /** 0..1 audio level for glow intensity */
  level?: number;
}

interface MemberListProps {
  members: VoxMember[];
  guildId?: string | null;
  currentUserId?: string | null;
  allRoles?: VoxRole[];
  canModerate?: boolean;
  /** Per-user voice state; presence in map implies user is currently in a voice channel. */
  voiceState?: Record<string, VoiceUserState>;
  onMessage?: (m: VoxMember) => void;
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

function topHoistRole(m: VoxMember): VoxRole | null {
  return (m.roles || []).find((r) => r.hoist) || null;
}
function topAnyRole(m: VoxMember): VoxRole | null {
  return (m.roles || [])[0] || null;
}

interface ItemProps {
  member: VoxMember;
  guildId: string | null;
  currentUserId: string | null;
  allRoles: VoxRole[];
  canModerate: boolean;
  voice?: VoiceUserState;
  onMessage?: (m: VoxMember) => void;
  onOpenProfile: (m: VoxMember) => void;
}

function UserListItem({
  member, guildId, currentUserId, allRoles, canModerate, voice, onMessage, onOpenProfile,
}: ItemProps) {
  const m = member;
  const name = m.nickname || m.display_name || m.user_id.slice(0, 8);
  const top = topAnyRole(m);
  const isSelf = m.user_id === currentUserId;
  const inVoice = !!voice;
  const speaking = !!voice?.speaking && !voice?.is_muted;

  const handleLeftClick = () => {
    if (isSelf || !onMessage) onOpenProfile(m);
    else onMessage(m);
  };

  return (
    <UserContextMenu
      member={m}
      guildId={guildId}
      allRoles={allRoles}
      canModerate={canModerate}
      isSelf={isSelf}
      onMessage={onMessage}
      onViewProfile={onOpenProfile}
    >
      <li
        onClick={handleLeftClick}
        className={cn(
          "group relative flex items-center gap-3 pl-3.5 pr-2.5 py-2 cursor-pointer",
          "border-l-2 border-transparent transition-all duration-150",
          "hover:border-primary/70 hover:bg-primary/[0.07] hover:shadow-[inset_0_0_18px_hsl(var(--primary)/0.12)]",
          speaking && "border-emerald-400/80 bg-emerald-500/[0.07]",
          (m.status || "offline") === "offline" && !inVoice && "opacity-45",
        )}
      >

        <div className="relative shrink-0">
          <div
            className={cn("rank-ring", speaking && "speaking-ring")}
            style={{ ["--rank-color" as any]: top?.color || "hsl(184 100% 54% / 0.55)" }}
          >
            <div className="rank-inner w-8 h-8 flex items-center justify-center text-xs font-semibold">
              {m.avatar_url
                ? <img src={m.avatar_url} alt={name} className="w-full h-full object-cover" />
                : name.slice(0, 2).toUpperCase()}
            </div>
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
            className="truncate text-[13px] font-display tracking-wide"
            style={top ? { color: top.color } : undefined}
          >
            {name}
          </span>
          {top && <RoleBadge role={top} />}
        </div>


        {/* Voice indicators */}
        {inVoice && voice?.is_deafened && <HeadphoneOff className="w-3.5 h-3.5 text-destructive shrink-0" />}
        {inVoice && voice?.is_muted && !voice?.is_deafened && <MicOff className="w-3.5 h-3.5 text-destructive shrink-0" />}
        {inVoice && !voice?.is_muted && !voice?.is_deafened && (
          <Volume2 className={cn("w-3.5 h-3.5 shrink-0", speaking ? "text-emerald-400" : "text-muted-foreground/60")} />
        )}

        {m.role === "owner" && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
        {m.role === "mod" && !top && <Shield className="w-3.5 h-3.5 text-primary shrink-0" />}
      </li>
    </UserContextMenu>
  );
}

export function MemberList({
  members,
  guildId = null,
  currentUserId = null,
  allRoles = [],
  canModerate = false,
  voiceState = {},
  onMessage,
}: MemberListProps) {
  const [profileMember, setProfileMember] = useState<VoxMember | null>(null);
  const [filter, setFilter] = useState<"all" | "voice" | "admin">("all");
  const [listOpen, setListOpen] = useState(true);

  const filtered = members.filter((m) => {
    if (filter === "voice") return !!voiceState[m.user_id];
    if (filter === "admin") return m.role === "owner" || m.role === "mod";
    return true;
  });

  const inVoiceList = filtered.filter((m) => voiceState[m.user_id]);
  const voiceIds = new Set(inVoiceList.map((m) => m.user_id));
  const rest = filtered.filter((m) => !voiceIds.has(m.user_id));

  const offline = rest.filter((m) => (m.status || "offline") === "offline");
  const online = rest.filter((m) => (m.status || "offline") !== "offline");

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

  const itemProps = (m: VoxMember) => ({
    member: m,
    guildId,
    currentUserId,
    allRoles,
    canModerate,
    voice: voiceState[m.user_id],
    onMessage,
    onOpenProfile: setProfileMember,
  });

  const renderGroup = (title: string, list: VoxMember[], key: string, dotClass?: string) => {
    if (!list.length) return null;
    return (
      <div key={key}>
        <div className="mb-2 flex items-center gap-2">
          {dotClass && <span className={cn("w-1.5 h-1.5 rounded-full shadow-[0_0_6px_currentColor]", dotClass)} />}
          <span className="text-[9px] font-display uppercase tracking-[0.28em] text-primary/70 text-glow whitespace-nowrap">
            // {title}
          </span>
          <span className="flex-1 h-px bg-gradient-to-r from-primary/40 to-transparent" />
          <span className="text-[9px] font-mono text-primary/50">{String(list.length).padStart(2, "0")}</span>
        </div>
        <ul className="space-y-0.5">
          {list.map((m) => <UserListItem key={m.user_id} {...itemProps(m)} />)}
        </ul>
      </div>
    );
  };


  const total = members.length;
  const filters: Array<{ id: "all" | "voice" | "admin"; label: string }> = [
    { id: "all", label: "All" },
    { id: "voice", label: "Voice" },
    { id: "admin", label: "Admin" },
  ];

  return (
    <>
      <aside className="w-60 h-full bg-transparent overflow-y-auto">
        {/* Blueprint header: ENTITY POD */}
        <div className="sticky top-0 z-10 px-3 pt-3 pb-2 bg-gradient-to-b from-[hsl(220_35%_5%/0.9)] to-transparent backdrop-blur-sm border-b border-primary/15">
          <div className="flex items-center justify-between">
            <div className="font-display text-[11px] tracking-[0.28em] text-primary/80 text-glow uppercase">
              Entity pod
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-primary/60">{total} / ∞</span>
              <button
                onClick={() => setListOpen((v) => !v)}
                className="text-primary/70 hover:text-primary transition-colors"
                title={listOpen ? "Sbalit" : "Rozbalit"}
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform", !listOpen && "-rotate-90")} />
              </button>
            </div>
          </div>

          <div className="mt-1 text-[10px] font-display uppercase tracking-[0.22em] text-muted-foreground">
            Členové sektoru
          </div>
          {/* Rank ring legend */}
          {orderedHoist.length > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-display uppercase tracking-[0.28em] text-primary/50">// RANK</span>
              {orderedHoist.slice(0, 6).map((g) => (
                <span key={g.role.id} className="flex items-center gap-1" title={g.role.name}>
                  <span
                    className="w-2 h-2 rounded-full shadow-[0_0_6px_currentColor]"
                    style={{ background: g.role.color || "hsl(var(--primary))", color: g.role.color || "hsl(var(--primary))" }}
                  />
                  <span className="text-[9px] font-display uppercase tracking-[0.18em] text-muted-foreground">{g.role.name}</span>
                </span>
              ))}
            </div>
          )}
          {/* Filter chip bar */}
          <div className="mt-2 flex items-center gap-1.5">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn("holo-chip", filter === f.id && "active")}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {listOpen && (
        <div className="p-3 space-y-4">
          {renderGroup("V hlasovém kanále", inVoiceList, "voice", "bg-emerald-400")}
          {orderedHoist.map((g) => renderGroup(g.role.name.toUpperCase(), g.list, `hoist-${g.role.id}`))}
          {renderGroup("ONLINE", onlineNoHoist, "online", statusColor.online)}
          {renderGroup(statusLabel.offline.toUpperCase(), offline, "offline", statusColor.offline)}
        </div>
        )}
      </aside>

      <UserProfileModal
        member={profileMember}
        guildId={guildId}
        open={!!profileMember}
        onOpenChange={(o) => !o && setProfileMember(null)}
      />
    </>
  );
}
