import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { StatusBadge, PriorityBadge, TStatus, TPriority } from "@/components/TicketBadges";
import { Loader2, Plus, LifeBuoy, Inbox } from "lucide-react";

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
  const { user, isAdmin, isEditor } = useAuth();
  const isStaff = isAdmin || isEditor;
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | TStatus>("all");

  // form
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
    const { error } = await supabase.from("tickets")
      .insert({ user_id: user.id, subject, description, priority, category: category || null });
    setSubmitting(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setSubject(""); setDescription(""); setPriority("medium"); setCategory("");
    toast({ title: "Ticket vytvořen" });
    load();
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Helpdesk</p>
            <h1 className="font-display font-black text-3xl md:text-4xl mt-1">
              {isStaff ? "Tickety (admin)" : "Moje tickety"}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {isStaff ? "Správa všech ticketů od uživatelů." : "Potřebuješ pomoct? Otevři ticket."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Vše</SelectItem>
                <SelectItem value="open">Otevřené</SelectItem>
                <SelectItem value="in_progress">Řeší se</SelectItem>
                <SelectItem value="resolved">Vyřešené</SelectItem>
                <SelectItem value="closed">Uzavřené</SelectItem>
              </SelectContent>
            </Select>

            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground hover:bg-primary-glow">
                  <Plus className="h-4 w-4 mr-1" />Nový ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="glass border-border max-w-lg">
                <DialogHeader><DialogTitle>Nový ticket</DialogTitle></DialogHeader>
                <form onSubmit={create} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Předmět</Label>
                    <Input required maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Priorita</Label>
                      <Select value={priority} onValueChange={(v) => setPriority(v as TPriority)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Nízká</SelectItem>
                          <SelectItem value="medium">Střední</SelectItem>
                          <SelectItem value="high">Vysoká</SelectItem>
                          <SelectItem value="urgent">Urgentní</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Kategorie (volitelné)</Label>
                      <Input placeholder="účet, fórum, bug…" value={category} onChange={(e) => setCategory(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Popis (Markdown podporován)</Label>
                    <Textarea required rows={8} value={description} onChange={(e) => setDescription(e.target.value)}
                      placeholder="**Co se děje?**&#10;Kroky k reprodukci..." className="font-mono text-sm" />
                  </div>
                  <Button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground hover:bg-primary-glow">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vytvořit"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : tickets.length === 0 ? (
          <Card className="glass border-border p-12 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Žádné tickety.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <Link key={t.id} to={`/tickets/${t.id}`}>
                <Card className="glass border-border p-5 hover:border-primary/60 transition-all flex items-center gap-4 group">
                  <LifeBuoy className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold group-hover:text-primary transition-colors truncate">
                      {t.subject}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isStaff && (t.author?.display_name || t.author?.username || "Hráč") + " · "}
                      {t.category && <>kat. {t.category} · </>}
                      {new Date(t.updated_at).toLocaleString("cs-CZ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <PriorityBadge priority={t.priority} />
                    <StatusBadge status={t.status} />
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
