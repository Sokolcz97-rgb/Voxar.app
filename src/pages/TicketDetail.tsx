import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichEditor } from "@/components/RichEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { BannedNotice } from "@/components/BannedNotice";
import { toast } from "@/hooks/use-toast";
import { RichContent } from "@/components/RichContent";
import { StatusBadge, PriorityBadge, TStatus, TPriority } from "@/components/TicketBadges";
import { Loader2, ChevronLeft, Send, EyeOff, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { moderate } from "@/lib/moderate";
import { syncTicketToDiscord } from "@/lib/ticketDiscordSync";
import { usePermissions } from "@/hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  status: TStatus;
  priority: TPriority;
  category: string | null;
  assigned_to: string | null;
  created_at: string;
}

interface Reply {
  id: string;
  user_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  author?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

const initials = (n?: string | null) => (n ?? "?").charAt(0).toUpperCase();

const TicketDetail = () => {
  const { id } = useParams();
  const { user, isAdmin, isEditor, isBanned } = useAuth();
  const { t, i18n } = useTranslation();
  const isStaff = isAdmin || isEditor;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [author, setAuthor] = useState<{ display_name: string | null; username: string | null; avatar_url: string | null } | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadAll = async () => {
    if (!id) return;
    const { data: tk } = await supabase.from("tickets").select("*").eq("id", id).maybeSingle();
    if (!tk) { setLoading(false); return; }
    setTicket(tk);

    const { data: authorProf } = await supabase
      .from("profiles").select("display_name, username, avatar_url").eq("user_id", tk.user_id).maybeSingle();
    setAuthor(authorProf);

    const { data: rs } = await supabase
      .from("ticket_replies").select("*").eq("ticket_id", id).order("created_at");

    if (rs) {
      const ids = [...new Set(rs.map((r) => r.user_id))];
      const { data: profs } = await supabase
        .from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
      const map = new Map(profs?.map((p) => [p.user_id, p]) ?? []);
      setReplies(rs.map((r) => ({ ...r, author: map.get(r.user_id) ?? null })));
    }
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [id]);

  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`ticket-${id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "ticket_replies", filter: `ticket_id=eq.${id}` },
        () => loadAll()
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "tickets", filter: `id=eq.${id}` },
        (p) => setTicket((prev) => prev ? { ...prev, ...(p.new as Ticket) } : prev)
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [id]);

  useEffect(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  }, [replies.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id || !text.trim()) return;
    setSending(true);

    // Skip AI moderation for internal staff notes
    const mod = await moderate(text.trim(), !(internal && isStaff), "ticket_reply");
    if (mod.blocked) {
      setSending(false);
      toast({ title: t("moderation.blocked"), description: mod.reason || t("moderation.blockedDesc"), variant: "destructive" });
      return;
    }
    const finalContent = mod.clean || text.trim();

    const { error } = await supabase.from("ticket_replies")
      .insert({ ticket_id: id, user_id: user.id, content: finalContent, is_internal: internal && isStaff });
    setSending(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    if (mod.flagged) toast({ title: t("moderation.filtered") });
    // Mirror to Discord (skip internal staff notes)
    if (!(internal && isStaff)) {
      void syncTicketToDiscord({ ticket_id: id, event: "reply", reply_content: finalContent });
    }
    setText(""); setInternal(false);
  };

  const updateField = async (patch: Partial<Pick<Ticket, "status" | "priority">>) => {
    if (!id) return;
    const { error } = await supabase.from("tickets").update(patch).eq("id", id);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    if (patch.status && ticket && patch.status !== ticket.status) {
      void syncTicketToDiscord({ ticket_id: id, event: "status", new_status: patch.status });
    }
  };

  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "cs-CZ";

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 max-w-4xl animate-fade-in">
        <Link to="/tickets" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" />{t("tickets.backToTickets")}
        </Link>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !ticket ? (
          <p className="text-muted-foreground">{t("tickets.ticketNotFound")}</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
              <h1 className="font-display font-black text-2xl md:text-3xl text-glow">{ticket.subject}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <PriorityBadge priority={ticket.priority} />
                <StatusBadge status={ticket.status} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-6">
              {author?.display_name || author?.username || t("common.player")}
              {ticket.category && <> · {t("tickets.categoryShort")} {ticket.category}</>}
              {" · "}{new Date(ticket.created_at).toLocaleString(locale)}
            </p>

            {isStaff && (
              <Card className="glass border-primary/30 p-4 mb-6 grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">Status</Label>
                  <Select value={ticket.status} onValueChange={(v) => updateField({ status: v as TStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">{t("tickets.status.open")}</SelectItem>
                      <SelectItem value="in_progress">{t("tickets.status.in_progress")}</SelectItem>
                      <SelectItem value="resolved">{t("tickets.status.resolved")}</SelectItem>
                      <SelectItem value="closed">{t("tickets.status.closed")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">{t("tickets.priority")}</Label>
                  <Select value={ticket.priority} onValueChange={(v) => updateField({ priority: v as TPriority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("tickets.priorities.low")}</SelectItem>
                      <SelectItem value="medium">{t("tickets.priorities.medium")}</SelectItem>
                      <SelectItem value="high">{t("tickets.priorities.high")}</SelectItem>
                      <SelectItem value="urgent">{t("tickets.priorities.urgent")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            )}

            <Card className="glass border-border p-5 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <UserAvatar url={author?.avatar_url} name={author?.display_name || author?.username} className="h-9 w-9" />
                <div>
                  <div className="font-display font-bold text-sm">{author?.display_name || author?.username || t("common.player")}</div>
                  <div className="text-[11px] text-muted-foreground uppercase tracking-widest">{t("tickets.originalMsg")}</div>
                </div>
              </div>
              <RichContent content={ticket.description} />
            </Card>

            <div className="space-y-3">
              {replies.map((r) => (
                <Card key={r.id} className={`glass p-5 animate-fade-in ${
                  r.is_internal ? "border-accent/50 bg-accent/5" : "border-border"
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <UserAvatar url={r.author?.avatar_url} name={r.author?.display_name || r.author?.username} className="h-9 w-9" />
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sm truncate">
                        {r.author?.display_name || r.author?.username || t("common.player")}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString(locale)}
                      </div>
                    </div>
                    {r.is_internal && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-accent">
                        <EyeOff className="h-3 w-3" />{t("tickets.internal")}
                      </span>
                    )}
                  </div>
                  <RichContent content={r.content} />
                </Card>
              ))}
              <div ref={bottomRef} />
            </div>

            {ticket.status !== "closed" && user && isBanned && !isStaff && (
              <div className="mt-6"><BannedNotice /></div>
            )}
            {ticket.status !== "closed" && user && (!isBanned || isStaff) && (
              <form onSubmit={send} className="mt-6 space-y-3">
                <RichEditor value={text} onChange={setText} placeholder={t("tickets.replyPlaceholder")} minHeight={140} />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {isStaff ? (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <Checkbox checked={internal} onCheckedChange={(c) => setInternal(!!c)} />
                      {t("tickets.internalNote")}
                    </label>
                  ) : <div />}
                  <Button type="submit" disabled={sending || !text.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary-glow">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />{t("forum.send")}</>}
                  </Button>
                </div>
              </form>
            )}
            {ticket.status === "closed" && (
              <Card className="glass border-border p-6 mt-6 text-center text-sm text-muted-foreground">
                {t("tickets.closed")}
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default TicketDetail;
