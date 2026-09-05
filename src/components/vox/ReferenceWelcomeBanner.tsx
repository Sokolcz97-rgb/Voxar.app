import { useEffect } from "react";
import type { VoxChannel } from "./ChannelSidebar";
import { setCommunityChatBridge } from "./reference/communityChatBridge";

interface Props {
  guildName: string;
  channels: VoxChannel[];
  onSelectChannel: (channel: VoxChannel) => void;
  onShowRules?: () => void;
}

/**
 * Compatibility bridge for AppShellReference.
 *
 * The old shell still mounts this component before ChatView. The actual visual
 * welcome card now lives inside ChatView together with the channel header,
 * message list and composer so the center column has one structural owner.
 */
export function ReferenceWelcomeBanner({
  guildName,
  channels,
  onSelectChannel,
  onShowRules,
}: Props) {
  useEffect(() => {
    setCommunityChatBridge({
      guildName,
      channels,
      onSelectChannel,
      onShowRules,
    });

    return () => setCommunityChatBridge(null);
  }, [guildName, channels, onSelectChannel, onShowRules]);

  return null;
}
