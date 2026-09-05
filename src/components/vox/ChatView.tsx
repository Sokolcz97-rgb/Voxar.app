import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { uploadAttachment, type UploadedAttachment } from "@/lib/uploadAttachment";
import { decryptMessage, encryptMessage, getPassphrase, isEncrypted, setPassphrase } from "@/lib/e2ee";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { VoxChannel } from "./ChannelSidebar";
import type { VoxMember } from "./MemberList";
import { CommunityChannelHeader } from "./reference/CommunityChannelHeader";
import { CommunityWelcomeBanner } from "./reference/CommunityWelcomeBanner";
import { CommunityMessageList } from "./reference/CommunityMessageList";
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
  const [passInput, setPassInput] = useState("");
  const [hasKey, setHasKey] = useState<boolean>(() => !!getPassphrase(channel.guild_id));
  const [pending, setPending] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const effectiveGuildName = guildName ?? shellBridge?.guildName ?? "StudioVoxario";
  const effectiveGuildIconUrl = guildIconUrl ?? shellBridge?.guildIconUrl ?? null;
  const effectiveChannels = channels ?? shellBridge?.channels ?? [channel];
  const effectiveSelectChannel = onSelectChannel ?? shellBridge?.onSelectChannel ?? (() => undefined);
  const effectiveShowRules = onShowRules ?? shellBridge?.onShowRules;

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

  useEffect(() => {
    setMessages([]);
    setPending([]);
    setInput("");
    let mounted = true;

    (async () => {
      const { data } = await supabase
        .from("vox_messages")
        .select("*")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!mounted || !data) return;
      const rows = data as unknown as CommunityMessage[];
      setMessages(rows);
      void loadProfiles(rows.map((message) => message.author_id));
    })();

    const realtime = supabase
      .channel(`vox_chat_${channel.id}`)
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
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(realtime);
    };
  }, [channel.id, loadProfiles]);

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
          .map(async (message) => [
            message.id,
            await decryptMessage(channel.guild_id, message.content),
          ] as const),
      );

      if (alive && entries.length) {
        setPlain((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }
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
    if ((!input.trim() && pending.length === 0) || !user) return;

    const raw = input.trim();
    const content = raw && hasKey
      ? await encryptMessage(channel.guild_id, raw)
      : raw;
    const attachments = pending;

    setInput("");
    setPending([]);

    const { error } = await supabase.from("vox_messages").insert({
      channel_id: channel.id,
      author_id: user.id,
      content,
      attachments: attachments as any,
    });

    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
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
      toast({
        title: "Nahrání selhalo",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMessage = useCallback(async (id: string) => {
    await supabase.from("vox_messages").delete().eq("id", id);
  }, []);

  const onlineCount = members.filter((member) => (member.status || "offline") !== "offline").length;

  return (
    <div className="sv-chat-shell">
      <CommunityChannelHeader
        channel={channel}
        onlineCount={onlineCount}
        memberCount={members.length}
        hasKey={hasKey}
        onOpenEncryption={() => setE2eeOpen(true)}
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
        onDelete={deleteMessage}
        onNeedKey={() => setE2eeOpen(true)}
        bottomRef={bottomRef}
        channelName={channel.name}
      />

      <CommunityComposer
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

      <Dialog open={e2eeOpen} onOpenChange={setE2eeOpen}>
        <DialogContent className="holo-context-menu max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-[0.20em] text-sm text-primary text-glow">
              E2E šifrování
            </DialogTitle>
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
            {hasKey && (
              <Button variant="destructive" onClick={() => applyKey(null)}>Vypnout šifrování</Button>
            )}
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
