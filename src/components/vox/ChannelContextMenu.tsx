import { ReactNode, useState } from "react";
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem,
  ContextMenuSeparator, ContextMenuLabel,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Copy, Settings, Trash2, Hash, Volume2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { VoxChannel } from "@/components/vox/ChannelSidebar";

interface Props {
  channel: VoxChannel;
  canManage: boolean;
  onCreateChannel: (type: "text" | "voice") => void;
  onOpenSettings?: (ch: VoxChannel) => void;
  children: ReactNode;
}

export function ChannelContextMenu({ channel, canManage, onCreateChannel, onOpenSettings, children }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const duplicate = async () => {
    const { error } = await supabase.from("vox_channels").insert({
      guild_id: channel.guild_id,
      name: `${channel.name}-copy`.slice(0, 64),
      type: channel.type,
      category: channel.category,
      position: (channel.position ?? 0) + 1,
    });
    if (error) toast({ title: "Nelze duplikovat", description: error.message, variant: "destructive" });
    else toast({ title: "Node duplikován" });
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from("vox_channels").delete().eq("id", channel.id);
    setBusy(false);
    setConfirmOpen(false);
    if (error) toast({ title: "Nelze smazat", description: error.message, variant: "destructive" });
    else toast({ title: "Node smazán" });
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="holo-context-menu holo-ctx w-56 text-foreground font-display tracking-wider uppercase text-xs">
          <span className="ctx-brackets" aria-hidden />
          <div className="ctx-head">
            <div className="text-[8px] tracking-[0.3em] text-primary/60 mb-0.5">// NODE · {channel.type}</div>
            <div className="flex items-center gap-2 text-primary text-glow text-[13px] truncate">
              {channel.type === "text" ? <Hash className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {channel.name}
            </div>
          </div>
          {canManage && (
            <>
              <div className="ctx-section">// NODE · OPS</div>
              <ContextMenuItem onSelect={() => onCreateChannel(channel.type)}>
                <Plus className="w-4 h-4 mr-2 text-primary" /> Create node
              </ContextMenuItem>
              <ContextMenuItem onSelect={duplicate}>
                <Copy className="w-4 h-4 mr-2 text-primary" /> Duplicate node
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onOpenSettings?.(channel)}>
                <Settings className="w-4 h-4 mr-2 text-primary" /> Node settings
              </ContextMenuItem>
              <div className="ctx-danger">
                <div className="px-2 pb-1 text-[8px] tracking-[0.3em] text-destructive/80">// DANGER · ZONE</div>
                <ContextMenuItem onSelect={() => setConfirmOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Delete node
                </ContextMenuItem>
              </div>
            </>
          )}
          {!canManage && (
            <ContextMenuItem disabled className="text-muted-foreground">
              Bez oprávnění
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm holo-context-menu border-0 p-0 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-destructive/30 bg-gradient-to-r from-destructive/15 to-transparent">
            <div className="text-[10px] font-display uppercase tracking-widest text-destructive/80 mb-1">
              // PURGE · NODE
            </div>
            <DialogHeader className="space-y-0">
              <DialogTitle className="font-display uppercase tracking-wider text-base text-destructive text-glow">
                Delete „{channel.name}"
              </DialogTitle>
            </DialogHeader>
          </div>
          <p className="px-5 py-4 text-sm text-muted-foreground">
            Tato akce je nevratná. Všechny zprávy v kanálu zůstanou v archivu, ale kanál zmizí ze sektoru.
          </p>
          <DialogFooter className="px-5 pb-5">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} className="font-display uppercase tracking-widest text-xs">
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy} className="font-display uppercase tracking-widest text-xs">
              <Trash2 className="w-4 h-4 mr-1.5" /> Execute purge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
