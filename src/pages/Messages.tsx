import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, Send, Plus, Search, MessageSquare, Paperclip, Sparkles, ArrowLeft, MoreVertical, Eraser, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { PresenceDot } from "@/components/PresenceDot";
import { moderate } from "@/lib/moderate";
import { BannedNotice } from "@/components/BannedNotice";
import { RichEditor, type RichEditorHandle } from "@/components/RichEditor";
import { RichContent } from "@/components/RichContent";
import { PageHero } from "@/components/PageHero";
import { cn } from "@/lib/utils";

interface Conversation {
  id: string;
  user_a: string;
  user_b: string;
  updated_at: string;
  cleared_at_a?: string | null;
  cleared_at_b?: string | null;
  hidden_at_a?: string | null;
  hidden_at_b?: string | null;
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

const stripHtml = (s?: string | null) =>
  (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const isEmptyHtml = (s: string) => !stripHtml(s);

const Messages = () => {
  const { user, isBanned } = useAuth();
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(params.get("c"));
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<
    { user_id: string; display_name: string | null; username: string | null; avatar_url: string | null }[]
  >([]);
  const [convFilter, setConvFilter] = useState("");
  const [mobileShowList, setMobileShowList] = useState(!params.get("c"));
  const [confirm, setConfirm] = useState<null | { kind: "clear" | "hide"; convId: string }>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<RichEditorHandle>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "cs-CZ";
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const formatDay = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yest = new Date(); yest.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return locale === "en-US" ? "Today" : "Dnes";
    if (sameDay(d, yest)) return locale === "en-US" ? "Yesterday" : "Včera";
    return d.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  };

  const myClearedAt = (c: Conversation): string | null =>
    !user ? null : (c.user_a === user.id ? c.cleared_at_a : c.cleared_at_b) ?? null;
  const myHiddenAt = (c: Conversation): string | null =>
    !user ? null : (c.user_a === user.id ? c.hidden_at_a : c.hidden_at_b) ?? null;

  const loadConversations = async () => {
    if (!user) return;
    const { data: convs } = await supabase
      .from("conversations").select("*")
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order("updated_at", { ascending: false });

    if (!convs) { setLoadingConvs(false); return; }

    const otherIds = convs.map((c: any) => (c.user_a === user.id ? c.user_b : c.user_a));
    const { data: profs } = await supabase
      .from("profiles").select("user_id, display_name, username, avatar_url")
      .in("user_id", otherIds.length ? otherIds : ["00000000-0000-0000-0000-000000000000"]);
    const profMap = new Map(profs?.map((p) => [p.user_id, p]) ?? []);

    const enriched: Conversation[] = await Promise.all(convs.map(async (c: any) => {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a;
      const myCleared = c.user_a === user.id ? c.cleared_at_a : c.cleared_at_b;
      let lastQ = supabase
        .from("messages").select("content, created_at")
        .eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1);
      if (myCleared) lastQ = lastQ.gt("created_at", myCleared);
      const { data: lastArr } = await lastQ;
      return { ...c, other: profMap.get(otherId) ?? null, last: lastArr?.[0] ?? null };
    }));

    // Hide chats marked hidden by me unless a newer message has arrived
    const visible = enriched.filter((c) => {
      const h = myHiddenAt(c);
      if (!h) return true;
      return c.last && new Date(c.last.created_at) > new Date(h);
    });
    setConversations(visible);
    setLoadingConvs(false);
  };

  useEffect(() => { loadConversations(); /* eslint-disable-next-line */ }, [user]);

  // Live update sidebar previews when any new message arrives
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`convs-${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        loadConversations();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [user]);

  const activeConv = useMemo(() => conversations.find((c) => c.id === activeId), [conversations, activeId]);

  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    setLoadingMsgs(true);
    const cleared = activeConv ? myClearedAt(activeConv) : null;
    let q = supabase.from("messages").select("*").eq("conversation_id", activeId).order("created_at");
    if (cleared) q = q.gt("created_at", cleared);
    q.then(({ data }) => {
      setMessages(data ?? []);
      setLoadingMsgs(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior }), 50);
    });

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
          setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
          if (user && msg.sender_id !== user.id) {
            supabase.from("messages").update({ read_at: new Date().toISOString() })
              .eq("id", msg.id).then(() => { window.dispatchEvent(new Event("messages:read")); });
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeId, user, activeConv?.cleared_at_a, activeConv?.cleared_at_b]);

  const doSend = async () => {
    if (!user || !activeId || sending) return;
    const original = text.trim();
    if (!original || isEmptyHtml(original)) return;

    setSending(true);
    setText("");
    editorRef.current?.clear();

    const mod = await moderate(original, true, "dm");
    if (mod.blocked) {
      toast({
        title: t("moderation.blocked"),
        description: mod.reason || t("moderation.blockedDesc"),
        variant: "destructive",
      });
      setText(original);
      setSending(false);
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
      setTimeout(() => editorRef.current?.focus(), 30);
    }
    setSending(false);
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    doSend();
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
    setMobileShowList(false);
    loadConversations();
  };

  const performClear = async (convId: string) => {
    const { error } = await supabase.rpc("clear_conversation_for_me", { _conv_id: convId });
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    toast({ title: locale === "en-US" ? "History cleared" : "Historie smazána" });
    if (activeId === convId) setMessages([]);
    await loadConversations();
  };

  const performHide = async (convId: string) => {
    const { error } = await supabase.rpc("hide_conversation_for_me", { _conv_id: convId });
    if (error) { toast({ title: t("common.error"), description: error.message, variant: "destructive" }); return; }
    toast({ title: locale === "en-US" ? "Chat removed" : "Chat odstraněn" });
    if (activeId === convId) { setActiveId(null); setParams({}); setMobileShowList(true); }
    await loadConversations();
  };

  const active = activeConv;

  const filteredConvs = useMemo(() => {
    const q = convFilter.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = (c.other?.display_name || c.other?.username || "").toLowerCase();
      const prev = stripHtml(c.last?.content).toLowerCase();
      return name.includes(q) || prev.includes(q);
    });
  }, [conversations, convFilter]);

  // Group messages by day & by consecutive sender
  type Block = { senderId: string; mine: boolean; items: Message[] };
  type DayGroup = { day: string; iso: string; blocks: Block[] };
  const grouped: DayGroup[] = useMemo(() => {
    const days: DayGroup[] = [];
    for (const m of messages) {
      const dayKey = new Date(m.created_at).toDateString();
      let day = days[days.length - 1];
      if (!day || day.day !== dayKey) {
        day = { day: dayKey, iso: m.created_at, blocks: [] };
        days.push(day);
      }
      const lastBlock = day.blocks[day.blocks.length - 1];
      const mine = m.sender_id === user?.id;
      if (lastBlock && lastBlock.senderId === m.sender_id) {
        lastBlock.items.push(m);
      } else {
        day.blocks.push({ senderId: m.sender_id, mine, items: [m] });
      }
    }
    return days;
  }, [messages, user?.id]);

  const isClear = confirm?.kind === "clear";
  const confirmLabels = {
    title: isClear
      ? (locale === "en-US" ? "Clear this chat history?" : "Smazat historii tohoto chatu?")
      : (locale === "en-US" ? "Remove this chat?" : "Odstranit tento chat?"),
    desc: isClear
      ? (locale === "en-US"
          ? "Messages will disappear only for you. The other person will keep their copy."
          : "Zprávy zmizí jen u tebe. Druhý uživatel je uvidí dál.")
      : (locale === "en-US"
          ? "The conversation will be hidden from your list. It will reappear only if the other person sends a new message."
          : "Konverzace se ti skryje ze seznamu. Vrátí se jen pokud ti druhý napíše."),
    action: isClear
      ? (locale === "en-US" ? "Clear history" : "Smazat historii")
      : (locale === "en-US" ? "Remove chat" : "Odstranit chat"),
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 opacity-40 pointer-events-none">
        <div className="absolute top-20 left-1/4 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute bottom-20 right-1/4 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
      </div>
      <Navbar />
      <main className="container py-6 animate-fade-in">
        <PageHero
          eyebrow={t("messages.tagline")}
          title={t("messages.title")}
          icon={MessageSquare}
          actions={
            <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" size="lg" className="bevel-3d shadow-[var(--glow-soft)]">
                  <Plus className="h-4 w-4 mr-1" />{t("messages.new")}
                </Button>
              </DialogTrigger>
              <DialogContent className="ornate-frame border-0">
                <span className="ornate-corners-bottom" />
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
          }
        />

        <div className="grid lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[560px] mt-4">
          {/* Sidebar */}
          <div className={cn(!mobileShowList && "hidden lg:block")}>
            <div className="ornate-frame runic-overlay rounded-xl flex flex-col overflow-hidden h-full relative">
              <span className="ornate-corners-bottom" />
              <div className="p-3 border-b border-primary/15 bg-background/30">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={convFilter}
                    onChange={(e) => setConvFilter(e.target.value)}
                    placeholder={t("messages.searchPlaceholder")}
                    className="pl-9 h-9 bg-background/40 border-primary/20"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {loadingConvs ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : filteredConvs.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {convFilter ? t("messages.nothingFound") : <>{t("messages.noConversations")}<br />{t("messages.startNew")}</>}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {filteredConvs.map((c) => {
                      const isActive = activeId === c.id;
                      return (
                        <li key={c.id} className="group/conv relative">
                          <button
                            onClick={() => { setActiveId(c.id); setParams({ c: c.id }); setMobileShowList(false); }}
                            className={cn(
                              "w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all duration-200",
                              isActive
                                ? "bg-gradient-to-r from-primary/25 via-primary/10 to-transparent border border-primary/50 shadow-[var(--glow-soft)]"
                                : "hover:bg-secondary/50 border border-transparent hover:border-primary/20"
                            )}
                          >
                            {c.other?.user_id ? (
                              <Link
                                to={`/profile/${c.other.user_id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="relative shrink-0"
                                aria-label={c.other.display_name || c.other.username || ""}
                              >
                                <UserAvatar
                                  url={c.other.avatar_url}
                                  name={c.other.display_name || c.other.username}
                                  className={cn(
                                    "h-11 w-11 ring-2 transition-all",
                                    isActive ? "ring-primary/60" : "ring-transparent group-hover/conv:ring-primary/30"
                                  )}
                                />
                                <PresenceDot userId={c.other.user_id} className="absolute -bottom-0.5 -right-0.5" />
                              </Link>
                            ) : (
                              <UserAvatar
                                url={c.other?.avatar_url}
                                name={c.other?.display_name || c.other?.username}
                                className="h-11 w-11"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-display font-bold truncate text-sm">
                                  {c.other?.display_name || c.other?.username || t("common.player")}
                                </div>
                                {c.last?.created_at && (
                                  <span className="text-[10px] text-muted-foreground shrink-0">
                                    {formatTime(c.last.created_at)}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground truncate pr-6">
                                {stripHtml(c.last?.content) || "—"}
                              </div>
                            </div>
                          </button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover/conv:opacity-100 focus:opacity-100 transition-opacity"
                                onClick={(e) => e.stopPropagation()}
                                aria-label={locale === "en-US" ? "Conversation options" : "Možnosti konverzace"}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => setConfirm({ kind: "clear", convId: c.id })}>
                                <Eraser className="h-4 w-4 mr-2" />
                                {locale === "en-US" ? "Clear history" : "Smazat historii"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setConfirm({ kind: "hide", convId: c.id })}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {locale === "en-US" ? "Remove chat" : "Odstranit chat"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Chat panel */}
          <div className={cn(mobileShowList && "hidden lg:block")}>
            <div className="ornate-frame runic-overlay rounded-xl flex flex-col overflow-hidden relative h-full">
              <span className="ornate-corners-bottom" />
              {!activeId ? (
                <div className="flex-1 flex items-center justify-center text-center p-6">
                  <div className="max-w-sm">
                    <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 grid place-items-center shadow-[var(--glow-intense)] panel-float">
                      <Sparkles className="h-9 w-9 text-primary" />
                    </div>
                    <h3 className="font-display text-xl font-bold mb-2 text-glow">{t("messages.selectOrStart")}</h3>
                    <p className="text-sm text-muted-foreground">{t("messages.tagline")}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="border-b border-primary/20 px-4 py-3 flex items-center gap-3 bg-gradient-to-r from-primary/10 via-background/30 to-transparent backdrop-blur-sm">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden h-9 w-9"
                      onClick={() => setMobileShowList(true)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    {active?.other?.user_id ? (
                      <Link to={`/profile/${active.other.user_id}`} className="flex items-center gap-3 group min-w-0 flex-1">
                        <div className="relative">
                          <UserAvatar
                            url={active.other.avatar_url}
                            name={active.other.display_name || active.other.username}
                            className="h-10 w-10 ring-2 ring-primary/40 group-hover:ring-primary/70 transition-all"
                          />
                          <PresenceDot userId={active.other.user_id} className="absolute -bottom-0.5 -right-0.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-display font-bold truncate group-hover:text-primary transition-colors">
                            {active.other.display_name || active.other.username || t("common.player")}
                          </div>
                          {active.other.username && (
                            <div className="text-xs text-muted-foreground">@{active.other.username}</div>
                          )}
                        </div>
                      </Link>
                    ) : (
                      <div className="font-display font-bold flex-1">{t("common.player")}</div>
                    )}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 bevel-3d" aria-label="Menu">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => setConfirm({ kind: "clear", convId: activeId! })}>
                          <Eraser className="h-4 w-4 mr-2" />
                          {locale === "en-US" ? "Clear history" : "Smazat historii"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setConfirm({ kind: "hide", convId: activeId! })}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          {locale === "en-US" ? "Remove chat" : "Odstranit chat"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Messages */}
                  <div
                    ref={scrollerRef}
                    className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-6 scroll-smooth"
                    style={{
                      backgroundImage:
                        "radial-gradient(circle at 20% 10%, hsl(var(--primary)/0.08), transparent 50%), radial-gradient(circle at 80% 90%, hsl(var(--accent)/0.06), transparent 50%)",
                    }}
                  >
                    {loadingMsgs ? (
                      <div className="flex justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : messages.length === 0 ? (
                      <p className="text-center text-sm text-muted-foreground py-10">{t("messages.beFirst")}</p>
                    ) : (
                      grouped.map((day) => (
                        <div key={day.day} className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                            <span className="text-[10px] uppercase tracking-wider text-primary/80 font-bold px-3 py-1 rounded-full bg-background/60 border border-primary/30 shadow-[0_0_12px_hsl(var(--primary)/0.25)]">
                              {formatDay(day.iso)}
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
                          </div>

                          {day.blocks.map((block, bi) => {
                            const mine = block.mine;
                            const other = active?.other;
                            return (
                              <div
                                key={bi}
                                className={cn(
                                  "flex gap-2 items-end animate-fade-in",
                                  mine ? "justify-end" : "justify-start"
                                )}
                              >
                                {!mine && (
                                  <div className="shrink-0 w-8">
                                    <UserAvatar
                                      url={other?.avatar_url}
                                      name={other?.display_name || other?.username}
                                      className="h-8 w-8"
                                    />
                                  </div>
                                )}
                                <div className={cn("flex flex-col gap-1 max-w-[78%] sm:max-w-[68%]", mine ? "items-end" : "items-start")}>
                                  {block.items.map((m, mi) => {
                                    const isFirst = mi === 0;
                                    const isLast = mi === block.items.length - 1;
                                    return (
                                      <div
                                        key={m.id}
                                        className={cn(
                                          "px-4 py-2 text-sm shadow-sm transition-all break-words relative",
                                          mine
                                            ? "bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.6)] border border-primary-glow/40"
                                            : "bg-secondary/80 backdrop-blur-sm text-secondary-foreground border border-primary/15",
                                          mine
                                            ? cn("rounded-2xl", !isFirst && "rounded-tr-md", !isLast && "rounded-br-md")
                                            : cn("rounded-2xl", !isFirst && "rounded-tl-md", !isLast && "rounded-bl-md")
                                        )}
                                      >
                                        <RichContent
                                          content={m.content}
                                          className={cn(
                                            "rich-content prose prose-sm max-w-none break-words [&_p]:my-0",
                                            mine
                                              ? "[&_*]:!text-primary-foreground [&_a]:underline"
                                              : "prose-invert"
                                          )}
                                        />
                                        {isLast && (
                                          <p className={cn(
                                            "text-[10px] mt-1 opacity-60 text-right select-none",
                                            mine ? "text-primary-foreground" : "text-muted-foreground"
                                          )}>
                                            {formatTime(m.created_at)}
                                          </p>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Composer */}
                  {isBanned ? (
                    <div className="border-t border-primary/20 p-3">
                      <BannedNotice />
                    </div>
                  ) : (
                    <form
                      onSubmit={send}
                      className="border-t border-primary/20 p-3 bg-gradient-to-t from-primary/5 to-background/30 backdrop-blur-sm"
                    >
                      <div className="relative rounded-2xl border border-primary/30 bg-background/70 backdrop-blur-md focus-within:border-primary/70 focus-within:shadow-[var(--glow-soft)] transition-all overflow-hidden">
                        <RichEditor
                          ref={editorRef}
                          value={text}
                          onChange={setText}
                          placeholder={t("messages.writeMessage")}
                          minHeight={48}
                          hideUploadButtons
                          hideToolbar
                          onEnterSubmit={doSend}
                          className="!border-0 !bg-transparent !rounded-none"
                        />
                        <div className="flex items-center justify-between gap-2 px-2 pb-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => editorRef.current?.openFilePicker()}
                            title={t("editor.file")}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Paperclip className="h-4 w-4 mr-1.5" />
                            <span className="hidden sm:inline">{t("editor.attach")}</span>
                          </Button>
                          <div className="flex items-center gap-3">
                            <span className="hidden sm:inline text-[10px] text-muted-foreground">
                              {locale === "en-US" ? "Enter to send · Shift+Enter for new line" : "Enter odešle · Shift+Enter nový řádek"}
                            </span>
                            <Button
                              type="submit"
                              disabled={!text.trim() || isEmptyHtml(text) || sending}
                              size="sm"
                              className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground hover:opacity-90 shadow-[var(--glow-soft)] rounded-full px-4"
                            >
                              {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Send className="h-4 w-4 sm:mr-1.5" />
                                  <span className="hidden sm:inline">{t("forum.send")}</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="ornate-frame border-0">
          <span className="ornate-corners-bottom" />
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmLabels.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmLabels.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{locale === "en-US" ? "Cancel" : "Zrušit"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirm) return;
                const { kind, convId } = confirm;
                setConfirm(null);
                if (kind === "clear") await performClear(convId);
                else await performHide(convId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {confirmLabels.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Messages;
