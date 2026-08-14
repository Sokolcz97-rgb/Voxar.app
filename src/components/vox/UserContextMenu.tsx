import { ReactNode, useEffect, useState } from "react";
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuLabel, ContextMenuSub, ContextMenuSubTrigger,
  ContextMenuSubContent, ContextMenuCheckboxItem,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  MessageCircle, User, VolumeX, Volume2, Shield, MicOff, HeadphoneOff,
  UserX, Ban, Tag, Trash2,
} from "lucide-react";
import { localAudio } from "@/lib/localAudio";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { VoxMember } from "@/components/vox/MemberList";
import type { VoxRole } from "@/components/vox/VoxRolesPanel";

interface Props {
  member: VoxMember;
  guildId: string | null;
  allRoles?: VoxRole[];
  canModerate: boolean;
  isSelf: boolean;
  onMessage?: (m: VoxMember) => void;
  onViewProfile: (m: VoxMember) => void;
  children: ReactNode;
}

export function UserContextMenu({
  member, guildId, allRoles = [], canModerate, isSelf,
  onMessage, onViewProfile, children,
}: Props) {
  const [, force] = useState(0);
  useEffect(() => localAudio.subscribe(() => force((x) => x + 1)), []);

  const [banOpen, setBanOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [busy, setBusy] = useState(false);

  const vol = Math.round(localAudio.getVolume(member.user_id) * 100);
  const locallyMuted = localAudio.isMuted(member.user_id);

  const doKick = async () => {
    if (!guildId) return;
    setBusy(true);
    const { error } = await supabase.rpc("vox_kick_member", { _guild: guildId, _user: member.user_id });
    setBusy(false);
    if (error) toast({ title: "Nelze vyhodit", description: error.message, variant: "destructive" });
    else toast({ title: "Uživatel vyhozen" });
  };

  const doBan = async () => {
    if (!guildId) return;
    setBusy(true);
    const { error } = await supabase.rpc("vox_ban_member", {
      _guild: guildId, _user: member.user_id, _reason: banReason.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Nelze zabanovat", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Uživatel zabanován" });
    setBanOpen(false);
    setBanReason("");
  };

  const doServerMute = async (mins = 30) => {
    if (!guildId) return;
    const { error } = await supabase.rpc("vox_mute_member", { _guild: guildId, _user: member.user_id, _minutes: mins });
    if (error) toast({ title: "Nelze umlčet", description: error.message, variant: "destructive" });
    else toast({ title: `Umlčen na ${mins} min` });
  };

  const assignedIds = new Set((member.roles ?? []).map((r) => r.id));
  const assignableRoles = allRoles.filter((r) => !r.is_default);

  const toggleRole = async (role: VoxRole, checked: boolean) => {
    if (!guildId) return;
    if (checked) {
      const { error } = await supabase.from("vox_member_roles").insert({
        guild_id: guildId, user_id: member.user_id, role_id: role.id,
      });
      if (error) toast({ title: "Nelze přiřadit roli", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("vox_member_roles")
        .delete().eq("guild_id", guildId).eq("user_id", member.user_id).eq("role_id", role.id);
      if (error) toast({ title: "Nelze odebrat roli", description: error.message, variant: "destructive" });
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="holo-context-menu holo-ctx w-64 text-foreground font-display tracking-wider uppercase text-xs">
          <span className="ctx-brackets" aria-hidden />
          <div className="ctx-head">
            <div className="text-[8px] tracking-[0.3em] text-primary/60 mb-0.5">// ENTITY · 0x{member.user_id.slice(0, 4)}</div>
            <div className="truncate text-primary text-glow flex items-center gap-2 text-[13px]">
              <User className="w-3.5 h-3.5" />
              {member.nickname || member.display_name || member.user_id.slice(0, 8)}
            </div>
          </div>

          {!isSelf && (
            <ContextMenuItem onSelect={() => onMessage?.(member)}>
              <MessageCircle className="w-4 h-4 mr-2 text-primary" /> Send packet
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => onViewProfile(member)}>
            <User className="w-4 h-4 mr-2 text-primary" /> View entity
          </ContextMenuItem>

          {!isSelf && (
            <>
              <div className="ctx-section">// AUDIO · LOCAL</div>
              <div className="ctx-audio normal-case tracking-normal">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="flex items-center gap-1.5 text-muted-foreground font-display uppercase tracking-widest">
                    <Volume2 className="w-3.5 h-3.5" /> Gain
                  </span>
                  <span className="font-mono text-primary text-glow">{vol}%</span>
                </div>
                <Slider
                  min={0} max={200} step={5}
                  value={[vol]}
                  onValueChange={([v]) => localAudio.setVolume(member.user_id, v / 100)}
                />
              </div>
              <ContextMenuCheckboxItem
                checked={locallyMuted}
                onCheckedChange={(c) => localAudio.setMuted(member.user_id, !!c)}
              >
                <VolumeX className="w-4 h-4 mr-2 text-primary" /> Mute local
              </ContextMenuCheckboxItem>
            </>
          )}

          {canModerate && !isSelf && (
            <>
              <div className="ctx-section">
                <Shield className="w-3 h-3" /> // MOD · TOOLS
              </div>


              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <MicOff className="w-4 h-4 mr-2 text-primary" /> Server mute
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="holo-context-menu holo-ctx font-display uppercase tracking-wider text-xs">
                  <ContextMenuItem onSelect={() => doServerMute(5)}>5 min</ContextMenuItem>
                  <ContextMenuItem onSelect={() => doServerMute(30)}>30 min</ContextMenuItem>
                  <ContextMenuItem onSelect={() => doServerMute(60)}>1 hr</ContextMenuItem>
                  <ContextMenuItem onSelect={() => doServerMute(60 * 24)}>1 day</ContextMenuItem>
                  <ContextMenuItem onSelect={() => doServerMute(0)}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Purge mute
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>

              {assignableRoles.length > 0 && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Tag className="w-4 h-4 mr-2 text-primary" /> Assign rank
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="holo-context-menu holo-ctx max-h-80 overflow-y-auto font-display uppercase tracking-wider text-xs">
                    {assignableRoles.map((r) => (
                      <ContextMenuCheckboxItem
                        key={r.id}
                        checked={assignedIds.has(r.id)}
                        onCheckedChange={(c) => toggleRole(r, !!c)}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full mr-2"
                          style={{ background: r.color, boxShadow: `0 0 8px ${r.color}` }}
                        />
                        {r.name}
                      </ContextMenuCheckboxItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )}

              <div className="ctx-danger">
                <div className="px-2 pb-1 text-[8px] tracking-[0.3em] text-destructive/80">// DANGER · ZONE</div>
                <ContextMenuItem
                  onSelect={doKick}
                  disabled={busy || member.role === "owner"}
                >
                  <UserX className="w-4 h-4 mr-2" /> Eject entity
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => setBanOpen(true)}
                  disabled={busy || member.role === "owner"}
                >
                  <Ban className="w-4 h-4 mr-2" /> Purge // ban…
                </ContextMenuItem>
              </div>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent className="max-w-md holo-context-menu border-0 p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-destructive/30 bg-gradient-to-r from-destructive/15 to-transparent">
            <div className="text-[10px] font-display uppercase tracking-widest text-destructive/80 mb-1">
              // PURGE · ENTITY
            </div>
            <DialogHeader className="space-y-0">
              <DialogTitle className="font-display uppercase tracking-wider text-base text-destructive text-glow">
                Ban {member.nickname || member.display_name}?
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-5 py-4 space-y-2">
            <label className="text-[10px] font-display uppercase tracking-widest text-primary/70">
              // REASON · LOG
            </label>
            <Textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Např. porušování pravidel…"
              rows={3}
              className="bg-background/60 border-primary/25 font-mono text-sm focus-visible:ring-destructive/40"
            />
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button
              variant="ghost"
              onClick={() => setBanOpen(false)}
              className="font-display uppercase tracking-widest text-xs"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={doBan}
              disabled={busy}
              className="font-display uppercase tracking-widest text-xs"
            >
              <Ban className="w-4 h-4 mr-1.5" /> Execute ban
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
