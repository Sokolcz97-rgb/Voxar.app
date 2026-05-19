import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichEditor } from "@/components/RichEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { StatusBadge, PriorityBadge, TStatus, TPriority } from "@/components/TicketBadges";
import { Loader2, Plus, LifeBuoy, Inbox, Trash2 } from "lucide-react";
import { syncTicketToDiscord } from "@/lib/ticketDiscordSync";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Ticket {
  id: string;
  subject: string;
  status: TStatus;
  priority: TPriority;
  category: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  author?: { display_name: string | null; username: string | null } | null;
}

const Tickets = () => {
  const { user, isAdmin, isEditor, isBanned } = useAuth();
  const { can } = usePermissions();
  const canManage = can("tickets", "manage");
  const { t, i18n } = useTranslation();
  const isStaff = isAdmin || isEditor;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | TStatus>("all");

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TPriority>("medium");
  const [category, setCategory] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("tickets").select("*").order("updated_at", { ascending: false });
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    if (data && isStaff) {
      const ids = [...new Set(data.map((t) => t.user_id))];
      const { data: profs } = await supabase
        .from("profiles").select("user_id, display_name, username").in("user_id", ids);
      const map = new Map(profs?.map((p) => [p.user_id, p]) ?? []);
      setTickets(data.map((t) => ({ ...t, author: map.get(t.user_id) ?? null })));
    } else {
      setTickets(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [filter, isStaff]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    const { data: inserted, error } = await supabase.from("tickets")
      .insert({ user_id: user.id, subject, description, priority, category: category || null })
      .select("id")
      .maybeSingle();
    setSubmitting(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setSubject(""); setDescription(""); setPriority("medium"); setCategory("");
    toast({ title: t("tickets.created") });
    if (inserted?.id) {
      void syncTicketToDiscord({ ticket_id: inserted.id, event: "created" });
    }
    load();
  };

  const deleteResolved = async () => {
    const { data: ids, error: selErr } = await supabase
      .from("tickets")
      .select("id")
      .in("status", ["resolved", "closed"]);
    if (selErr) {
      toast({ title: t("common.error"), description: selErr.message, variant: "destructive" });
      return;
    }
    if (!ids?.length) {
      toast({ title: t("tickets.noResolvedToDelete") });
      return;
    }
    const { error } = await supabase.from("tickets").delete().in("status", ["resolved", "closed"]);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("tickets.resolvedDeleted", { count: ids.length }) });
    load();
  };

  const deleteOne = async (ticketId: string) => {
    const { error } = await supabase.from("tickets").delete().eq("id", ticketId);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: t("tickets.deleted") });
    load();
  };

  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "cs-CZ";

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">{t("tickets.tagline")}</p>
            <h1 className="font-display font-black text-3xl md:text-4xl mt-1">
              {isStaff ? t("tickets.titleStaff") : t("tickets.titleUser")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {isStaff ? t("tickets.subtitleStaff") : t("tickets.subtitleUser")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tickets.all")}</SelectItem>
                <SelectItem value="open">{t("tickets.statusFilter.open")}</SelectItem>
                <SelectItem value="in_progress">{t("tickets.statusFilter.in_progress")}</SelectItem>
                <SelectItem value="resolved">{t("tickets.statusFilter.resolved")}</SelectItem>
                <SelectItem value="closed">{t("tickets.statusFilter.closed")}</SelectItem>
              </SelectContent>
            </Select>

            {canManage && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("tickets.deleteResolved")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="glass border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("tickets.deleteResolvedTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("tickets.deleteResolvedDesc")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteResolved}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {t("common.delete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {!isBanned && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary text-primary-foreground hover:bg-primary-glow">
                    <Plus className="h-4 w-4 mr-1" />{t("tickets.newTicket")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="glass border-border max-w-2xl">
                  <DialogHeader><DialogTitle>{t("tickets.newTicket")}</DialogTitle></DialogHeader>
                  <form onSubmit={create} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("tickets.subject")}</Label>
                      <Input required maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{t("tickets.priority")}</Label>
                        <Select value={priority} onValueChange={(v) => setPriority(v as TPriority)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">{t("tickets.priorities.low")}</SelectItem>
                            <SelectItem value="medium">{t("tickets.priorities.medium")}</SelectItem>
                            <SelectItem value="high">{t("tickets.priorities.high")}</SelectItem>
                            <SelectItem value="urgent">{t("tickets.priorities.urgent")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{t("tickets.categoryOpt")}</Label>
                        <Input placeholder={t("tickets.categoryPlaceholder")} value={category} onChange={(e) => setCategory(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("tickets.descriptionMd")}</Label>
                      <RichEditor value={description} onChange={setDescription} placeholder={t("tickets.descPlaceholder")} minHeight={180} />
                    </div>
                    <Button type="submit" disabled={submitting || !description.trim()} className="w-full bg-primary text-primary-foreground hover:bg-primary-glow">
                      {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.create")}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : tickets.length === 0 ? (
          <Card className="glass border-border p-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">{t("tickets.noTickets")}</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((tk) => (
              <Link key={tk.id} to={`/tickets/${tk.id}`}>
                <Card className="glass border-border p-5 hover:border-primary/60 transition-all flex items-center gap-4 group">
                  <LifeBuoy className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold group-hover:text-primary transition-colors truncate">
                      {tk.subject}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isStaff && (tk.author?.display_name || tk.author?.username || t("common.player")) + " · "}
                      {tk.category && <>{t("tickets.categoryShort")} {tk.category} · </>}
                      {new Date(tk.updated_at).toLocaleString(locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <PriorityBadge priority={tk.priority} />
                    <StatusBadge status={tk.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Tickets;
