import { memo, type RefObject } from "react";
import { FileDown, Lock, Trash2 } from "lucide-react";
import { useCosmeticRing } from "@/hooks/useCosmeticRing";
import { cn } from "@/lib/utils";
import { isEncrypted } from "@/lib/e2ee";
import { RoleBadge } from "../VoxRolesPanel";
import type { VoxMember } from "../MemberList";
import type { CommunityAttachment, CommunityMessage, CommunityProfileLite } from "./chatTypes";

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
            <img
              decoding="async"
              src={attachment.url}
              alt={attachment.name}
              loading="lazy"
              className="sv-message-image"
            />
          </a>
        ) : attachment.kind === "video" ? (
          <video key={index} src={attachment.url} controls className="sv-message-video" />
        ) : (
          <a
            key={index}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            download={attachment.name}
            className="sv-message-file"
          >
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
  decrypted: string | null | undefined;
  onDelete: (id: string) => void;
  onNeedKey: () => void;
}

const CommunityMessageRow = memo(function CommunityMessageRow({
  message,
  compact,
  name,
  ringColor,
  topRole,
  avatarUrl,
  mine,
  decrypted,
  onDelete,
  onNeedKey,
}: RowProps) {
  const cosmeticRing = useCosmeticRing(message.author_id);
  const renderedContent = isEncrypted(message.content) ? decrypted : message.content;

  return (
    <article className={cn("sv-message group", compact && "compact")}>
      <div className="sv-message-avatar-column">
        {!compact && (
          <div
            className={cn("rank-ring sv-message-avatar", cosmeticRing)}
            style={{ ["--rank-color" as any]: ringColor }}
          >
            <div className="rank-inner sv-message-avatar-inner">
              {avatarUrl
                ? <img loading="lazy" decoding="async" src={avatarUrl} alt={name} />
                : name.slice(0, 2).toUpperCase()}
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

        {Array.isArray(message.attachments) && message.attachments.length > 0 && (
          <AttachmentList items={message.attachments} />
        )}
      </div>

      {mine && (
        <button
          type="button"
          className="sv-message-delete"
          onClick={() => onDelete(message.id)}
          title="Smazat zprávu"
        >
          <Trash2 />
        </button>
      )}
    </article>
  );
});

interface Props {
  messages: CommunityMessage[];
  profiles: Record<string, CommunityProfileLite>;
  members: VoxMember[];
  userId?: string;
  decrypted: Record<string, string | null>;
  onDelete: (id: string) => void;
  onNeedKey: () => void;
  bottomRef: RefObject<HTMLDivElement>;
  channelName: string;
}

export function CommunityMessageList({
  messages,
  profiles,
  members,
  userId,
  decrypted,
  onDelete,
  onNeedKey,
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

        return (
          <CommunityMessageRow
            key={message.id}
            message={message}
            compact={compact}
            name={name}
            ringColor={topRole?.color || "hsl(var(--primary))"}
            topRole={topRole}
            avatarUrl={profile?.avatar_url ?? null}
            mine={message.author_id === userId}
            decrypted={decrypted[message.id]}
            onDelete={onDelete}
            onNeedKey={onNeedKey}
          />
        );
      })}

      <div ref={bottomRef} />
    </section>
  );
}
