import { useEffect, useMemo, useState } from "react";
import { Hash, Loader2, MessageCircle, Search, UsersRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { openVoxUtility } from "@/lib/voxCommunityBridge";

const db = supabase as any;

type ChannelResult = { id: string; name: string; type: string; topic: string | null };
type MessageResult = { id: string; channel_id: string; content: string; created_at: string };
type MemberResult = { user_id: string; display_name: string | null; avatar_url: string | null };

type Props = {
  guildId?: string | null;
  query: string;
  open: boolean;
  onClose: () => void;
  onOpenChannel?: (channelId: string) => void;
};

export function CommunitySearchPopover({ guildId, query, open, onClose, onOpenChannel }: Props) {
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<ChannelResult[]>([]);
  const [messages, setMessages] = useState<MessageResult[]>([]);
  const [members, setMembers] = useState<MemberResult[]>([]);
  const trimmed = query.trim();

  useEffect(() => {
    if (!open || !guildId || trimmed.length < 2) {
      setChannels([]);
      setMessages([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const [{ data: guildChannels }, { data: memberships }] = await Promise.all([
          db.from("vox_channels").select("id,name,type,topic").eq("guild_id", guildId).order("position"),
          db.from("vox_guild_members").select("user_id").eq("guild_id", guildId),
        ]);
        if (cancelled) return;

        const allChannels = (guildChannels ?? []) as ChannelResult[];
        const needle = trimmed.toLocaleLowerCase("cs-CZ");
        const matchedChannels = allChannels
          .filter((channel) => channel.name.toLocaleLowerCase("cs-CZ").includes(needle) || channel.topic?.toLocaleLowerCase("cs-CZ").includes(needle))
          .slice(0, 6);
        const channelIds = allChannels.map((channel) => channel.id);
        const memberIds = (memberships ?? []).map((row: any) => row.user_id);

        const [messageResponse, profileResponse] = await Promise.all([
          channelIds.length
            ? db.from("vox_messages")
                .select("id,channel_id,content,created_at")
                .in("channel_id", channelIds)
                .ilike("content", `%${trimmed.replace(/[%_]/g, "\\$&")}%`)
                .order("created_at", { ascending: false })
                .limit(8)
            : Promise.resolve({ data: [] }),
          memberIds.length
            ? db.from("profiles")
                .select("user_id,display_name,avatar_url")
                .in("user_id", memberIds)
                .ilike("display_name", `%${trimmed.replace(/[%_]/g, "\\$&")}%`)
                .limit(6)
            : Promise.resolve({ data: [] }),
        ]);

        if (!cancelled) {
          setChannels(matchedChannels);
          setMessages((messageResponse.data ?? []) as MessageResult[]);
          setMembers((profileResponse.data ?? []) as MemberResult[]);
        }
      } catch (error) {
        console.warn("Voxar community search failed", error);
        if (!cancelled) {
          setChannels([]);
          setMessages([]);
          setMembers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [guildId, open, trimmed]);

  const channelMap = useMemo(() => Object.fromEntries(channels.map((channel) => [channel.id, channel.name])), [channels]);
  const total = channels.length + messages.length + members.length;
  if (!open) return null;

  return (
    <div className="sv-community-search-popover" role="dialog" aria-label="Vyhledávání v komunitě">
      <div className="sv-community-search-head">
        <Search />
        <div><strong>Hledat v komunitě</strong><span>{trimmed.length < 2 ? "Napiš alespoň 2 znaky" : `Výsledky pro „${trimmed}“`}</span></div>
        {loading && <Loader2 className="animate-spin" />}
      </div>

      {trimmed.length >= 2 && !loading && total === 0 && (
        <div className="sv-community-search-empty">Nic jsme nenašli.</div>
      )}

      {channels.length > 0 && (
        <section>
          <h4>Kanály</h4>
          {channels.map((channel) => (
            <button key={channel.id} type="button" onClick={() => { onOpenChannel?.(channel.id); onClose(); }}>
              <Hash /><span><strong>{channel.name}</strong><small>{channel.topic || (channel.type === "voice" ? "Hlasový kanál" : "Textový kanál")}</small></span>
            </button>
          ))}
        </section>
      )}

      {members.length > 0 && (
        <section>
          <h4>Členové</h4>
          {members.map((member) => (
            <button key={member.user_id} type="button" onClick={() => { openVoxUtility("members"); onClose(); }}>
              <span className="sv-search-avatar">{member.avatar_url ? <img src={member.avatar_url} alt="" /> : (member.display_name || "??").slice(0, 2).toUpperCase()}</span>
              <span><strong>{member.display_name || "Člen komunity"}</strong><small>Otevřít seznam členů</small></span>
            </button>
          ))}
        </section>
      )}

      {messages.length > 0 && (
        <section>
          <h4>Zprávy</h4>
          {messages.map((message) => (
            <button key={message.id} type="button" onClick={() => { onOpenChannel?.(message.channel_id); onClose(); }}>
              <MessageCircle /><span><strong>#{channelMap[message.channel_id] || "kanál"}</strong><small>{message.content.slice(0, 110)}</small></span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
