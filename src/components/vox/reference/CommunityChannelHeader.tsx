import { Hash, Lock, LockOpen, MessageCircle, Phone, Pin, UsersRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { VoxChannel } from "../ChannelSidebar";

interface Props {
  channel: VoxChannel;
  onlineCount: number;
  memberCount: number;
  hasKey: boolean;
  onOpenEncryption: () => void;
}

export function CommunityChannelHeader({
  channel,
  onlineCount,
  memberCount,
  hasKey,
  onOpenEncryption,
}: Props) {
  const topic = channel.topic || `Místo pro vše, co patří do #${channel.name}. Chat, novinky, nápady i každodenní pokec.`;

  return (
    <header className="sv-channel-header">
      <div className="sv-channel-header-main">
        <div className="sv-channel-header-icon" aria-hidden="true">
          <MessageCircle />
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
        <button
          type="button"
          title="Připojit se na hlas"
          onClick={() => toast({ title: "Hlas", description: "Vyber hlasový kanál vlevo a připoj se." })}
        >
          <Phone />
        </button>
        <button
          type="button"
          title="Připnuté zprávy"
          onClick={() => toast({ title: "Připnuté zprávy", description: "Připnuté zprávy budou dostupné v další verzi." })}
        >
          <Pin />
        </button>
        <button
          type="button"
          title="Členové"
          onClick={() => toast({ title: "Členové komunity", description: `${memberCount} členů · ${onlineCount} online` })}
        >
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
