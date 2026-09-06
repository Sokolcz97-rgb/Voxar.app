import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useEffect, useRef, useState } from "react";
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
import { CommunityUtilityOverlay, type UtilityMode } from "./CommunityUtilityOverlay";
import { CommunitySearchPopover } from "./CommunitySearchPopover";
import { subscribeVoxUtility } from "@/lib/voxCommunityBridge";
import { useVoxNotifications } from "@/hooks/useVoxNotifications";

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
  activeGuildId?: string | null;
  isGuildAdmin?: boolean;
  onOpenChannel?: (channelId: string) => void;
  utilityMode?: UtilityMode | null;
  onUtilityModeChange?: (mode: UtilityMode | null) => void;
}

const navItems = [
  { key: "community", label: "Komunita", icon: Home },
  { key: "events", label: "Události", icon: CalendarDays },
  { key: "voice", label: "Hlas", icon: AudioLines },
  { key: "files", label: "Soubory", icon: Folder },
  { key: "store", label: "Obchod", icon: ShoppingBag },
  { key: "more", label: "Více", icon: MoreHorizontal },
] as const;

type NavKey = (typeof navItems)[number]["key"];

export function CommunityTopbar({
  displayName,
  avatarUrl,
  onCommunity,
  onVoice,
  onMore,
  onProfile,
  activeGuildId,
  isGuildAdmin,
  onOpenChannel,
  utilityMode,
  onUtilityModeChange,
}: Props) {
  const [internalUtility, setInternalUtility] = useState<UtilityMode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { unreadCount } = useVoxNotifications(100);
  const controlled = utilityMode !== undefined;
  const utility = controlled ? utilityMode : internalUtility;

  const setUtility = (next: UtilityMode | null) => {
    if (!controlled) setInternalUtility(next);
    onUtilityModeChange?.(next);
  };

  useEffect(() => subscribeVoxUtility((mode) => {
    const next = mode as UtilityMode | null;
    if (!controlled) setInternalUtility(next);
    onUtilityModeChange?.(next);
  }), [controlled, onUtilityModeChange]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, [searchOpen]);

  const activate = (key: NavKey) => {
    setSearchOpen(false);
    if (key === "community") {
      setUtility(null);
      onCommunity();
      return;
    }
    if (key === "voice") {
      setUtility(null);
      onVoice();
      return;
    }
    if (key === "more") {
      setUtility(null);
      onMore();
      return;
    }
    setUtility(key);
  };

  const activeKey = utility ?? "community";
  const notificationLabel = unreadCount > 0 ? `Oznámení, ${unreadCount} nepřečtených` : "Oznámení";

  return (
    <>
      <header className="sv-topbar sv-topbar-v17 sv-topbar-v18 sv-topbar-v19 sv-topbar-v24 sv-topbar-v25 sv-topbar-v29">
        <div className="sv-topbar-scene" aria-hidden="true">
          <img className="sv-topbar-scene-image" src="/vox/reference/topbar-space-v30.webp" alt="" />
          <span className="sv-topbar-deep-space" />
          <span className="sv-topbar-stars sv-topbar-stars-a" />
          <span className="sv-topbar-stars sv-topbar-stars-b" />
          <span className="sv-topbar-constellation"><i /><i /><i /><i /><i /></span>
          <span className="sv-topbar-horizon" />
          <span className="sv-topbar-ridge sv-topbar-ridge-back" />
          <span className="sv-topbar-ridge sv-topbar-ridge-front" />
          <span className="sv-topbar-skyline" />
          <span className="sv-topbar-planet"><i /><b /><em /></span>
          <span className="sv-topbar-planet-glow" />
          <span className="sv-topbar-orbit sv-topbar-orbit-a" />
          <span className="sv-topbar-orbit sv-topbar-orbit-b" />
          <span className="sv-topbar-beam sv-topbar-beam-a" />
          <span className="sv-topbar-beam sv-topbar-beam-b" />
          <span className="sv-topbar-comet sv-topbar-comet-a" />
          <span className="sv-topbar-comet sv-topbar-comet-b" />
          <span className="sv-topbar-scan" />
          <span className="sv-topbar-grid" />
        </div>

        <div className="sv-topbar-brand">
          <span className="sv-brand-symbol" aria-hidden="true">
            <i className="sv-brand-wing sv-brand-wing-left" />
            <i className="sv-brand-wing sv-brand-wing-right" />
            <b className="sv-brand-core" />
            <em className="sv-brand-spark" />
            <span className="sv-brand-inner-cut" />
          </span>
          <div className="sv-brand-copy">
            <strong>VOXAR.APP</strong>
            <span>STUDIOVOXARIO</span>
          </div>
        </div>

        <nav className="sv-topbar-nav" aria-label="Hlavní navigace">
          {navItems.map(({ key, label, icon: Icon }) => (
            key === "more" ? <DropdownMenu key={key}>
              <DropdownMenuTrigger asChild><button type="button" data-label={label} aria-label="Další nástroje"><Icon /><span>{label}</span></button></DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setUtility("broadcast")}>Vysílací studio (RTMP)</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setUtility("remove-bg")}>Odstranit pozadí obrázku</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setUtility("members")}>Členové komunity</DropdownMenuItem>
                <DropdownMenuItem onSelect={onMore}>Otevřít dashboard</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu> : <button key={key} type="button" data-label={label} aria-current={activeKey === key ? "page" : undefined} className={activeKey === key ? "active" : undefined} onClick={() => activate(key)}>
              <span className="sv-topbar-nav-glow" aria-hidden="true" />
              <span className="sv-topbar-nav-notch" aria-hidden="true" />
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="sv-topbar-tools">
          <div className="sv-topbar-search-wrap">
            <label className="sv-topbar-search">
              <Search />
              <input
                ref={searchRef}
                value={searchQuery}
                placeholder="Hledat v komunitě..."
                aria-label="Hledat ve Voxar.app"
                onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSearchOpen(false), 150)}
              />
              <kbd>Ctrl K</kbd>
            </label>
            <CommunitySearchPopover
              guildId={activeGuildId}
              query={searchQuery}
              open={searchOpen}
              onClose={() => setSearchOpen(false)}
              onOpenChannel={(channelId) => {
                setUtility(null);
                onOpenChannel?.(channelId);
              }}
            />
          </div>

          <button
            type="button"
            className={`sv-topbar-icon-button sv-notification-trigger${utility === "notifications" ? " active" : ""}`}
            onClick={() => { setSearchOpen(false); setUtility(utility === "notifications" ? null : "notifications"); }}
            aria-label={notificationLabel}
            aria-expanded={utility === "notifications"}
            title={notificationLabel}
          >
            <Bell />
            {unreadCount > 0 && <span className="sv-topbar-notification-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </button>

          <div className="sv-topbar-profile-cluster">
            <span className="sv-topbar-presence-label" aria-hidden="true">LIVE</span>
            <button type="button" className="sv-topbar-avatar" onClick={onProfile} title="Nastavení profilu" aria-label={`Profil ${displayName}`}>
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{displayName.slice(0, 2).toUpperCase()}</span>}
              <i className="sv-topbar-avatar-ring" aria-hidden="true" />
              <b className="sv-topbar-avatar-dot" aria-hidden="true" />
            </button>
          </div>

          <div className="sv-topbar-motto" aria-hidden="true">
            <span>People</span><span>Ideas</span><span>Games</span><span>Together</span>
          </div>
        </div>
      </header>

      {utility && (
        <CommunityUtilityOverlay
          mode={utility}
          onClose={() => setUtility(null)}
          guildId={activeGuildId}
          isGuildAdmin={isGuildAdmin}
          onOpenChannel={(channelId) => {
            setUtility(null);
            onOpenChannel?.(channelId);
          }}
        />
      )}
    </>
  );
}
