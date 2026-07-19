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

export function ChatView({ channel }: { channel: VoxChannel }) {
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
    <div className="flex-1 flex flex-col bg-[hsl(222_35%_4%)] min-h-0">
      <div className="h-12 px-4 flex items-center gap-2 border-b border-border/50 shadow-sm">
        <Hash className="w-5 h-5 text-muted-foreground" />
        <span className="font-semibold">{channel.name}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            Vítej v <span className="text-foreground font-semibold">#{channel.name}</span>. Buď první, kdo napíše zprávu.
          </div>
        )}
        {messages.map((m, i) => {
          const p = profiles[m.author_id];
          const prev = messages[i - 1];
          const compact = prev && prev.author_id === m.author_id &&
            (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60_000;
          const name = p?.display_name || m.author_id.slice(0, 8);
          const mine = m.author_id === user?.id;
          return (
            <div key={m.id} className={cn("group flex gap-3", compact ? "pl-11" : "")}>
              {!compact && (
                <div className="w-8 h-8 rounded-full bg-secondary shrink-0 overflow-hidden flex items-center justify-center text-xs font-semibold">
                  {p?.avatar_url
                    ? <img src={p.avatar_url} alt={name} className="w-full h-full object-cover" />
                    : name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                {!compact && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">{name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleTimeString("cs", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
              </div>
              {mine && (
                <button
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive self-start"
                  onClick={() => deleteMsg(m.id)}
                  title="Smazat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 pt-0">
        <div className="flex items-end gap-2 bg-secondary rounded-lg px-3 py-2 border border-border/40 focus-within:border-primary/60 transition-colors">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder={`Napsat do #${channel.name}`}
            className="min-h-[40px] max-h-40 resize-none bg-transparent border-0 focus-visible:ring-0 p-0"
            rows={1}
          />
          <Button size="icon" onClick={send} disabled={!input.trim()} className="h-8 w-8 shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
