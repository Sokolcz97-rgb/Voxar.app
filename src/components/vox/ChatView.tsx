import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Hash, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { VoxChannel } from "./ChannelSidebar";
import type { VoxMember } from "./MemberList";
import { RoleBadge } from "./VoxRolesPanel";

interface Msg {
  id: string;
  channel_id: string;
  author_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
}

interface ProfileLite { user_id: string; display_name: string | null; avatar_url: string | null; }

export function ChatView({ channel, members = [] }: { channel: VoxChannel; members?: VoxMember[] }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([]);
    let mounted = true;
    (async () => {
      const { data } = await supabase.from("vox_messages")
        .select("*").eq("channel_id", channel.id).order("created_at", { ascending: true }).limit(200);
      if (mounted && data) {
        setMessages(data as Msg[]);
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

  const loadProfiles = async (ids: string[]) => {
    const missing = [...new Set(ids)].filter(id => !profiles[id]);
    if (!missing.length) return;
    const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", missing);
    if (data) setProfiles(p => ({ ...p, ...Object.fromEntries(data.map((x: any) => [x.user_id, x])) }));
  };

  const send = async () => {
    if (!input.trim() || !user) return;
    const content = input.trim();
    setInput("");
    const { error } = await supabase.from("vox_messages").insert({ channel_id: channel.id, author_id: user.id, content });
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
  };

  const deleteMsg = async (id: string) => {
    await supabase.from("vox_messages").delete().eq("id", id);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div className="h-12 px-4 flex items-center gap-2.5 border-b border-primary/20 bg-primary/5">
        <Hash className="w-4 h-4 text-primary text-glow" />
        <span className="font-display tracking-widest uppercase text-sm text-primary text-glow">{channel.name}</span>
        <span className="ml-auto text-[10px] font-display tracking-widest uppercase text-muted-foreground">
          NODE // {messages.length} PKT
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-16">
            <div className="font-display tracking-widest uppercase text-xs text-primary/70 mb-2">// STREAM PRÁZDNÝ</div>
            Vítej v <span className="text-primary font-display tracking-wider">#{channel.name}</span>. Buď první entita, která odešle paket.
          </div>
        )}
        {messages.map((m, i) => {
          const p = profiles[m.author_id];
          const prev = messages[i - 1];
          const compact = prev && prev.author_id === m.author_id &&
            (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60_000;
          const member = members.find((mm) => mm.user_id === m.author_id);
          const topRole = member?.roles?.[0] ?? null;
          const name = member?.nickname || p?.display_name || m.author_id.slice(0, 8);
          const mine = m.author_id === user?.id;
          const ringColor = topRole?.color || "hsl(var(--primary))";
          return (
            <div key={m.id} className={cn("group flex gap-3", compact ? "pl-12" : "")}>
              {!compact && (
                <div
                  className="rank-ring w-9 h-9 shrink-0"
                  style={{ ["--rank-color" as any]: ringColor }}
                >
                  <div className="rank-inner overflow-hidden flex items-center justify-center text-xs font-display font-bold">
                    {p?.avatar_url
                      ? <img src={p.avatar_url} alt={name} className="w-full h-full object-cover" />
                      : name.slice(0, 2).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="flex-1 min-w-0">
                {!compact && (
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="font-display font-bold text-sm tracking-wider"
                      style={{ color: ringColor, textShadow: `0 0 8px ${ringColor}66` }}
                    >
                      {name}
                    </span>
                    {topRole && <RoleBadge role={topRole} />}
                    <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
                      {new Date(m.created_at).toLocaleTimeString("cs", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap break-words text-foreground/95">{m.content}</div>
              </div>
              {mine && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive self-start transition-opacity"
                  onClick={() => deleteMsg(m.id)}
                  title="Smazat paket"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 pb-3 pt-2">
        <div className="flex items-end gap-2">
          <div className="tx-bar flex-1 flex items-end gap-2 px-4 py-2.5">
            <span className="font-display text-[10px] tracking-[0.28em] uppercase text-primary/70 pb-2 shrink-0">TX &gt;</span>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder={`Vyslat paket do #${channel.name}`}
              className="min-h-[36px] max-h-40 resize-none bg-transparent border-0 focus-visible:ring-0 p-0 text-sm"
              rows={1}
            />
            <span className="hidden sm:block pb-2 text-[9px] font-display tracking-[0.28em] uppercase text-muted-foreground/60 shrink-0">
              ENTER · SEND
            </span>
          </div>
          <button
            onClick={send}
            disabled={!input.trim()}
            title="Odeslat paket"
            className="tx-send h-[52px] w-16 shrink-0 flex items-center justify-center text-primary"
          >
            <Send className="w-5 h-5 drop-shadow-[0_0_6px_hsl(var(--primary))]" />
          </button>
        </div>
      </div>

    </div>
  );
}
