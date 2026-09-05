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
import voxLogo from "@/assets/vox-logo.png.asset.json";

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
    <header className="sv-topbar">
      <div className="sv-topbar-brand">
        <img src={voxLogo.url} alt="Voxar.app" />
        <div>
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
      </div>
    </header>
  );
}
