import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, Plus, Search, MessageSquare, Paperclip } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { PresenceDot } from "@/components/PresenceDot";
import { moderate } from "@/lib/moderate";
import { BannedNotice } from "@/components/BannedNotice";
import { RichEditor, type RichEditorHandle } from "@/components/RichEditor";
import { RichContent } from "@/components/RichContent";

interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  updated_at: string;
  other?: { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null } | null;
  last?: { content: string; created_at: string } | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

const initials = (n?: string | null) => (n ?? "?").charAt(0).toUpperCase();
const stripHtml = (s?: string | null) => (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const Messages = () => {
  const { user, isBanned } = useAuth();
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(params.get("c"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichEditorHandle>(null);

  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "cs-CZ";
  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  const loadConversations = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations").select("*")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (!convs) { setLoadingConvs(false); return; }

    const otherIds = convs.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
    const { data: profs } = await supabase
      .from("profiles").select("user_id, display_name, username, avatar_url")
      .in("user_id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
    const profMap = new Map(profs?.map((p) => [p.user_id, p]) ?? []);

    const enriched = await Promise.all(convs.map(async (c) => {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
      const { data: lastArr } = await supabase
        .from("messages").select("content, created_at")
        .eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1);
      return { ...c, other: profMap.get(otherId) ?? null, last: lastArr?.[0] ?? null };
    }));
    setConversations(enriched);
    setLoadingConvs(false);
  };

  useEffect(() => { loadConversations(); /* eslint-disable-next-line */ }, [user]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setLoadingMsgs(true);
    supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at")
      .then(({ data }) => {
        setMessages(data ?? []);
        setLoadingMsgs(false);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior }), 50);
      });

    // mark incoming messages as read
    if (user) {
      supabase.from("messages").update({ read_at: new Date().toISOString() })
        .eq("conversation_id", activeId).neq("sender_id", user.id).is("read_at", null)
        .then(() => { window.dispatchEvent(new Event("messages:read")); });
    }

    const channel = supabase
      .channel(`msgs-${activeId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => [...prev, msg]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          // auto-mark as read if not from me
          if (user && msg.sender_id !== user.id) {
            supabase.from("messages").update({ read_at: new Date().toISOString() })
              .eq("id", msg.id).then(() => { window.dispatchEvent(new Event("messages:read")); });
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeId, user]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeId || !text.trim()) return;
    const original = text.trim();
    setText("");

    const mod = await moderate(original, true, "dm");
    if (mod.blocked) {
      toast({ title: t("moderation.blocked"), description: mod.reason || t("moderation.blockedDesc"), variant: "destructive" });
      setText(original);
      return;
    }
    const finalContent = mod.clean || original;

    const { error } = await supabase.from("messages")
      .insert({ conversation_id: activeId, sender_id: user.id, content: finalContent });
    if (error) {
      toast({ title: t("messages.sendFailed"), description: error.message, variant: "destructive" });
      setText(original);
    } else {
      if (mod.flagged) toast({ title: t("moderation.filtered") });
      loadConversations();
    }
  };

  useEffect(() => {
    if (!searchOpen || !search.trim()) { setSearchResults([]); return; }
    const tm = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles").select("user_id, display_name, username, avatar_url")
        .or(`display_name.ilike.%${search}%,username.ilike.%${search}%`)
        .neq("user_id", user?.id ?? "")
        .limit(10);
      setSearchResults(data ?? []);
    }, 200);
    return () => clearTimeout(tm);
  }, [search, searchOpen, user]);

  const startConversation = async (otherId: string) => {
    const { data, error } = await supabase.rpc("get_or_create_conversation", { _other_user: otherId });
    if (error || !data) {
      toast({ title: t("common.error"), description: error?.message, variant: "destructive" });
      return;
    }
    setSearchOpen(false);
    setSearch(""); setSearchResults([]);
    setActiveId(data as string);
    setParams({ c: data as string });
    loadConversations();
  };

  const active = conversations.find((c) => c.id === activeId);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-6 animate-fade-in">
        <div className="flex items-baseline justify-between mb-6 gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">{t("messages.tagline")}</p>
            <h1 className="font-display font-black text-3xl md:text-4xl mt-1">{t("messages.title")}</h1>
          </div>
          <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary-glow">
                <Plus className="h-4 w-4 mr-1" />{t("messages.new")}
              </Button>
            </DialogTrigger>
            <DialogContent className="glass border-border">
              <DialogHeader><DialogTitle>{t("messages.findUser")}</DialogTitle></DialogHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("messages.searchPlaceholder")} className="pl-9" autoFocus />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {searchResults.map((r) => (
                  <button key={r.user_id} onClick={() => startConversation(r.user_id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/60 transition-colors text-left">
                    <UserAvatar url={r.avatar_url} name={r.display_name || r.username} className="h-9 w-9" />
                    <div className="min-w-0">
                      <div className="font-display font-bold truncate">{r.display_name || r.username}</div>
                      {r.username && <div className="text-xs text-muted-foreground truncate">@{r.username}</div>}
                    </div>
                  </button>
                ))}
                {search && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">{t("messages.nothingFound")}</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[500px]">
          <Card className="glass border-border p-2 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-10 px-4">
                <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("messages.noConversations")}<br />{t("messages.startNew")}</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => { setActiveId(c.id); setParams({ c: c.id }); }}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                        activeId === c.id ? "bg-primary/15 border border-primary/40" : "hover:bg-secondary/50"
                      }`}>
                      {c.other?.user_id ? (
                        <Link
                          to={`/profile/${c.other.user_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="relative shrink-0 group"
                          aria-label={c.other.display_name || c.other.username || ""}
                        >
                          <UserAvatar url={c.other.avatar_url} name={c.other.display_name || c.other.username} className="h-10 w-10 group-hover:ring-2 group-hover:ring-primary/50 transition-all" />
                          <PresenceDot userId={c.other.user_id} className="absolute -bottom-0.5 -right-0.5" />
                        </Link>
                      ) : (
                        <div className="relative shrink-0">
                          <UserAvatar url={c.other?.avatar_url} name={c.other?.display_name || c.other?.username} className="h-10 w-10" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-bold truncate">{c.other?.display_name || c.other?.username || t("common.player")}</div>
                        <div className="text-xs text-muted-foreground truncate">{stripHtml(c.last?.content) || "—"}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="glass border-border flex flex-col overflow-hidden">
            {!activeId ? (
              <div className="flex-1 flex items-center justify-center text-center p-6">
                <div>
                  <MessageSquare className="h-12 w-12 text-primary/40 mx-auto mb-3" />
                  <p className="text-muted-foreground">{t("messages.selectOrStart")}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="border-b border-border px-5 py-3 flex items-center gap-3">
                  {active?.other?.user_id ? (
                    <Link to={`/profile/${active.other.user_id}`} className="flex items-center gap-3 group min-w-0">
                      <div className="relative">
                        <UserAvatar url={active.other.avatar_url} name={active.other.display_name || active.other.username} className="h-9 w-9 group-hover:ring-2 group-hover:ring-primary/50 transition-all" />
                        <PresenceDot userId={active.other.user_id} className="absolute -bottom-0.5 -right-0.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-display font-bold truncate group-hover:text-primary transition-colors">{active.other.display_name || active.other.username || t("common.player")}</div>
                        {active.other.username && <div className="text-xs text-muted-foreground">@{active.other.username}</div>}
                      </div>
                    </Link>
                  ) : (
                    <div className="font-display font-bold">{t("common.player")}</div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {loadingMsgs ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-10">{t("messages.beFirst")}</p>
                  ) : (
                    messages.map((m) => {
                      const mine = m.sender_id === user?.id;
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} animate-fade-in`}>
                          <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                            mine ? "bg-primary text-black rounded-br-sm shadow-[var(--glow-soft)]"
                                 : "bg-secondary text-secondary-foreground rounded-bl-sm"
                          }`}>
                            <RichContent
                              content={m.content}
                              className={`rich-content prose prose-sm max-w-none break-words [&_p]:my-0 ${
                                mine
                                  ? "text-black [&_*]:!text-black [&_a]:!text-black [&_a]:underline"
                                  : "prose-invert"
                              }`}
                            />
                            <p className={`text-[10px] mt-1 opacity-70`}>{formatTime(m.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {isBanned ? (
                  <div className="border-t border-border p-3">
                    <BannedNotice />
                  </div>
                ) : (
                  <form onSubmit={send} className="border-t border-border p-3 space-y-2">
                    <RichEditor value={text} onChange={setText} placeholder={t("messages.writeMessage")} minHeight={60} />
                    <div className="flex justify-end">
                      <Button type="submit" disabled={!text.trim()} className="bg-primary text-primary-foreground hover:bg-primary-glow">
                        <Send className="h-4 w-4 mr-2" />{t("forum.send")}
                      </Button>
                    </div>
                  </form>
                )}
              </>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Messages;
