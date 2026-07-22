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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-[hsl(222_35%_6%)] border-border/60">
        <div className="h-24 bg-gradient-to-br from-primary/30 via-primary/10 to-transparent" />
        <div className="px-6 pb-6 -mt-12">
          <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-[hsl(222_35%_6%)] bg-secondary flex items-center justify-center text-2xl font-bold">
            {member.avatar_url
              ? <img src={member.avatar_url} alt={name} className="w-full h-full object-cover" />
              : name.slice(0, 2).toUpperCase()}
          </div>

          <DialogHeader className="mt-3 space-y-1">
            <DialogTitle className="flex items-center gap-2 text-xl">
              {name}
              {member.role === "owner" && <Crown className="w-4 h-4 text-amber-400" />}
              {member.role === "mod" && <Shield className="w-4 h-4 text-primary" />}
            </DialogTitle>
            {username && (
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <AtSign className="w-3 h-3" />{username}
              </div>
            )}
          </DialogHeader>

          {bio && (
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">O uživateli</div>
              <p className="text-sm whitespace-pre-wrap text-foreground/90">{bio}</p>
            </div>
          )}

          {member.roles && member.roles.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Role</div>
              <div className="flex flex-wrap gap-1.5">
                {member.roles.map((r) => <RoleBadge key={r.id} role={r} />)}
              </div>
            </div>
          )}

          {joinedAt && (
            <div className="mt-4 text-xs text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Připojen(a) {new Date(joinedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
