import { CalendarDays, Folder, ShoppingBag, UsersRound, WandSparkles, X } from "lucide-react";
import { CommunityBackgroundRemoval } from "./CommunityBackgroundRemoval";
import { CommunityEventsStudio } from "./CommunityEventsStudio";
import { CommunityFiles } from "./CommunityFiles";
import { CommunityMembers } from "./CommunityMembers";
import { CommunityShop } from "./CommunityShop";
import { getVoxCommunityContext, openVoxChannel } from "@/lib/voxCommunityBridge";
import "./community-suite-v25.css";
import "./community-topbar-v25.css";
import "./community-events-v26.css";
import "./community-members-v27.css";

export type UtilityMode = "events" | "members" | "files" | "store" | "remove-bg";

const meta = {
  events: { label: "Události & vysílání", icon: CalendarDays },
  members: { label: "Členové komunity", icon: UsersRound },
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

export function CommunityUtilityOverlay({ mode, onClose, guildId, isGuildAdmin, onOpenChannel }: Props) {
  const Icon = meta[mode].icon;
  const bridged = getVoxCommunityContext();
  const resolvedGuildId = guildId === undefined ? bridged.guildId : guildId;
  const resolvedAdmin = isGuildAdmin === undefined ? bridged.isAdmin : isGuildAdmin;
  return (
    <section className="sv-utility-overlay" aria-label={meta[mode].label}>
      <div className="sv-utility-chrome" aria-hidden="true"><i /><i /><i /><span /></div>
      <header className="sv-utility-overlay-head">
        <div><Icon /><span>{meta[mode].label}</span><small>VOXAR.APP / STUDIOVOXARIO</small></div>
        <button type="button" onClick={onClose} aria-label="Zavřít"><X /></button>
      </header>
      <div className="sv-utility-scroll">
        {mode === "events" && <CommunityEventsStudio guildId={resolvedGuildId} isAdmin={resolvedAdmin} onOpenChannel={onOpenChannel ?? openVoxChannel} />}
        {mode === "members" && <CommunityMembers guildId={resolvedGuildId} />}
        {mode === "files" && <CommunityFiles />}
        {mode === "store" && <CommunityShop />}
        {mode === "remove-bg" && <CommunityBackgroundRemoval />}
      </div>
    </section>
  );
}
