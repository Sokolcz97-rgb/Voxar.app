import { useState } from "react";
import { Hash, Volume2, ChevronDown, ChevronRight, Plus, Copy, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ChannelContextMenu } from "@/components/vox/ChannelContextMenu";

export interface VoxChannel {
  id: string;
  guild_id: string;
  name: string;
  type: "text" | "voice";
  category: string | null;
  position: number;
}

interface Props {
  guildName: string;
  inviteCode: string | null;
  channels: VoxChannel[];
  activeId: string | null;
  onSelect: (ch: VoxChannel) => void;
  onCreateChannel: (type: "text" | "voice") => void;
  isAdmin: boolean;
  voiceParticipants: Record<string, Array<{ user_id: string; nickname?: string; is_muted?: boolean }>>;
  onOpenServerSettings?: () => void;
}

const catLabel = (cat: string, type: "text" | "voice") => {
  const c = (cat || "").toLowerCase();
  if (type === "voice" || c.includes("hlas") || c.includes("voice")) return "HLASOVÁ SEKCE";
  if (c.includes("text")) return "TEXTOVÁ SEKCE";
  return (cat || "SEKCE").toUpperCase();
};

export function ChannelSidebar({
  guildName, inviteCode, channels, activeId, onSelect, onCreateChannel, isAdmin, voiceParticipants, onOpenServerSettings,
}: Props) {
  const [collapsedCats, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const grouped = channels.reduce<Record<string, VoxChannel[]>>((acc, c) => {
    const cat = c.category || (c.type === "voice" ? "Hlasová sekce" : "Textová sekce");
    (acc[cat] ||= []).push(c);
    return acc;
  }, {});

  const copyInvite = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast({ title: "Zkopírováno", description: "Pozvánkový kód je ve schránce." });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-60 h-full flex flex-col bg-transparent">
      {/* Blueprint header: SEKTORY KOMUNITY */}
      <div className="px-3 pt-3 pb-2 border-b border-primary/15">
        <div className="flex items-center justify-between">
          <div className="font-display text-[11px] tracking-[0.28em] text-primary/80 text-glow uppercase">
            Sektory komunity
          </div>
          {inviteCode && (
            <button
              onClick={copyInvite}
              className="text-primary/70 hover:text-primary transition-colors"
              title="Kopírovat pozvánku"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-primary/25 bg-primary/5 px-2.5 py-1.5">
          <span className="truncate text-sm font-display font-semibold text-foreground text-glow">
            {guildName}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <button
                onClick={() => onCreateChannel("text")}
                className="w-6 h-6 rounded-md border border-primary/30 text-primary/80 hover:text-primary hover:border-primary hover:shadow-[0_0_8px_hsl(var(--primary)/0.5)] flex items-center justify-center transition-all"
                title="Nový node"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenServerSettings && (
              <button
                onClick={onOpenServerSettings}
                className="w-6 h-6 rounded-md border border-primary/30 text-primary/80 hover:text-primary hover:border-primary hover:shadow-[0_0_8px_hsl(var(--primary)/0.5)] flex items-center justify-center transition-all"
                title="Nastavení sektoru"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {Object.entries(grouped).map(([cat, chans]) => {
          const collapsed = collapsedCats[cat];
          const type = chans[0]?.type ?? "text";
          return (
            <div key={cat}>
              <div className="flex items-center justify-between px-1 py-1 text-[10px] font-display uppercase tracking-[0.22em] text-primary/60 group">
                <button className="flex items-center gap-1 hover:text-primary" onClick={() => setCollapsed(s => ({ ...s, [cat]: !collapsed }))}>
                  {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {catLabel(cat, type)}
                </button>
                {isAdmin && (
                  <button
                    className="opacity-0 group-hover:opacity-100 hover:text-primary"
                    onClick={() => onCreateChannel(type)}
                    title="Přidat node"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {!collapsed && chans.map((c) => {
                const active = c.id === activeId;
                const vp = voiceParticipants[c.id] ?? [];
                const hasSpeaker = vp.length > 0;
                return (
                  <div key={c.id}>
                    <ChannelContextMenu
                      channel={c}
                      canManage={isAdmin}
                      onCreateChannel={onCreateChannel}
                      onOpenSettings={() => onOpenServerSettings?.()}
                    >
                      <button
                        onClick={() => onSelect(c)}
                        className={cn(
                          "sector-node w-full flex items-center gap-2 px-2.5 py-2 text-sm transition-colors font-display tracking-wide",
                          active
                            ? "active text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {c.type === "text"
                          ? <Hash className={cn("w-4 h-4 shrink-0", active && "text-primary")} />
                          : <Volume2 className={cn("w-4 h-4 shrink-0", active && "text-primary")} />}
                        <span className="truncate uppercase text-[13px]">{c.name}</span>
                        {c.type === "voice" && hasSpeaker && (
                          <span className="ml-auto holo-eq"><span/><span/><span/><span/></span>
                        )}
                        {active && !hasSpeaker && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                        )}
                      </button>
                    </ChannelContextMenu>
                    {c.type === "voice" && vp.length > 0 && (
                      <ul className="ml-4 mt-1 mb-1.5 space-y-0.5 border-l border-primary/25 pl-3">
                        {vp.map((p) => (
                          <li
                            key={p.user_id}
                            className="relative text-[11px] font-display tracking-wide text-muted-foreground flex items-center gap-2 px-1.5 py-0.5 hover:text-foreground hover:bg-primary/5 transition-colors"
                          >
                            <span className="absolute -left-3 top-1/2 w-2.5 h-px bg-primary/25" />
                            <span className={cn(
                              "w-1.5 h-1.5 rotate-45 shrink-0",
                              p.is_muted
                                ? "bg-destructive shadow-[0_0_6px_hsl(var(--destructive))]"
                                : "bg-emerald-400 shadow-[0_0_6px_hsl(160_84%_45%)]"
                            )} />
                            <span className="truncate">{p.nickname || p.user_id.slice(0,6)}</span>
                            {p.is_muted && <span className="ml-auto text-[9px] tracking-[0.2em] text-destructive/80">MUTE</span>}
                          </li>
                        ))}
                      </ul>
                    )}

                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Blueprint: NET LINK status strip */}
      <div className="px-3 py-1.5 border-t border-primary/15 flex items-center justify-between text-[9px] font-display tracking-[0.28em] uppercase text-primary/70">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_hsl(160_84%_45%)] animate-pulse" />
          Net link
        </span>
        <span className="text-muted-foreground">● Sync</span>
      </div>
    </div>
  );
}
