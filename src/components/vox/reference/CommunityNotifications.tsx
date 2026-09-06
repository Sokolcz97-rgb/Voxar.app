import { useMemo, useState, type MouseEvent } from "react";
import { Bell, BellRing, CalendarDays, CheckCheck, CircleAlert, Loader2, Megaphone, Radio, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useVoxNotifications, type VoxNotification } from "@/hooks/useVoxNotifications";
import { openVoxChannel, openVoxUtility } from "@/lib/voxCommunityBridge";

type Filter = "all" | "unread";

function relativeTime(value: string) {
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60_000) return "právě teď";
  if (delta < 3_600_000) return `před ${Math.max(1, Math.floor(delta / 60_000))} min`;
  if (delta < 86_400_000) return `před ${Math.floor(delta / 3_600_000)} h`;
  return new Date(value).toLocaleString("cs-CZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function NotificationGlyph({ item }: { item: VoxNotification }) {
  if (item.type.startsWith("event_")) return <CalendarDays />;
  if (item.type.includes("stream") || item.type.includes("live")) return <Radio />;
  if (item.type.includes("warning")) return <CircleAlert />;
  if (item.type.includes("announcement")) return <Megaphone />;
  return <Bell />;
}

export function CommunityNotifications() {
  const { notifications, unreadCount, loading, error, refresh, markRead, markAllRead, remove } = useVoxNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => filter === "unread" ? notifications.filter((item) => !item.is_read) : notifications,
    [notifications, filter],
  );

  const openItem = async (item: VoxNotification) => {
    try {
      if (!item.is_read) await markRead(item.id, true);
    } catch {}

    const channelId = typeof item.data?.channel_id === "string" ? item.data.channel_id : null;
    const eventId = typeof item.data?.event_id === "string" ? item.data.event_id : null;

    if (eventId || item.type.startsWith("event_")) {
      openVoxUtility("events");
      return;
    }
    if (channelId) {
      openVoxUtility(null);
      openVoxChannel(channelId);
    }
  };

  const markEverything = async () => {
    try {
      await markAllRead();
      toast({ title: "Oznámení označena jako přečtená" });
    } catch (err) {
      toast({ title: "Oznámení se nepodařilo změnit", description: (err as Error).message, variant: "destructive" });
    }
  };

  const removeItem = async (event: MouseEvent, id: string) => {
    event.stopPropagation();
    try {
      await remove(id);
    } catch (err) {
      toast({ title: "Oznámení se nepodařilo odstranit", description: (err as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="sv-feature-page sv-notifications-page">
      <div className="sv-feature-toolbar sv-notifications-toolbar">
        <div>
          <span className="sv-feature-kicker">SIGNAL CENTER // REALTIME</span>
          <h2>Oznámení</h2>
          <p>Události a důležité změny z komunit, které sleduješ.</p>
        </div>
        <div className="sv-notifications-heading-actions">
          <div className={`sv-notification-count${unreadCount ? " has-unread" : ""}`}>
            <BellRing />
            <span><strong>{unreadCount}</strong><small>nepřečtených</small></span>
          </div>
          {unreadCount > 0 && (
            <button type="button" className="sv-hud-button secondary" onClick={() => void markEverything()}>
              <CheckCheck /> Přečíst vše
            </button>
          )}
        </div>
      </div>

      <div className="sv-notification-controls" role="tablist" aria-label="Filtr oznámení">
        <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Všechna <b>{notifications.length}</b></button>
        <button type="button" role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>Nepřečtená <b>{unreadCount}</b></button>
      </div>

      {loading ? (
        <div className="sv-feature-loading"><Loader2 className="animate-spin" /> Načítám oznámení…</div>
      ) : error ? (
        <div className="sv-feature-empty sv-notifications-error">
          <Bell />
          <strong>Centrum oznámení zatím není dostupné</strong>
          <span>{error}</span>
          <button type="button" className="sv-hud-button secondary" onClick={() => void refresh()}><RefreshCw /> Načíst znovu</button>
        </div>
      ) : visible.length === 0 ? (
        <div className="sv-feature-empty"><BellRing /><strong>{filter === "unread" ? "Všechno přečteno" : "Žádná oznámení"}</strong><span>Nové události a důležité změny se objeví tady.</span></div>
      ) : (
        <div className="sv-notification-list">
          {visible.map((item) => (
            <article
              className={`sv-notification-row${item.is_read ? "" : " unread"}`}
              key={item.id}
              onClick={() => void openItem(item)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void openItem(item);
                }
              }}
            >
              <div className="sv-notification-icon"><NotificationGlyph item={item} /><i /></div>
              <div className="sv-notification-copy">
                <div className="sv-notification-title-row"><strong>{item.title}</strong>{!item.is_read && <span>NEW</span>}</div>
                {item.body && <p>{item.body}</p>}
                <small>{relativeTime(item.created_at)}</small>
              </div>
              <div className="sv-notification-actions">
                <button type="button" className="danger" title="Odstranit" aria-label={`Odstranit oznámení ${item.title}`} onClick={(event) => void removeItem(event, item.id)}><Trash2 /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
