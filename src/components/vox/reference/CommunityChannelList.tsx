import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Hash,
  Pencil,
  Plus,
  Settings,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { VoxChannel } from "../ChannelSidebar";
import { ChannelSettingsDialog } from "../ChannelSettingsDialog";
import { CategorySettingsDialog } from "../CategorySettingsDialog";

interface Props {
  guildId: string;
  inviteCode: string | null;
  channels: VoxChannel[];
  categoryEmojis: Record<string, string | null>;
  activeId: string | null;
  onSelect: (channel: VoxChannel) => void;
  onCreateChannel: (type: "text" | "voice", category?: string | null) => void;
  isAdmin: boolean;
  voiceParticipants: Record<string, Array<{ user_id: string; nickname?: string; is_muted?: boolean }>>;
  onOpenServerSettings: () => void;
  onCategoriesChanged: () => void;
}

export function CommunityChannelList({
  guildId,
  inviteCode,
  channels,
  categoryEmojis,
  activeId,
  onSelect,
  onCreateChannel,
  isAdmin,
  voiceParticipants,
  onOpenServerSettings,
  onCategoriesChanged,
}: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [editChannel, setEditChannel] = useState<VoxChannel | null>(null);
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, VoxChannel[]>();

    [...channels]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .forEach((channel) => {
        const category = channel.category?.trim()
          || (channel.type === "voice" ? "Hlasové kanály" : "Textové kanály");
        const list = map.get(category) ?? [];
        list.push(channel);
        map.set(category, list);
      });

    return Array.from(map.entries());
  }, [channels]);

  const categoryNames = groups.map(([name]) => name);

  const copyInvite = async () => {
    if (!inviteCode) return;
    await navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    toast({ title: "Pozvánka zkopírována", description: "Kód komunity je ve schránce." });
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="sv-channel-list">
      <div className="sv-channel-list-tools">
        <span>Kanály komunity</span>
        <div>
          {inviteCode && (
            <button type="button" onClick={() => void copyInvite()} title="Kopírovat pozvánku">
              {copied ? <Check /> : <Copy />}
            </button>
          )}
          {isAdmin && (
            <button type="button" onClick={() => onCreateChannel("text")} title="Nový kanál">
              <Plus />
            </button>
          )}
          <button type="button" onClick={onOpenServerSettings} title="Nastavení komunity">
            <Settings />
          </button>
        </div>
      </div>

      <div className="sv-channel-list-scroll">
        {groups.length === 0 ? (
          <div className="sv-channel-list-empty">
            <span>Zatím tu nejsou žádné kanály.</span>
            {isAdmin && <button type="button" onClick={() => onCreateChannel("text")}>Vytvořit první kanál</button>}
          </div>
        ) : (
          groups.map(([category, items]) => {
            const isCollapsed = !!collapsed[category];
            const categoryEmoji = categoryEmojis[category] ?? null;
            const defaultType = items[0]?.type ?? "text";

            return (
              <section className="sv-channel-group" key={category}>
                <div className="sv-channel-group-head">
                  <button
                    type="button"
                    className="sv-channel-group-toggle"
                    onClick={() => setCollapsed((current) => ({ ...current, [category]: !isCollapsed }))}
                  >
                    {isCollapsed ? <ChevronRight /> : <ChevronDown />}
                    {categoryEmoji ? <span className="sv-channel-group-emoji">{categoryEmoji}</span> : null}
                    <span>{category}</span>
                  </button>

                  {isAdmin && (
                    <div className="sv-channel-group-actions">
                      <button
                        type="button"
                        title="Upravit sekci"
                        onClick={() => {
                          setEditCategory(category);
                          setCategoryDialogOpen(true);
                        }}
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        title="Přidat kanál"
                        onClick={() => onCreateChannel(defaultType, category)}
                      >
                        <Plus />
                      </button>
                    </div>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="sv-channel-group-items">
                    {items.map((channel) => {
                      const active = channel.id === activeId;
                      const participants = voiceParticipants[channel.id] ?? [];

                      return (
                        <div className="sv-channel-item-wrap" key={channel.id}>
                          <button
                            type="button"
                            className={cn("sv-channel-item", active && "active")}
                            onClick={() => onSelect(channel)}
                          >
                            <span className="sv-channel-item-icon">
                              {channel.emoji
                                ? channel.emoji
                                : channel.type === "voice"
                                  ? <Volume2 />
                                  : <Hash />}
                            </span>
                            <span className="sv-channel-item-name">{channel.name}</span>

                            {channel.type === "voice" && participants.length > 0 && (
                              <span className="sv-channel-voice-count">{participants.length}</span>
                            )}
                            {active && <span className="sv-channel-active-dot" />}
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              className="sv-channel-edit"
                              title="Nastavení kanálu"
                              onClick={() => setEditChannel(channel)}
                            >
                              <Pencil />
                            </button>
                          )}

                          {channel.type === "voice" && participants.length > 0 && (
                            <div className="sv-channel-voice-users">
                              {participants.map((participant) => (
                                <div key={participant.user_id} className={participant.is_muted ? "muted" : ""}>
                                  <span className="sv-channel-voice-status" />
                                  <span>{participant.nickname || participant.user_id.slice(0, 6)}</span>
                                  {participant.is_muted && <small>MUTE</small>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })
        )}

        {isAdmin && (
          <button
            type="button"
            className="sv-channel-new-section"
            onClick={() => {
              setEditCategory(null);
              setCategoryDialogOpen(true);
            }}
          >
            <Plus />
            <span>Nová sekce</span>
          </button>
        )}
      </div>

      <ChannelSettingsDialog
        channel={editChannel}
        categories={categoryNames}
        open={!!editChannel}
        onOpenChange={(open) => { if (!open) setEditChannel(null); }}
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
