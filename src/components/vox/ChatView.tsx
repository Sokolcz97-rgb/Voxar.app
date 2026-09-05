import { useCosmeticRing } from "@/hooks/useCosmeticRing";
import { useEffect, useRef, useState, memo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AtSign,
  BarChart3,
  Bot,
  FileDown,
  Gift,
  Hash,
  Loader2,
  Lock,
  LockOpen,
  Paperclip,
  Phone,
  Pin,
  Send,
  Smile,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { uploadAttachment, type UploadedAttachment } from "@/lib/uploadAttachment";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { VoxChannel } from "./ChannelSidebar";
import type { VoxMember } from "./MemberList";
import { RoleBadge } from "./VoxRolesPanel";
import { encryptMessage, decryptMessage, isEncrypted, getPassphrase, setPassphrase } from "@/lib/e2ee";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Attachment {
  url: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "video" | "file";
}

interface Msg {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  attachments?: Attachment[] | null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentList({ items }: { items: Attachment[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {items.map((a, i) =>
        a.kind === "image" ? (
          <a key={i} href={a.url} target="_blank" rel="noreferrer" className="block">
            <img decoding="async"
              src={a.url}
              alt={a.name}
              loading="lazy"
              className="max-h-64 max-w-[min(420px,100%)] object-contain border border-primary/25 [clip-path:polygon(10px_0,100%_0,100%_calc(100%-10px),calc(100%-10px)_100%,0_100%,0_10px)]"
            />
          </a>
        ) : a.kind === "video" ? (
          <video key={i} src={a.url} controls className="max-h-64 max-w-[min(420px,100%)] border border-primary/25" />
        ) : (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            download={a.name}
            className="flex items-center gap-2 px-3 py-2 bg-[hsl(222_42%_9%)] border border-primary/30 hover:border-primary/70 text-primary transition-colors [clip-path:polygon(10px_0,100%_0,100%_calc(100%-10px),calc(100%-10px)_100%,0_100%,0_10px)]"
          >
            <FileDown className="w-4 h-4 shrink-0" />
            <span className="text-xs font-mono truncate max-w-[220px]">{a.name}</span>
            <span className="text-[10px] font-display tracking-widest uppercase text-muted-foreground">{formatSize(a.size)}</span>
          </a>
        ),
      )}
    </div>
  );
}

interface ProfileLite { user_id: string; display_name: string | null; avatar_url: string | null; }

interface RowProps {
  m: Msg;
  compact: boolean;
  name: string;
  ringColor: string;
  topRole: any;
  avatarUrl: string | null;
  mine: boolean;
  decrypted: string | null | undefined;
  onDelete: (id: string) => void;
  onNeedKey: () => void;
}

const MessageRow = memo(function MessageRow({
  m, compact, name, ringColor, topRole, avatarUrl, mine, decrypted, onDelete, onNeedKey,
}: RowProps) {
  const cosmeticRing = useCosmeticRing((m as any).user_id);
  return (
    <div className={cn("perf-row group flex gap-3", compact ? "pl-12" : "")}>
      {!compact && (
        <div className={cn("rank-ring w-9 h-9 shrink-0", cosmeticRing)} style={{ ["--rank-color" as any]: ringColor }}>
          <div className="rank-inner overflow-hidden flex items-center justify-center text-xs font-display font-bold">
            {avatarUrl
              ? <img loading="lazy" decoding="async" src={avatarUrl} alt={name} className="w-full h-full object-cover" />
              : name.slice(0, 2).toUpperCase()}
          </div>
        </div>
      )}
      <div className="flex-1 min-w-0">
        {!compact && (
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-sans font-semibold text-sm" style={{ color: ringColor, textShadow: `0 0 8px ${ringColor}66` }}>
              {name}
            </span>
            {topRole && <RoleBadge role={topRole} />}
            <span className="text-[10px] font-sans tracking-wide text-muted-foreground/70">
              {new Date(m.created_at).toLocaleTimeString("cs", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
        {isEncrypted(m.content) ? (
          decrypted ? (
            <div className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap break-words text-foreground/90 flex gap-1.5">
              <Lock className="w-3 h-3 mt-1 shrink-0 text-emerald-400/80" />
              <span>{decrypted}</span>
            </div>
          ) : (
            <button onClick={onNeedKey} className="text-sm text-muted-foreground/70 italic flex items-center gap-1.5 hover:text-primary">
              <Lock className="w-3 h-3" /> Zašifrovaná zpráva — zadej klíč kanálu
            </button>
          )
        ) : (
          m.content && <div className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap break-words text-foreground/90">{m.content}</div>
        )}
        {Array.isArray(m.attachments) && m.attachments.length > 0 && (
          <AttachmentList items={m.attachments as Attachment[]} />
        )}
      </div>
      {mine && (
        <button
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive self-start transition-opacity"
          onClick={() => onDelete(m.id)}
          title="Smazat zprávu"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
});

export function ChatView({ channel, members = [] }: { channel: VoxChannel; members?: VoxMember[] }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [input, setInput] = useState("");
  const [plain, setPlain] = useState<Record<string, string | null>>({});
  const [e2eeOpen, setE2eeOpen] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [hasKey, setHasKey] = useState<boolean>(() => !!getPassphrase(channel.guild_id));
  const [pending, setPending] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    let mounted = true;
    (async () => {
      const { data } = await supabase.from("vox_messages")
        .select("*").eq("channel_id", channel.id).order("created_at", { ascending: true }).limit(200);
      if (mounted && data) {
        setMessages(data as unknown as Msg[]);
        loadProfiles(data.map((m: any) => m.author_id));
      }
    })();

    const ch = supabase.channel(`vox_chat_${channel.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "vox_messages", filter: `channel_id=eq.${channel.id}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some(x => x.id === m.id) ? prev : [...prev, m]));
          loadProfiles([m.author_id]);
        })
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "vox_messages", filter: `channel_id=eq.${channel.id}` },
        (payload) => setMessages((prev) => prev.filter(m => m.id !== (payload.old as Msg).id)))
      .subscribe();

    return () => { mounted = false; supabase.removeChannel(ch); };
  }, [channel.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        messages
          .filter((m) => isEncrypted(m.content) && plain[m.id] === undefined)
          .map(async (m) => [m.id, await decryptMessage(channel.guild_id, m.content)] as const),
      );
      if (alive && entries.length) setPlain((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => { alive = false; };
  }, [messages, hasKey, channel.guild_id]);

  const applyKey = (pass: string | null) => {
    setPassphrase(channel.guild_id, pass);
    setHasKey(!!pass);
    setPlain({});
    setE2eeOpen(false);
    setPassInput("");
  };

  const loadProfiles = async (ids: string[]) => {
    const missing = [...new Set(ids)].filter(id => !profiles[id]);
    if (!missing.length) return;
    const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", missing);
    if (data) setProfiles(p => ({ ...p, ...Object.fromEntries(data.map((x: any) => [x.user_id, x])) }));
  };

  const send = async () => {
    if ((!input.trim() && pending.length === 0) || !user) return;
    const raw = input.trim();
    const content = raw && hasKey ? await encryptMessage(channel.guild_id, raw) : raw;
    const attachments = pending;
    setInput("");
    setPending([]);
    const { error } = await supabase.from("vox_messages").insert({
      channel_id: channel.id,
      author_id: user.id,
      content,
      attachments: attachments as any,
    });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
  };

  const pickFiles = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const up = await uploadAttachment(file, user.id);
        setPending((p) => [...p, up]);
      }
    } catch (e) {
      toast({ title: "Nahrání selhalo", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMsg = useCallback(async (id: string) => {
    await supabase.from("vox_messages").delete().eq("id", id);
  }, []);

  const openKeyDialog = useCallback(() => setE2eeOpen(true), []);
  const onlineCount = members.filter((member) => (member.status || "offline") !== "offline").length;

  const appendInput = (value: string) => {
    setInput((current) => {
      if (!current) return value;
      if (/\s$/.test(current)) return `${current}${value}`;
      return `${current} ${value}`;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="vox-chat-header h-14 border-b border-primary/15">
        <div className="vox-chat-header-copy">
          {channel.emoji
            ? <span className="vox-chat-emoji text-base leading-none">{channel.emoji}</span>
            : <Hash className="w-4 h-4 text-primary" />}
          <span className="vox-chat-header-name">{channel.name}</span>
          <span className="vox-chat-header-topic">
            {channel.topic || `Místo pro vše, co patří do #${channel.name}. Chat, novinky, nápady i každodenní pokec.`}
          </span>
        </div>

        <div className="vox-chat-header-tools">
          <span className="vox-chat-online"><i />{onlineCount} online</span>
          <button type="button" className="vox-chat-header-tool" title="Připojit se na hlas" onClick={() => toast({ title: "Hlas", description: "Vyber hlasový kanál vlevo a připoj se." })}>
            <Phone />
          </button>
          <button type="button" className="vox-chat-header-tool" title="Připnuté zprávy" onClick={() => toast({ title: "Připnuté zprávy", description: "Připnuté zprávy budou dostupné v další verzi." })}>
            <Pin />
          </button>
          <button type="button" className="vox-chat-header-tool" title="Členové" onClick={() => toast({ title: "Členové komunity", description: `${members.length} členů · ${onlineCount} online` })}>
            <UsersRound />
          </button>
          <button
            onClick={() => setE2eeOpen(true)}
            title={hasKey ? "E2E šifrování aktivní" : "Zapnout E2E šifrování"}
            className={cn("vox-chat-header-tool secure", hasKey && "active")}
          >
            {hasKey ? <Lock /> : <LockOpen />}
          </button>
        </div>
      </div>

      <div className="hud-scrollbar transform-gpu will-change-transform flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-16">
            <div className="font-display tracking-widest uppercase text-xs text-primary/70 mb-2">Začátek kanálu</div>
            Vítej v <span className="text-primary font-display tracking-wider">#{channel.name}</span>. Buď první, kdo sem napíše.
          </div>
        )}
        {messages.map((m, i) => {
          const p = profiles[m.author_id];
          const prev = messages[i - 1];
          const compact = !!prev && prev.author_id === m.author_id &&
            (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60_000;
          const member = members.find((mm) => mm.user_id === m.author_id);
          const topRole = member?.roles?.[0] ?? null;
          const name = member?.nickname || p?.display_name || m.author_id.slice(0, 8);
          return (
            <MessageRow
              key={m.id}
              m={m}
              compact={compact}
              name={name}
              ringColor={topRole?.color || "hsl(var(--primary))"}
              topRole={topRole}
              avatarUrl={p?.avatar_url ?? null}
              mine={m.author_id === user?.id}
              decrypted={plain[m.id]}
              onDelete={deleteMsg}
              onNeedKey={openKeyDialog}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="composer-pod vox-composer-reference">
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((a, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 bg-[hsl(222_42%_9%)] border border-primary/30 rounded-sm">
                {a.kind === "image" && <img loading="lazy" decoding="async" src={a.url} alt="" className="w-8 h-8 object-cover" />}
                <span className="text-[11px] font-sans truncate max-w-[160px] text-primary/90">{a.name}</span>
                <button onClick={() => setPending((p) => p.filter((_, x) => x !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input ref={fileRef} type="file" multiple hidden onChange={(e) => void pickFiles(e.target.files)} />
        <div className="vox-composer-main">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Připojit soubor"
            className="vox-composer-attach"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>

          <div className="vox-composer-input">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={hasKey ? `Napsat šifrovanou zprávu do #${channel.name}...` : `Napsat zprávu do #${channel.name}...`}
              className="resize-none bg-transparent border-0 hover:border-0 focus-visible:ring-0 focus-visible:border-0 p-0 font-sans"
              rows={1}
            />
            <button type="button" className="vox-composer-mini" title="Dárek" onClick={() => toast({ title: "Dárky", description: "Dárky a boosty připravujeme." })}><Gift /></button>
            <button type="button" className="vox-composer-mini" title="GIF" onClick={() => toast({ title: "GIF", description: "GIF vyhledávání připravujeme." })}>GIF</button>
            <button type="button" className="vox-composer-mini" title="Emoji" onClick={() => appendInput("🙂")}><Smile /></button>
          </div>

          <button
            onClick={send}
            disabled={!input.trim() && pending.length === 0}
            title="Odeslat zprávu"
            className="vox-composer-send disabled:opacity-40"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        <div className="vox-composer-actions">
          <button type="button" className="vox-composer-action" onClick={() => appendInput("@")}><AtSign /> Zmínka</button>
          <button type="button" className="vox-composer-action" onClick={() => fileRef.current?.click()}><Paperclip /> Připojit soubor</button>
          <button type="button" className="vox-composer-action" onClick={() => appendInput("📊 Anketa:")}><BarChart3 /> Vytvořit anketu</button>
          <button type="button" className="vox-composer-action ai" onClick={() => window.dispatchEvent(new CustomEvent("vox:open-ai"))}><Bot /> AI asistent</button>
          <span className="vox-composer-enter">ENTER pro odeslání</span>
        </div>
      </div>

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
            onChange={(e) => setPassInput(e.target.value)}
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
