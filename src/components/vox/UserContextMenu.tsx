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
        <ContextMenuContent className="w-64 bg-[hsl(222_35%_7%)] border-border/60">
          <ContextMenuLabel className="truncate">
            {member.nickname || member.display_name || member.user_id.slice(0, 8)}
          </ContextMenuLabel>
          <ContextMenuSeparator />

          {!isSelf && (
            <ContextMenuItem onSelect={() => onMessage?.(member)}>
              <MessageCircle className="w-4 h-4 mr-2" /> Poslat zprávu
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => onViewProfile(member)}>
            <User className="w-4 h-4 mr-2" /> Zobrazit profil
          </ContextMenuItem>

          {!isSelf && (
            <>
              <ContextMenuSeparator />
              <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
                Lokální zvuk
              </ContextMenuLabel>
              <div className="px-2 py-1.5">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Volume2 className="w-3.5 h-3.5" /> Hlasitost
                  </span>
                  <span className="font-mono">{vol}%</span>
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
                <VolumeX className="w-4 h-4 mr-2" /> Ztlumit lokálně
              </ContextMenuCheckboxItem>
            </>
          )}

          {canModerate && !isSelf && (
            <>
              <ContextMenuSeparator />
              <ContextMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal flex items-center gap-1">
                <Shield className="w-3 h-3" /> Moderace
              </ContextMenuLabel>

              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <MicOff className="w-4 h-4 mr-2" /> Umlčet na serveru
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  <ContextMenuItem onSelect={() => doServerMute(5)}>5 minut</ContextMenuItem>
                  <ContextMenuItem onSelect={() => doServerMute(30)}>30 minut</ContextMenuItem>
                  <ContextMenuItem onSelect={() => doServerMute(60)}>1 hodina</ContextMenuItem>
                  <ContextMenuItem onSelect={() => doServerMute(60 * 24)}>1 den</ContextMenuItem>
                  <ContextMenuItem onSelect={() => doServerMute(0)}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Zrušit umlčení
                  </ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuSub>

              {assignableRoles.length > 0 && (
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Tag className="w-4 h-4 mr-2" /> Přiřadit role
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="max-h-80 overflow-y-auto">
                    {assignableRoles.map((r) => (
                      <ContextMenuCheckboxItem
                        key={r.id}
                        checked={assignedIds.has(r.id)}
                        onCheckedChange={(c) => toggleRole(r, !!c)}
                      >
                        <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ background: r.color }} />
                        {r.name}
                      </ContextMenuCheckboxItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              )}

              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={doKick}
                disabled={busy || member.role === "owner"}
              >
                <UserX className="w-4 h-4 mr-2" /> Vyhodit ze serveru
              </ContextMenuItem>
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setBanOpen(true)}
                disabled={busy || member.role === "owner"}
              >
                <Ban className="w-4 h-4 mr-2" /> Zabanovat…
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Zabanovat {member.nickname || member.display_name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Důvod (volitelné)</label>
            <Textarea
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Např. porušování pravidel…"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBanOpen(false)}>Zrušit</Button>
            <Button variant="destructive" onClick={doBan} disabled={busy}>
              <Ban className="w-4 h-4 mr-1.5" /> Zabanovat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
