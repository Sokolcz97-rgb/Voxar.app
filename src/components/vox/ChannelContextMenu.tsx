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
        <ContextMenuContent className="holo-context-menu w-56 text-foreground font-display tracking-wider uppercase text-xs">
          <ContextMenuLabel className="flex items-center gap-2 text-primary text-glow">
            {channel.type === "text" ? <Hash className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {channel.name}
          </ContextMenuLabel>
          <ContextMenuSeparator />
          {canManage && (
            <>
              <ContextMenuItem onSelect={() => onCreateChannel(channel.type)}>
                <Plus className="w-4 h-4 mr-2 text-primary" /> Create node
              </ContextMenuItem>
              <ContextMenuItem onSelect={duplicate}>
                <Copy className="w-4 h-4 mr-2 text-primary" /> Duplicate node
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onOpenSettings?.(channel)}>
                <Settings className="w-4 h-4 mr-2 text-primary" /> Node settings
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setConfirmOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete node
              </ContextMenuItem>
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
        <DialogContent className="max-w-sm holo-context-menu">
          <DialogHeader>
            <DialogTitle>Smazat node „{channel.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tato akce je nevratná. Všechny zprávy v kanálu zůstanou v archivu, ale kanál zmizí ze sektoru.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Zrušit</Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Smazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
