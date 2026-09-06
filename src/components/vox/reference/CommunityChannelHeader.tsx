import { Hash, Lock, LockOpen, MessageCircle, Phone, Pin, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoxChannel } from "../ChannelSidebar";

interface Props {
  channel: VoxChannel;
  onlineCount: number;
  memberCount: number;
  hasKey: boolean;
  onOpenEncryption: () => void;
  onJoinVoice: () => void;
  onOpenPins: () => void;
  onOpenMembers: () => void;
}

export function CommunityChannelHeader({
  channel,
  onlineCount,
  memberCount,
  hasKey,
  onOpenEncryption,
  onJoinVoice,
  onOpenPins,
  onOpenMembers,
}: Props) {
  const topic = channel.topic || `Místo pro vše, co patří do #${channel.name}. Chat, novinky, nápady i každodenní pokec.`;

  return (
    <header className="sv-channel-header sv-channel-header-v18 sv-channel-header-v19">
      <span className="sv-channel-header-edge sv-channel-header-edge-a" aria-hidden="true" />
      <span className="sv-channel-header-edge sv-channel-header-edge-b" aria-hidden="true" />
      <span className="sv-channel-header-grid" aria-hidden="true" />

      <div className="sv-channel-header-main">
        <div className="sv-channel-header-icon" aria-hidden="true">
          <MessageCircle />
          <i />
        </div>
        <div className="sv-channel-header-copy">
          <div className="sv-channel-header-title-row">
            <Hash className="sv-channel-hash" />
            <h1>{channel.name}</h1>
          </div>
          <p>{topic}</p>
        </div>
      </div>

      <div className="sv-channel-header-actions">
        <span className="sv-channel-online"><i />{onlineCount} online</span>
        <span className="sv-channel-divider" aria-hidden="true" />
        <button type="button" title="Připojit se na hlas" onClick={onJoinVoice}>
          <Phone />
        </button>
        <button type="button" title="Připnuté zprávy" onClick={onOpenPins}>
          <Pin />
        </button>
        <button type="button" title={`Členové · ${memberCount} členů · ${onlineCount} online`} onClick={onOpenMembers}>
          <UsersRound />
        </button>
        <button
          type="button"
          className={cn("sv-channel-security", hasKey && "active")}
          title={hasKey ? "E2E šifrování aktivní" : "Zapnout E2E šifrování"}
          onClick={onOpenEncryption}
        >
          {hasKey ? <Lock /> : <LockOpen />}
        </button>
      </div>
    </header>
  );
}
