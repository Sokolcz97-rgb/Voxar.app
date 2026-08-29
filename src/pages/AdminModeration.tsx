import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ArrowLeft, Shield, ShieldAlert, Loader2, RefreshCw, Trash2, CalendarClock } from "lucide-react";

interface LogRow {
  id: string;
  user_id: string | null;
  source: string;
  action: string;
  reason: string | null;
  original: string;
  result: string | null;
  created_at: string;
}

interface ProfileLite {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

const AdminModeration = () => {
  const { t, i18n } = useTranslation();
  const { isAdmin, isEditor } = useAuth();
  const isStaff = isAdmin || isEditor;
  const [rows, setRows] = useState<LogRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(false);
  const [purging, setPurging] = useState(false);
  const [confirm, setConfirm] = useState<null | "old" | "all">(null);

  const purge = async (mode: "old" | "all") => {
    setPurging(true);
    let q = supabase.from("moderation_log").delete({ count: "exact" });
    if (mode === "old") {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      q = q.lt("created_at", cutoff);
    } else {
      q = q.gte("created_at", "1970-01-01");
    }
    const { error, count } = await q;
    setPurging(false);
    setConfirm(null);
    if (error) {
      toast.error(t("moderationLog.deleteError"));
      return;
    }
    toast.success(t("moderationLog.deleted", { count: count ?? 0 }));
    load();
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("moderation_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    const list = (data ?? []) as LogRow[];
    setRows(list);
    const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("user_id, display_name, username").in("user_id", ids);
      const map: Record<string, ProfileLite> = {};
      (profs ?? []).forEach((p) => { map[p.user_id] = p as ProfileLite; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isStaff) load();
  }, [isStaff]);

  if (!isStaff) {
    return (
      <div className="min-h-screen relative">
        <div className="fixed inset-0 -z-10 gradient-hero" />
        <Navbar />
        <main className="container py-10">
          <Card className="glass border-border p-10 text-center">
            <Shield className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h2 className="font-display font-bold text-2xl">{t("moderationLog.staffOnly")}</h2>
          </Card>
        </main>
      </div>
    );
  }

  const formatDate = (s: string) =>
    new Date(s).toLocaleString(i18n.language === "cs" ? "cs-CZ" : "en-US");

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <Link to="/admin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>

        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">{t("moderationLog.section")}</p>
            <h1 className="font-display font-black text-3xl md:text-4xl mt-2 flex items-center gap-3">
              <ShieldAlert className="h-8 w-8 text-primary" /> {t("moderationLog.title")}
            </h1>
            <p className="text-muted-foreground mt-2">{t("moderationLog.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={load} disabled={loading} className="border-border">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {t("common.refresh")}
            </Button>
            <Button variant="outline" onClick={() => setConfirm("old")} disabled={purging} className="border-border">
              <CalendarClock className="h-4 w-4 mr-2" />
              {t("moderationLog.purgeOld")}
            </Button>
            <Button variant="destructive" onClick={() => setConfirm("all")} disabled={purging}>
              {purging ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t("moderationLog.purgeAll")}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && !loading && (
            <Card className="glass border-border p-10 text-center text-muted-foreground">
              {t("moderationLog.empty")}
            </Card>
          )}
          {rows.map((r) => {
            const prof = r.user_id ? profiles[r.user_id] : null;
            const name = prof?.display_name || prof?.username || (r.user_id ? `${r.user_id.slice(0, 8)}…` : "—");
            return (
              <Card key={r.id} className="glass border-border p-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge variant={r.action === "blocked" ? "destructive" : "secondary"}>
                    {t(`moderationLog.actions.${r.action}`, { defaultValue: r.action })}
                  </Badge>
                  <Badge variant="outline" className="border-border">
                    {t(`moderationLog.sources.${r.source}`, { defaultValue: r.source })}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(r.created_at)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">{t("moderationLog.user")}: </span>
                  <span className="font-display">{name}</span>
                  {r.reason && (
                    <span className="text-muted-foreground"> — {r.reason}</span>
                  )}
                </div>
                <div className="mt-2 grid sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t("moderationLog.original")}</div>
                    <div className="font-mono text-xs bg-background/50 border border-border rounded p-2 whitespace-pre-wrap break-words">
                      {r.original}
                    </div>
                  </div>
                  {r.result && (
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">{t("moderationLog.result")}</div>
                      <div className="font-mono text-xs bg-background/50 border border-border rounded p-2 whitespace-pre-wrap break-words">
                        {r.result}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="glass border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "old" ? t("moderationLog.confirmOldTitle") : t("moderationLog.confirmAllTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("moderationLog.confirmDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", { defaultValue: "Zrušit" })}</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && purge(confirm)} disabled={purging}>
              {t("moderationLog.purgeAll")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default AdminModeration;
