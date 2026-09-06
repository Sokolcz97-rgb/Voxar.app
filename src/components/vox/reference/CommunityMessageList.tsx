import { memo, useMemo, useState, type RefObject } from "react";
import { FileDown, Lock, Pin, PinOff, SmilePlus, Trash2 } from "lucide-react";
import { useCosmeticRing } from "@/hooks/useCosmeticRing";
import { cn } from "@/lib/utils";
import { isEncrypted } from "@/lib/e2ee";
import { RoleBadge } from "../VoxRolesPanel";
import type { VoxMember } from "../MemberList";
import type { CommunityAttachment, CommunityMessage, CommunityProfileLite } from "./chatTypes";

export type CommunityReaction = {
  message_id: string;
  user_id: string;
  emoji: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentList({ items }: { items: CommunityAttachment[] }) {
  return (
    <div className="sv-message-attachments">
      {items.map((attachment, index) =>
        attachment.kind === "image" ? (
          <a key={index} href={attachment.url} target="_blank" rel="noreferrer" className="sv-message-image-link">
            <img decoding="async" src={attachment.url} alt={attachment.name} loading="lazy" className="sv-message-image" />
          </a>
        ) : attachment.kind === "video" ? (
          <video key={index} src={attachment.url} controls className="sv-message-video" />
        ) : (
          <a key={index} href={attachment.url} target="_blank" rel="noreferrer" download={attachment.name} className="sv-message-file">
            <FileDown />
            <span>{attachment.name}</span>
            <small>{formatSize(attachment.size)}</small>
          </a>
        ),
      )}
    </div>
  );
}

interface RowProps {
  message: CommunityMessage;
  compact: boolean;
  name: string;
  ringColor: string;
  topRole: any;
  avatarUrl: string | null;
  mine: boolean;
  canPin: boolean;
  pinned: boolean;
  reactions: CommunityReaction[];
  userId?: string;
  decrypted: string | null | undefined;
  onDelete: (id: string) => void;
  onNeedKey: () => void;
  onTogglePin: (message: CommunityMessage, pinned: boolean) => void | Promise<void>;
  onToggleReaction: (messageId: string, emoji: string, active: boolean) => void | Promise<void>;
}

const QUICK_REACTIONS = ["👍", "🔥", "❤️", "😂", "🎮", "🚀"];

const CommunityMessageRow = memo(function CommunityMessageRow({
  message,
  compact,
  name,
  ringColor,
  topRole,
  avatarUrl,
  mine,
  canPin,
  pinned,
  reactions,
  userId,
  decrypted,
  onDelete,
  onNeedKey,
  onTogglePin,
  onToggleReaction,
}: RowProps) {
  const cosmeticRing = useCosmeticRing(message.author_id);
  const renderedContent = isEncrypted(message.content) ? decrypted : message.content;
  const [reactionOpen, setReactionOpen] = useState(false);
  const pollLines = renderedContent?.includes("📊 ANKETA: ") ? renderedContent.slice(renderedContent.indexOf("📊 ANKETA: ")).split("\n") : [];
  const pollOptions = pollLines.slice(1).map(line => {
    const split = line.indexOf(" ");
    return { emoji: line.slice(0, split), label: line.slice(split + 1) };
  }).filter(option => ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣"].includes(option.emoji));
  const reactionSummary = useMemo(() => {
    const grouped = new Map<string, { count: number; mine: boolean }>();
    reactions.forEach((reaction) => {
      const current = grouped.get(reaction.emoji) ?? { count: 0, mine: false };
      current.count += 1;
      current.mine = current.mine || reaction.user_id === userId;
      grouped.set(reaction.emoji, current);
    });
    return [...grouped.entries()];
  }, [reactions, userId]);

  return (
    <article className={cn("sv-message group", compact && "compact", pinned && "is-pinned")}>
      <div className="sv-message-avatar-column">
        {!compact && (
          <div className={cn("rank-ring sv-message-avatar", cosmeticRing)} style={{ ["--rank-color" as any]: ringColor }}>
            <div className="rank-inner sv-message-avatar-inner">
              {avatarUrl ? <img loading="lazy" decoding="async" src={avatarUrl} alt={name} /> : name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        )}
      </div>

      <div className="sv-message-body">
        {!compact && (
          <div className="sv-message-meta">
            <strong style={{ color: ringColor, textShadow: `0 0 8px ${ringColor}55` }}>{name}</strong>
            {topRole && <RoleBadge role={topRole} />}
            <time>{new Date(message.created_at).toLocaleTimeString("cs", { hour: "2-digit", minute: "2-digit" })}</time>
            {pinned && <span className="sv-message-pinned-label"><Pin /> Připnuto</span>}
          </div>
        )}

        {isEncrypted(message.content) && !decrypted ? (
          <button type="button" className="sv-message-encrypted" onClick={onNeedKey}>
            <Lock /> Zašifrovaná zpráva — zadej klíč kanálu
          </button>
        ) : renderedContent ? (
          <div className="sv-message-text">
            {isEncrypted(message.content) && <Lock className="sv-message-lock" />}
            <span>{renderedContent}</span>
          </div>
        ) : null}

        {pollOptions.length >= 2 && <div className="sv-poll-options" aria-label="Hlasovat v anketě (více odpovědí)">
          {pollOptions.map(option => {
            const votes = reactions.filter(r => r.emoji === option.emoji);
            const active = votes.some(r => r.user_id === userId);
            return <button key={option.emoji} type="button" aria-pressed={active} className={active ? "active" : ""} onClick={() => void onToggleReaction(message.id, option.emoji, active)}>{option.label}<span>{votes.length} hlasů</span></button>;
          })}
        </div>}

        {Array.isArray(message.attachments) && message.attachments.length > 0 && <AttachmentList items={message.attachments} />}

        {reactionSummary.length > 0 && (
          <div className="sv-message-reactions" aria-label="Reakce">
            {reactionSummary.map(([emoji, summary]) => (
              <button
                key={emoji}
                type="button"
                className={summary.mine ? "active" : undefined}
                onClick={() => void onToggleReaction(message.id, emoji, summary.mine)}
                title={summary.mine ? `Odebrat reakci ${emoji}` : `Reagovat ${emoji}`}
              >
                <span>{emoji}</span><b>{summary.count}</b>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sv-message-actions">
        <div className="sv-message-reaction-picker-wrap">
          <button type="button" className="sv-message-action" onClick={() => setReactionOpen((value) => !value)} title="Přidat reakci">
            <SmilePlus />
          </button>
          {reactionOpen && (
            <div className="sv-message-reaction-picker">
              {QUICK_REACTIONS.map((emoji) => {
                const active = reactions.some((reaction) => reaction.emoji === emoji && reaction.user_id === userId);
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={active ? "active" : undefined}
                    onClick={() => {
                      void onToggleReaction(message.id, emoji, active);
                      setReactionOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {canPin && (
          <button
            type="button"
            className={cn("sv-message-action", pinned && "active")}
            onClick={() => void onTogglePin(message, pinned)}
            title={pinned ? "Odepnout zprávu" : "Připnout zprávu"}
          >
            {pinned ? <PinOff /> : <Pin />}
          </button>
        )}

        {mine && (
          <button type="button" className="sv-message-delete" onClick={() => onDelete(message.id)} title="Smazat zprávu">
            <Trash2 />
          </button>
        )}
      </div>
    </article>
  );
});

interface Props {
  messages: CommunityMessage[];
  profiles: Record<string, CommunityProfileLite>;
  members: VoxMember[];
  userId?: string;
  decrypted: Record<string, string | null>;
  reactions: CommunityReaction[];
  pinnedMessageIds: Set<string>;
  canManageMessages: boolean;
  onDelete: (id: string) => void;
  onNeedKey: () => void;
  onTogglePin: (message: CommunityMessage, pinned: boolean) => void | Promise<void>;
  onToggleReaction: (messageId: string, emoji: string, active: boolean) => void | Promise<void>;
  bottomRef: RefObject<HTMLDivElement>;
  channelName: string;
}

export function CommunityMessageList({
  messages,
  profiles,
  members,
  userId,
  decrypted,
  reactions,
  pinnedMessageIds,
  canManageMessages,
  onDelete,
  onNeedKey,
  onTogglePin,
  onToggleReaction,
  bottomRef,
  channelName,
}: Props) {
  return (
    <section className="sv-message-list hud-scrollbar" aria-label={`Zprávy v kanálu ${channelName}`}>
      {messages.length === 0 && (
        <div className="sv-message-empty">
          <strong>Začátek kanálu</strong>
          <span>Vítej v <b>#{channelName}</b>. Buď první, kdo sem napíše.</span>
        </div>
      )}

      {messages.map((message, index) => {
        const profile = profiles[message.author_id];
        const previous = messages[index - 1];
        const compact = !!previous
          && previous.author_id === message.author_id
          && (new Date(message.created_at).getTime() - new Date(previous.created_at).getTime()) < 5 * 60_000;
        const member = members.find((item) => item.user_id === message.author_id);
        const topRole = member?.roles?.[0] ?? null;
        const name = member?.nickname || profile?.display_name || message.author_id.slice(0, 8);
        const mine = message.author_id === userId;

        return (
          <CommunityMessageRow
            key={message.id}
            message={message}
            compact={compact}
            name={name}
            ringColor={topRole?.color || "hsl(var(--primary))"}
            topRole={topRole}
            avatarUrl={profile?.avatar_url ?? null}
            mine={mine}
            canPin={mine || canManageMessages}
            pinned={pinnedMessageIds.has(message.id)}
            reactions={reactions.filter((reaction) => reaction.message_id === message.id)}
            userId={userId}
            decrypted={decrypted[message.id]}
            onDelete={onDelete}
            onNeedKey={onNeedKey}
            onTogglePin={onTogglePin}
            onToggleReaction={onToggleReaction}
          />
        );
      })}

      <div ref={bottomRef} />
    </section>
  );
}
