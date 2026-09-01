import { useState } from "react";
import { Hash, Volume2, ChevronDown, ChevronRight, Plus, Copy, Check, Settings, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ChannelContextMenu } from "@/components/vox/ChannelContextMenu";
import { CategoryContextMenu } from "@/components/vox/CategoryContextMenu";
import { ChannelSettingsDialog } from "@/components/vox/ChannelSettingsDialog";
import { CategorySettingsDialog } from "@/components/vox/CategorySettingsDialog";

export interface VoxChannel {
  id: string;
  guild_id: string;
  name: string;
  type: "text" | "voice";
  category: string | null;
  position: number;
  emoji?: string | null;
  topic?: string | null;
}

interface Props {
  guildId?: string | null;
  guildName: string;
  inviteCode: string | null;
  channels: VoxChannel[];
  /** category name -> emoji */
  categoryEmojis?: Record<string, string | null>;
  activeId: string | null;
  onSelect: (ch: VoxChannel) => void;
  onCreateChannel: (type: "text" | "voice", category?: string | null) => void;
  isAdmin: boolean;
  voiceParticipants: Record<string, Array<{ user_id: string; nickname?: string; is_muted?: boolean }>>;
  onOpenServerSettings?: () => void;
  onCategoriesChanged?: () => void;
}

const catLabel = (cat: string) => (cat || "SEKCE").toUpperCase();

export function ChannelSidebar({
  guildId = null, guildName, inviteCode, channels, categoryEmojis = {}, activeId, onSelect,
  onCreateChannel, isAdmin, voiceParticipants, onOpenServerSettings, onCategoriesChanged,
}: Props) {
  const [collapsedCats, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [editChannel, setEditChannel] = useState<VoxChannel | null>(null);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const grouped = channels.reduce<Record<string, VoxChannel[]>>((acc, c) => {
    const cat = c.category || (c.type === "voice" ? "Hlasové kanály" : "Textové kanály");
    (acc[cat] ||= []).push(c);
    return acc;
  }, {});
  const categoryNames = Object.keys(grouped);

  const openCategoryDialog = (cat: string | null) => {
    setEditCategory(cat);
    setCategoryDialogOpen(true);
  };

  const copyInvite = () => {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast({ title: "Zkopírováno", description: "Pozvánkový kód je ve schránce." });
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-64 h-full flex flex-col bg-transparent">
      {/* Blueprint header: SEKTORY KOMUNITY */}
      <div className="px-4 pt-4 pb-3 border-b border-primary/15">

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
        <div className="mt-3 flex items-center justify-between gap-2 sector-node border-primary/25 bg-black/40 px-3 py-2.5">
          <span className="truncate text-sm font-display font-semibold text-foreground text-glow">
            {guildName}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <button
                onClick={() => onCreateChannel("text")}
                className="w-6 h-6 border border-primary/30 text-primary/80 hover:text-primary hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                title="Nový node"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
            {onOpenServerSettings && (
              <button
                onClick={onOpenServerSettings}
                className="w-6 h-6 border border-primary/30 text-primary/80 hover:text-primary hover:border-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                title="Nastavení sektoru"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="hud-scrollbar transform-gpu will-change-transform flex-1 overflow-y-auto p-3 space-y-5">
        {Object.entries(grouped).map(([cat, chans]) => {
          const collapsed = collapsedCats[cat];
          const type = chans[0]?.type ?? "text";
          const catEmoji = categoryEmojis[cat] ?? null;
          return (
            <div key={cat} className="space-y-1">
              <CategoryContextMenu
                category={cat}
                canManage={isAdmin}
                onEdit={() => openCategoryDialog(cat)}
                onCreateCategory={() => openCategoryDialog(null)}
                onCreateChannel={(t) => onCreateChannel(t, cat)}
              >
                <div className="flex items-center justify-between px-1.5 py-1.5 mb-1 text-[10px] font-display uppercase tracking-[0.22em] text-primary/60 group">
                  <button className="flex items-center gap-1.5 min-w-0 hover:text-primary" onClick={() => setCollapsed(s => ({ ...s, [cat]: !collapsed }))}>
                    {collapsed ? <ChevronRight className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
                    {catEmoji && <span className="text-[12px] leading-none">{catEmoji}</span>}
                    <span className="truncate">{catLabel(cat)}</span>
                  </button>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100">
                      <button className="hover:text-primary" onClick={() => openCategoryDialog(cat)} title="Upravit sekci">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button className="hover:text-primary" onClick={() => onCreateChannel(type, cat)} title="Přidat node">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </CategoryContextMenu>
              {!collapsed && chans.map((c) => {
                const active = c.id === activeId;
                const vp = voiceParticipants[c.id] ?? [];
                const hasSpeaker = vp.length > 0;
                return (
                  <div key={c.id}>
                    <ChannelContextMenu
                      channel={c}
                      canManage={isAdmin}
                      onCreateChannel={(t) => onCreateChannel(t, c.category)}
                      onOpenSettings={(ch) => setEditChannel(ch)}
                    >
                      <div
                        className={cn(
                          "sector-node group/node w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors font-display tracking-wide cursor-pointer",
                          active
                            ? "active text-foreground bg-primary/20 border border-primary [clip-path:polygon(8px_0,100%_0,100%_calc(100%-8px),calc(100%-8px)_100%,0_100%,0_8px)]"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => onSelect(c)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === "Enter") onSelect(c); }}
                      >
                        {c.emoji
                          ? <span className="text-[15px] leading-none shrink-0">{c.emoji}</span>
                          : c.type === "text"
                            ? <Hash className={cn("w-4 h-4 shrink-0", active && "text-primary")} />
                            : <Volume2 className={cn("w-4 h-4 shrink-0", active && "text-primary")} />}
                        <span className="truncate uppercase text-[13px]">{c.name}</span>
                        <span className="ml-auto flex items-center gap-1.5 shrink-0">
                          {isAdmin && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditChannel(c); }}
                              className="opacity-0 group-hover/node:opacity-100 text-primary/70 hover:text-primary transition-opacity"
                              title="Upravit node"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          {c.type === "voice" && hasSpeaker && (
                            <span className="holo-eq"><span/><span/><span/><span/></span>
                          )}
                          {active && !hasSpeaker && (
                            <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
                          )}
                        </span>
                      </div>
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

        {isAdmin && (
          <button
            onClick={() => openCategoryDialog(null)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[9px] font-display uppercase tracking-[0.26em] text-primary/60 border border-dashed border-primary/25 hover:text-primary hover:border-primary/60 transition-colors"
          >
            <Plus className="w-3 h-3" /> Nová sekce
          </button>
        )}
      </div>

      {/* Blueprint: NET LINK status strip */}
      <div className="px-3 py-1.5 border-t border-primary/15 flex items-center justify-between text-[9px] font-display tracking-[0.28em] uppercase text-primary/70">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_hsl(160_84%_45%)] animate-pulse" />
          Net link
        </span>
        <span className="text-muted-foreground">● Sync</span>
      </div>

      <ChannelSettingsDialog
        channel={editChannel}
        categories={categoryNames}
        open={!!editChannel}
        onOpenChange={(v) => { if (!v) setEditChannel(null); }}
      />
      <CategorySettingsDialog
        guildId={guildId}
        category={editCategory}
        emoji={editCategory ? categoryEmojis[editCategory] ?? null : null}
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onSaved={onCategoriesChanged}
      />
    </div>
  );
}
