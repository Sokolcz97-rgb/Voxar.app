import { Component, type ErrorInfo, type ReactNode } from "react";
import { BellRing, CalendarDays, Folder, RefreshCw, ShoppingBag, UsersRound, WandSparkles, X } from "lucide-react";
import { CommunityBackgroundRemoval } from "./CommunityBackgroundRemoval";
import { CommunityEventsStudio } from "./CommunityEventsStudio";
import { CommunityFiles } from "./CommunityFiles";
import { CommunityMembers } from "./CommunityMembers";
import { CommunityNotifications } from "./CommunityNotifications";
import { CommunityShop } from "./CommunityShop";
import { getVoxCommunityContext, openVoxChannel } from "@/lib/voxCommunityBridge";
import "./community-suite-v25.css";
import "./community-topbar-v25.css";
import "./community-events-v26.css";
import "./community-members-v27.css";
import "./community-notifications-v28.css";

export type UtilityMode = "events" | "broadcast" | "members" | "notifications" | "files" | "store" | "remove-bg";

const meta = {
  broadcast: { label: "Vysílací studio · RTMP", icon: CalendarDays },
  events: { label: "Události & vysílání", icon: CalendarDays },
  members: { label: "Členové komunity", icon: UsersRound },
  notifications: { label: "Centrum oznámení", icon: BellRing },
  files: { label: "Soubory", icon: Folder },
  store: { label: "Obchod", icon: ShoppingBag },
  "remove-bg": { label: "Odstranit pozadí", icon: WandSparkles },
} satisfies Record<UtilityMode, { label: string; icon: typeof CalendarDays }>;

type Props = {
  mode: UtilityMode;
  onClose: () => void;
  guildId?: string | null;
  isGuildAdmin?: boolean;
  onOpenChannel?: (channelId: string) => void;
};

type BoundaryProps = {
  resetKey: string;
  children: ReactNode;
};

type BoundaryState = {
  failed: boolean;
};

class UtilityPanelBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Voxar utility panel crashed", error, info);
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="sv-feature-empty sv-utility-error">
          <BellRing />
          <strong>Panel se nepodařilo zobrazit</strong>
          <span>Voxar zachoval zbytek aplikace aktivní. Zkus panel načíst znovu.</span>
          <button type="button" className="sv-hud-button secondary" onClick={() => this.setState({ failed: false })}>
            <RefreshCw /> Zkusit znovu
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export function CommunityUtilityOverlay({ mode, onClose, guildId, isGuildAdmin, onOpenChannel }: Props) {
  const entry = meta[mode];
  if (!entry) return null;

  const Icon = entry.icon;
  const bridged = getVoxCommunityContext();
  const resolvedGuildId = guildId === undefined ? bridged.guildId : guildId;
  const resolvedAdmin = isGuildAdmin === undefined ? bridged.isAdmin : isGuildAdmin;

  return (
    <section className="sv-utility-overlay" aria-label={entry.label}>
      <div className="sv-utility-chrome" aria-hidden="true"><i /><i /><i /><span /></div>
      <header className="sv-utility-overlay-head">
        <div><Icon /><span>{entry.label}</span><small>VOXAR.APP / STUDIOVOXARIO</small></div>
        <button type="button" onClick={onClose} aria-label="Zavřít"><X /></button>
      </header>
      <div className="sv-utility-scroll">
        <UtilityPanelBoundary resetKey={mode}>
          {(mode === "events" || mode === "broadcast") && <CommunityEventsStudio initialTab={mode === "broadcast" ? "broadcast" : "events"} guildId={resolvedGuildId} isAdmin={resolvedAdmin} onOpenChannel={onOpenChannel ?? openVoxChannel} />}
          {mode === "members" && <CommunityMembers guildId={resolvedGuildId} />}
          {mode === "notifications" && <CommunityNotifications />}
          {mode === "files" && <CommunityFiles />}
          {mode === "store" && <CommunityShop />}
          {mode === "remove-bg" && <CommunityBackgroundRemoval />}
        </UtilityPanelBoundary>
      </div>
    </section>
  );
}
