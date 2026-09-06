import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAttachment, type UploadedAttachment } from "@/lib/uploadAttachment";
import { decryptMessage, encryptMessage, getPassphrase, isEncrypted, setPassphrase } from "@/lib/e2ee";
import { openVoxUtility } from "@/lib/voxCommunityBridge";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { VoxChannel } from "./ChannelSidebar";
import type { VoxMember } from "./MemberList";
import { CommunityChannelHeader } from "./reference/CommunityChannelHeader";
import { CommunityWelcomeBanner } from "./reference/CommunityWelcomeBanner";
import { CommunityMessageList, type CommunityReaction } from "./reference/CommunityMessageList";
import { CommunityComposer } from "./reference/CommunityComposer";
import { useCommunityChatBridge } from "./reference/communityChatBridge";
import type { CommunityMessage, CommunityProfileLite } from "./reference/chatTypes";
import "./reference/community-structured-chat.css";

interface Props {
  channel: VoxChannel;
  members?: VoxMember[];
  guildName?: string;
  guildIconUrl?: string | null;
  channels?: VoxChannel[];
  onSelectChannel?: (channel: VoxChannel) => void;
  onShowRules?: () => void;
}

type MessagePin = {
  message_id: string;
  pinned_by: string;
  created_at: string;
};

const db = supabase as any;

function realtimeSuffix() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

export function ChatView({
  channel,
  members = [],
  guildName,
  guildIconUrl,
  channels,
  onSelectChannel,
  onShowRules,
}: Props) {
  const { user } = useAuth();
  const shellBridge = useCommunityChatBridge();
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, CommunityProfileLite>>({});
  const [input, setInput] = useState("");
  const [plain, setPlain] = useState<Record<string, string | null>>({});
  const [e2eeOpen, setE2eeOpen] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [hasKey, setHasKey] = useState<boolean>(() => !!getPassphrase(channel.guild_id));
  const [pending, setPending] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [pins, setPins] = useState<MessagePin[]>([]);
  const [reactions, setReactions] = useState<CommunityReaction[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const effectiveGuildName = guildName ?? shellBridge?.guildName ?? "StudioVoxario";
  const effectiveGuildIconUrl = guildIconUrl ?? shellBridge?.guildIconUrl ?? null;
  const effectiveChannels = channels ?? shellBridge?.channels ?? [channel];
  const effectiveSelectChannel = onSelectChannel ?? shellBridge?.onSelectChannel ?? (() => undefined);
  const effectiveShowRules = onShowRules ?? shellBridge?.onShowRules;
  const selfMember = members.find((member) => member.user_id === user?.id);
  const canManageMessages = selfMember?.role === "owner" || selfMember?.role === "mod";
  const pinnedMessageIds = useMemo(() => new Set(pins.map((pin) => pin.message_id)), [pins]);
  const pinnedMessages = useMemo(
    () => pins.map((pin) => ({ pin, message: messages.find((message) => message.id === pin.message_id) ?? null })),
    [pins, messages],
  );

  const loadProfiles = useCallback(async (ids: string[]) => {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return;

    const { data } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_url")
      .in("user_id", uniqueIds);

    if (!data) return;
    setProfiles((current) => ({
      ...current,
      ...Object.fromEntries(data.map((profile: any) => [profile.user_id, profile])),
    }));
  }, []);

  const loadInteractions = useCallback(async () => {
    const [{ data: pinRows, error: pinError }, { data: reactionRows, error: reactionError }] = await Promise.all([
      db.from("vox_message_pins").select("message_id,pinned_by,created_at").eq("channel_id", channel.id).order("created_at", { ascending: false }),
      db.from("vox_message_reactions").select("message_id,user_id,emoji").eq("channel_id", channel.id),
    ]);
    if (pinError) console.warn("Voxar pins load failed", pinError);
    if (reactionError) console.warn("Voxar reactions load failed", reactionError);
    if (!pinError) setPins((pinRows ?? []) as MessagePin[]);
    if (!reactionError) setReactions((reactionRows ?? []) as CommunityReaction[]);
  }, [channel.id]);

  useEffect(() => {
    setMessages([]);
    setPins([]);
    setReactions([]);
    setPending([]);
    setInput("");
    setPinsOpen(false);
    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from("vox_messages")
        .select("*")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (!mounted || !data) return;
      const rows = (data as unknown as CommunityMessage[]).reverse();
      setMessages(rows);
      void loadProfiles(rows.map((message) => message.author_id));
      void loadInteractions();
    })();

    const suffix = realtimeSuffix();
    const realtime = supabase
      .channel(`vox_chat_${channel.id}_${suffix}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vox_messages", filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          const message = payload.new as CommunityMessage;
          setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
          void loadProfiles([message.author_id]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "vox_messages", filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          const removed = payload.old as CommunityMessage;
          setMessages((current) => current.filter((message) => message.id !== removed.id));
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vox_message_pins", filter: `channel_id=eq.${channel.id}` },
        () => { if (mounted) void loadInteractions(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vox_message_reactions", filter: `channel_id=eq.${channel.id}` },
        () => { if (mounted) void loadInteractions(); },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(realtime).catch(() => undefined);
    };
  }, [channel.id, loadProfiles, loadInteractions]);

  useEffect(() => {
    setHasKey(!!getPassphrase(channel.guild_id));
    setPlain({});
    setPassInput("");
    setE2eeOpen(false);
  }, [channel.guild_id, channel.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    let alive = true;

    (async () => {
      const entries = await Promise.all(
        messages
          .filter((message) => isEncrypted(message.content) && plain[message.id] === undefined)
          .map(async (message) => [message.id, await decryptMessage(channel.guild_id, message.content)] as const),
      );

      if (alive && entries.length) setPlain((current) => ({ ...current, ...Object.fromEntries(entries) }));
    })();

    return () => { alive = false; };
  }, [messages, hasKey, channel.guild_id, plain]);

  const applyKey = (passphrase: string | null) => {
    setPassphrase(channel.guild_id, passphrase);
    setHasKey(!!passphrase);
    setPlain({});
    setE2eeOpen(false);
    setPassInput("");
  };

  const send = async () => {
    if ((!input.trim() && pending.length === 0) || !user || uploading || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    const raw = input.trim();
    const draft = input;
    const attachments = pending;
    try {
      const content = raw && hasKey ? await encryptMessage(channel.guild_id, raw) : raw;
      const { data, error } = await supabase.from("vox_messages").insert({
        channel_id: channel.id, author_id: user.id, content, attachments: attachments as any,
      }).select().single();
      if (error) throw error;
      if (data) {
        setMessages(current => current.some(m => m.id === data.id) ? current : [...current, data as unknown as CommunityMessage]);
        void loadProfiles([user.id]);
      }
      setInput(current => current === draft ? "" : current);
      setPending(current => current.filter(item => !attachments.includes(item)));
    } catch (error) {
      toast({ title: "Zpráva se neodeslala", description: "Text i přílohy zůstaly zachované. " + (error as Error).message, variant: "destructive" });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const uploaded = await uploadAttachment(file, user.id);
        setPending((current) => [...current, uploaded]);
      }
    } catch (error) {
      toast({ title: "Nahrání selhalo", description: (error as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMessage = useCallback(async (id: string) => {
    const { error } = await supabase.from("vox_messages").delete().eq("id", id);
    if (error) toast({ title: "Zprávu se nepodařilo smazat", description: error.message, variant: "destructive" });
  }, []);

  const togglePin = useCallback(async (message: CommunityMessage, pinned: boolean) => {
    if (!user) return;
    if (pinned) {
      const { error } = await db.from("vox_message_pins").delete().eq("message_id", message.id);
      if (error) { toast({ title: "Zprávu se nepodařilo odepnout", description: error.message, variant: "destructive" }); return; }
      setPins((current) => current.filter((pin) => pin.message_id !== message.id));
    } else {
      const { data, error } = await db
        .from("vox_message_pins")
        .insert({ message_id: message.id, channel_id: channel.id, guild_id: channel.guild_id, pinned_by: user.id })
        .select("message_id,pinned_by,created_at")
        .single();
      if (error) { toast({ title: "Zprávu se nepodařilo připnout", description: error.message, variant: "destructive" }); return; }
      setPins((current) => [data as MessagePin, ...current.filter((pin) => pin.message_id !== message.id)]);
    }
  }, [channel.id, channel.guild_id, user]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string, active: boolean) => {
    if (!user) return;
    if (active) {
      const { error } = await db.from("vox_message_reactions").delete().eq("message_id", messageId).eq("user_id", user.id).eq("emoji", emoji);
      if (error) { toast({ title: "Reakci se nepodařilo odebrat", description: error.message, variant: "destructive" }); return; }
      setReactions((current) => current.filter((reaction) => !(reaction.message_id === messageId && reaction.user_id === user.id && reaction.emoji === emoji)));
    } else {
      const { error } = await db.from("vox_message_reactions").insert({
        message_id: messageId,
        channel_id: channel.id,
        guild_id: channel.guild_id,
        user_id: user.id,
        emoji,
      });
      if (error) { toast({ title: "Reakci se nepodařilo přidat", description: error.message, variant: "destructive" }); return; }
      setReactions((current) => [...current, { message_id: messageId, user_id: user.id, emoji }]);
    }
  }, [channel.id, channel.guild_id, user]);

  const onlineCount = members.filter((member) => (member.status || "offline") !== "offline").length;
  const firstVoiceChannel = effectiveChannels.find((item) => item.type === "voice");

  return (
    <div className="sv-chat-shell">
      <CommunityChannelHeader
        channel={channel}
        onlineCount={onlineCount}
        memberCount={members.length}
        hasKey={hasKey}
        onOpenEncryption={() => setE2eeOpen(true)}
        onJoinVoice={() => firstVoiceChannel
          ? effectiveSelectChannel(firstVoiceChannel)
          : toast({ title: "Hlas", description: "V komunitě zatím není hlasový kanál." })}
        onOpenPins={() => setPinsOpen(true)}
        onOpenMembers={() => openVoxUtility("members")}
      />

      <CommunityWelcomeBanner
        guildName={effectiveGuildName}
        guildIconUrl={effectiveGuildIconUrl}
        channels={effectiveChannels}
        onSelectChannel={effectiveSelectChannel}
        onShowRules={effectiveShowRules}
      />

      <CommunityMessageList
        messages={messages}
        profiles={profiles}
        members={members}
        userId={user?.id}
        decrypted={plain}
        reactions={reactions}
        pinnedMessageIds={pinnedMessageIds}
        canManageMessages={canManageMessages}
        onDelete={deleteMessage}
        onNeedKey={() => setE2eeOpen(true)}
        onTogglePin={togglePin}
        onToggleReaction={toggleReaction}
        bottomRef={bottomRef}
        channelName={channel.name}
      />

      <CommunityComposer
        members={members}
        sending={sending}
        channelName={channel.name}
        hasKey={hasKey}
        input={input}
        setInput={setInput}
        pending={pending}
        setPending={setPending}
        uploading={uploading}
        fileRef={fileRef}
        onPickFiles={pickFiles}
        onSend={send}
      />

      <Dialog open={pinsOpen} onOpenChange={setPinsOpen}>
        <DialogContent className="holo-context-menu sv-pins-dialog max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-[0.16em] text-sm text-primary text-glow flex items-center gap-2">
              <Pin className="w-4 h-4" /> Připnuté zprávy · #{channel.name}
            </DialogTitle>
          </DialogHeader>
          <div className="sv-pins-list hud-scrollbar">
            {pinnedMessages.length === 0 ? (
              <div className="sv-pins-empty">V tomto kanálu zatím není nic připnutého.</div>
            ) : pinnedMessages.map(({ pin, message }) => {
              const profile = message ? profiles[message.author_id] : null;
              const member = message ? members.find((item) => item.user_id === message.author_id) : null;
              const name = member?.nickname || profile?.display_name || "Člen komunity";
              return (
                <article key={pin.message_id} className="sv-pin-row">
                  <div>
                    <strong>{name}</strong>
                    <small>{new Date(pin.created_at).toLocaleString("cs-CZ")}</small>
                  </div>
                  <p>{message ? (isEncrypted(message.content) ? "Zašifrovaná zpráva" : message.content || "Příloha") : "Zpráva je mimo načtenou historii."}</p>
                  {(message?.author_id === user?.id || canManageMessages) && (
                    <button type="button" onClick={() => message && void togglePin(message, true)}>Odepnout</button>
                  )}
                </article>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={e2eeOpen} onOpenChange={setE2eeOpen}>
        <DialogContent className="holo-context-menu max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-[0.20em] text-sm text-primary text-glow">E2E šifrování</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Zprávy se šifrují přímo v aplikaci (AES-256-GCM, klíč odvozený z fráze přes PBKDF2).
            Fráze se neodesílá na server — musí ji znát všichni členové kanálu.
          </p>
          <Input
            type="password"
            autoFocus
            value={passInput}
            onChange={(event) => setPassInput(event.target.value)}
            placeholder="Tajná fráze kanálu"
            className="font-mono bg-background/60 border-primary/30"
          />
          <DialogFooter className="gap-2">
            {hasKey && <Button variant="destructive" onClick={() => applyKey(null)}>Vypnout šifrování</Button>}
            <Button
              disabled={!passInput.trim()}
              onClick={() => applyKey(passInput.trim())}
              className="bg-primary/25 border border-primary/50 text-primary hover:bg-primary/40"
            >
              Uložit klíč
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
