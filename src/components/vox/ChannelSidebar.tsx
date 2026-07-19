import { useState } from "react";
import { Hash, Volume2, ChevronDown, ChevronRight, Plus, Copy, Check, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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
}

export function ChannelSidebar({
  guildName, inviteCode, channels, activeId, onSelect, onCreateChannel, isAdmin, voiceParticipants,
}: Props) {
  const [collapsedCats, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  const grouped = channels.reduce<Record<string, VoxChannel[]>>((acc, c) => {
    const cat = c.category || "Kanály";
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
    <div className="w-60 h-full flex flex-col bg-[hsl(222_35%_5%)] border-r border-border/40">
      <div className="h-12 px-4 flex items-center justify-between border-b border-border/50 shadow-sm">
        <span className="font-semibold text-sm truncate">{guildName}</span>
        {inviteCode && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={copyInvite} title="Kopírovat pozvánkový kód">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {Object.entries(grouped).map(([cat, chans]) => {
          const collapsed = collapsedCats[cat];
          return (
            <div key={cat}>
              <div className="flex items-center justify-between px-1 py-1 text-[11px] uppercase tracking-wider text-muted-foreground group">
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setCollapsed(s => ({ ...s, [cat]: !collapsed }))}>
                  {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {cat}
                </button>
                {isAdmin && (
                  <button
                    className="opacity-0 group-hover:opacity-100 hover:text-foreground"
                    onClick={() => onCreateChannel(chans[0]?.type ?? "text")}
                    title="Přidat kanál"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {!collapsed && chans.map((c) => {
                const active = c.id === activeId;
                const vp = voiceParticipants[c.id] ?? [];
                return (
                  <div key={c.id}>
                    <button
                      onClick={() => onSelect(c)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
                        active
                          ? "bg-primary/15 text-foreground"
                          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                      )}
                    >
                      {c.type === "text"
                        ? <Hash className="w-4 h-4 shrink-0" />
                        : <Volume2 className="w-4 h-4 shrink-0" />}
                      <span className="truncate">{c.name}</span>
                    </button>
                    {c.type === "voice" && vp.length > 0 && (
                      <ul className="ml-6 mt-0.5 mb-1 space-y-0.5">
                        {vp.map((p) => (
                          <li key={p.user_id} className="text-xs text-muted-foreground flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-secondary/40">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span className="truncate">{p.nickname || p.user_id.slice(0,6)}</span>
                            {p.is_muted && <span className="ml-auto opacity-60">🎙️✕</span>}
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
    </div>
  );
}
