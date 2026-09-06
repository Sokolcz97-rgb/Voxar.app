import {
  AudioLines,
  Bell,
  CalendarDays,
  Folder,
  Home,
  MoreHorizontal,
  Search,
  ShoppingBag,
} from "lucide-react";

interface Props {
  displayName: string;
  avatarUrl?: string | null;
  onCommunity: () => void;
  onEvents: () => void;
  onVoice: () => void;
  onFiles: () => void;
  onStore: () => void;
  onMore: () => void;
  onNotifications: () => void;
  onProfile: () => void;
}

const navItems = [
  { key: "community", label: "Komunita", icon: Home },
  { key: "events", label: "Události", icon: CalendarDays },
  { key: "voice", label: "Hlas", icon: AudioLines },
  { key: "files", label: "Soubory", icon: Folder },
  { key: "store", label: "Obchod", icon: ShoppingBag },
  { key: "more", label: "Více", icon: MoreHorizontal },
] as const;

export function CommunityTopbar({
  displayName,
  avatarUrl,
  onCommunity,
  onEvents,
  onVoice,
  onFiles,
  onStore,
  onMore,
  onNotifications,
  onProfile,
}: Props) {
  const actions = {
    community: onCommunity,
    events: onEvents,
    voice: onVoice,
    files: onFiles,
    store: onStore,
    more: onMore,
  };

  return (
    <header className="sv-topbar sv-topbar-v17">
      <div className="sv-topbar-scene" aria-hidden="true">
        <span className="sv-topbar-horizon" />
        <span className="sv-topbar-planet"><i /><b /></span>
        <span className="sv-topbar-comet sv-topbar-comet-a" />
        <span className="sv-topbar-comet sv-topbar-comet-b" />
        <span className="sv-topbar-grid" />
      </div>

      <div className="sv-topbar-brand">
        <span className="sv-brand-symbol" aria-hidden="true">
          <i className="sv-brand-wing sv-brand-wing-left" />
          <i className="sv-brand-wing sv-brand-wing-right" />
          <b className="sv-brand-core" />
        </span>
        <div className="sv-brand-copy">
          <strong>VOXAR.APP</strong>
          <span>STUDIOVOXARIO</span>
        </div>
      </div>

      <nav className="sv-topbar-nav" aria-label="Hlavní navigace">
        {navItems.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={key === "community" ? "active" : undefined}
            onClick={actions[key]}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="sv-topbar-tools">
        <label className="sv-topbar-search">
          <Search />
          <input placeholder="Hledat v komunitě..." aria-label="Hledat v komunitě" />
          <kbd>Ctrl K</kbd>
        </label>

        <button
          type="button"
          className="sv-topbar-icon-button"
          onClick={onNotifications}
          aria-label="Oznámení"
        >
          <Bell />
          <i aria-hidden="true" />
        </button>

        <button
          type="button"
          className="sv-topbar-avatar"
          onClick={onProfile}
          title="Nastavení profilu"
          aria-label={`Profil ${displayName}`}
        >
          {avatarUrl
            ? <img src={avatarUrl} alt={displayName} />
            : <span>{displayName.slice(0, 2).toUpperCase()}</span>}
        </button>

        <div className="sv-topbar-motto" aria-hidden="true">
          <span>People</span>
          <span>Ideas</span>
          <span>Games</span>
          <span>Together</span>
        </div>
      </div>
    </header>
  );
}
