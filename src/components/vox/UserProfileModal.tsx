import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RoleBadge } from "@/components/vox/VoxRolesPanel";
import { Crown, Shield, Calendar, AtSign } from "lucide-react";
import type { VoxMember } from "@/components/vox/MemberList";

interface Props {
  member: VoxMember | null;
  guildId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileModal({ member, guildId, open, onOpenChange }: Props) {
  const [bio, setBio] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [joinedAt, setJoinedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !member) return;
    let cancel = false;
    (async () => {
      const [{ data: p }, { data: gm }] = await Promise.all([
        supabase.from("profiles")
          .select("bio, username")
          .eq("user_id", member.user_id).maybeSingle(),
        guildId
          ? supabase.from("vox_guild_members")
              .select("joined_at")
              .eq("guild_id", guildId).eq("user_id", member.user_id).maybeSingle()
          : Promise.resolve({ data: null as any }),
      ]);
      if (cancel) return;
      setBio((p as any)?.bio ?? null);
      setUsername((p as any)?.username ?? null);
      setJoinedAt((gm as any)?.joined_at ?? null);
    })();
    return () => { cancel = true; };
  }, [open, member, guildId]);

  if (!member) return null;
  const name = member.nickname || member.display_name || member.user_id.slice(0, 8);

  const topColor = member.roles?.[0]?.color || "hsl(var(--primary))";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden holo-context-menu border-0">
        <div
          className="h-24 relative"
          style={{ background: `linear-gradient(135deg, ${topColor}55, hsl(var(--primary)/0.15) 60%, transparent)` }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--primary)/0.15)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary)/0.15)_1px,transparent_1px)] bg-[size:22px_22px] opacity-40" />
        </div>
        <div className="px-6 pb-6 -mt-12">
          <div
            className="rank-ring w-24 h-24"
            style={{ ["--rank-color" as any]: topColor }}
          >
            <div className="rank-inner overflow-hidden flex items-center justify-center text-2xl font-display font-bold">
              {member.avatar_url
                ? <img loading="lazy" decoding="async" src={member.avatar_url} alt={name} className="w-full h-full object-cover" />
                : name.slice(0, 2).toUpperCase()}
            </div>
          </div>

          <DialogHeader className="mt-3 space-y-1">
            <DialogTitle
              className="flex items-center gap-2 text-xl font-display tracking-wider"
              style={{ color: topColor, textShadow: `0 0 12px ${topColor}66` }}
            >
              {name}
              {member.role === "owner" && <Crown className="w-4 h-4 text-amber-400" />}
              {member.role === "mod" && <Shield className="w-4 h-4 text-primary" />}
            </DialogTitle>
            {username && (
              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1">
                <AtSign className="w-3 h-3" />{username}
              </div>
            )}
          </DialogHeader>

          {bio && (
            <div className="mt-4">
              <div className="text-[10px] font-display uppercase tracking-widest text-primary/70 mb-1">// PROFIL ENTITY</div>
              <p className="text-sm whitespace-pre-wrap text-foreground/90 border-l-2 border-primary/40 pl-3">{bio}</p>
            </div>
          )}

          {member.roles && member.roles.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-display uppercase tracking-widest text-primary/70 mb-2">// ROLE</div>
              <div className="flex flex-wrap gap-1.5">
                {member.roles.map((r) => <RoleBadge key={r.id} role={r} />)}
              </div>
            </div>
          )}

          {joinedAt && (
            <div className="mt-4 text-[11px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              LINK NAVÁZÁN // {new Date(joinedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
