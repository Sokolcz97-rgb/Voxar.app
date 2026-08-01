import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { ShieldCheck, Download, Trash2, Lock, FileText, Loader2 } from "lucide-react";

const CONSENT_KEY = "vox.gdpr.consent";

type Consent = { analytics: boolean; presence: boolean; acceptedAt: string | null };

function loadConsent(): Consent {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { analytics: false, presence: true, acceptedAt: null };
}

/** GDPR panel pro Voxar.app — souhlasy, export dat a výmaz účtu. */
export function GdprPanel() {
  const { user } = useAuth();
  const [consent, setConsent] = useState<Consent>(loadConsent);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = (patch: Partial<Consent>) => {
    const next = { ...consent, ...patch, acceptedAt: new Date().toISOString() };
    setConsent(next);
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [profile, messages, memberships] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("vox_messages").select("*").eq("author_id", user.id).limit(5000),
        supabase.from("vox_guild_members").select("*").eq("user_id", user.id),
      ]);
      const payload = {
        exported_at: new Date().toISOString(),
        application: "Voxar.app",
        account: { id: user.id, email: user.email, created_at: user.created_at },
        profile: profile.data ?? null,
        messages: messages.data ?? [],
        memberships: memberships.data ?? [],
        local_consent: consent,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `voxar-app-osobni-udaje-${user.id.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export hotov", description: "Soubor s tvými daty byl stažen." });
    } catch (e: any) {
      toast({ title: "Export selhal", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (!confirm("Opravdu nenávratně smazat účet a všechna osobní data?")) return;
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-account");
    setDeleting(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <div className="space-y-5">
      <Section title="// GDPR · PŘEHLED" icon={ShieldCheck}>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Voxar.app zpracovává pouze údaje nutné k provozu: přihlašovací e-mail, profil (jméno, avatar),
          členství v sektorech, zprávy a stav přítomnosti. Data jsou uložena v EU u našeho poskytovatele
          databáze, nepředáváme je třetím stranám pro marketing a neprodáváme je.
          Právní základ: plnění smlouvy (čl. 6 odst. 1 písm. b GDPR) a oprávněný zájem na bezpečnosti provozu.
        </p>
      </Section>

      <Section title="// SOUHLASY" icon={FileText}>
        <ToggleRow
          label="Zobrazovat můj stav přítomnosti"
          hint="Ostatní uvidí, zda jsi online a v jakém hlasovém kanálu."
          val={consent.presence}
          onChange={(v) => save({ presence: v })}
        />
        <ToggleRow
          label="Anonymní diagnostika aplikace"
          hint="Nepovinné. Pomáhá odhalovat pády a chyby, bez obsahu zpráv."
          val={consent.analytics}
          onChange={(v) => save({ analytics: v })}
        />
        {consent.acceptedAt && (
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
            Naposledy potvrzeno: {new Date(consent.acceptedAt).toLocaleString("cs")}
          </div>
        )}
      </Section>

      <Section title="// E2E · ŠIFROVÁNÍ" icon={Lock}>
        <p className="text-xs text-muted-foreground leading-relaxed">
          V každém textovém kanálu můžeš zapnout end-to-end šifrování (AES-256-GCM, klíč odvozený
          přes PBKDF2 z tvé tajné fráze). Frázi zadáš ikonou zámku v hlavičce kanálu a musí ji znát
          všichni účastníci. Klíč se nikdy neodesílá na server — server ukládá pouze šifrovaný text.
        </p>
      </Section>

      <Section title="// PRÁVA SUBJEKTU ÚDAJŮ" icon={Download}>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportData} disabled={exporting} className="bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30">
            {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Stáhnout moje data
          </Button>
          <Button variant="destructive" onClick={deleteAccount} disabled={deleting}>
            {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
            Smazat účet a data
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Máš právo na přístup, opravu, výmaz, omezení zpracování a přenositelnost.
          Dotazy na ochranu osobních údajů: <span className="text-primary">privacy@studiovoxario.com</span>.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="holo-pod p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-display uppercase tracking-[0.28em] text-primary/80 text-glow">{title}</span>
      </div>
      <div className="h-px bg-gradient-to-r from-primary/50 via-primary/15 to-transparent" />
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, val, onChange }: { label: string; hint?: string; val: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <div className="text-sm text-foreground">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <Switch checked={val} onCheckedChange={onChange} />
    </div>
  );
}
