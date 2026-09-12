import { useEffect, useState, ReactNode } from "react";
import { Lock, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AppAuthGate } from "@/components/vox/AppAuthGate";


const LEGACY_KEYS = ["sv_download_access_v1", "sv_download_access_v2", "sv_download_access_v3"];
// Přístup platí jen pro aktuální relaci (sessionStorage) a jen pro daného uživatele.
const keyFor = (uid: string) => `sv_app_access_v4_${uid}`;

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[hsl(220_35%_4%)] holo-scanline relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--primary)/0.06)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary)/0.06)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="relative w-full max-w-md">
        <div className="holo-context-menu p-8">{children}</div>
      </div>
    </div>
  );
}

function Crest({ icon }: { icon: ReactNode }) {
  return (
    <div className="inline-flex items-center justify-center w-16 h-16 mb-4 relative">
      <div
        className="absolute inset-0 border border-primary/60 shadow-[0_0_20px_hsl(var(--primary)/0.4)]"
        style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
      />
      {icon}
    </div>
  );
}

export function AppAccessGate({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user, session, loading } = useAuth();
  const [identityChecking, setIdentityChecking] = useState(true);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [checkingIp, setCheckingIp] = useState(true);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Desktop shell nesmí odemknout aplikaci jen podle lokálně uložené session.
  // getUser() ověří aktuální access token u Supabase Auth serveru a potvrdí,
  // že relace skutečně patří stejnému účtu, který drží AuthContext.
  useEffect(() => {
    if (loading) return;
    if (!user || !session?.access_token) {
      setIdentityVerified(false);
      setIdentityChecking(false);
      return;
    }

    let cancelled = false;
    setIdentityChecking(true);

    supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (cancelled) return;
        const verified = !error && data.user?.id === user.id;
        setIdentityVerified(verified);
        if (!verified) {
          setUnlocked(false);
          void supabase.auth.signOut();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setIdentityVerified(false);
        setUnlocked(false);
        void supabase.auth.signOut();
      })
      .finally(() => {
        if (!cancelled) setIdentityChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, session?.access_token, loading]);

  // Přístup je vázaný na serverově ověřeného přihlášeného uživatele – po
  // odhlášení, vypršení nebo zneplatnění relace se zámek okamžitě vrátí.
  useEffect(() => {
    if (loading || identityChecking) return;
    try {
      // Vyčistíme všechny staré (trvalé) odemčené stavy – kód nesmí přežít odhlášení.
      for (const k of LEGACY_KEYS) localStorage.removeItem(k);
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sv_download_access_") || k.startsWith("sv_app_access_"))
        .forEach((k) => localStorage.removeItem(k));
      Object.keys(sessionStorage)
        .filter((k) => (k.startsWith("sv_download_access_") || k.startsWith("sv_app_access_")) && (!user || k !== keyFor(user.id)))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    if (!user || !identityVerified) {
      setUnlocked(false);
      return;
    }
    setUnlocked(sessionStorage.getItem(keyFor(user.id)) === "1");
  }, [user?.id, loading, identityChecking, identityVerified]);

  // Ověření podle IP – pokud z této IP už byl kód jednou použit, pustíme dál.
  // Volání proběhne až po serverovém ověření účtu, takže samotná IP nikdy
  // nenahrazuje přihlášení.
  useEffect(() => {
    if (loading || identityChecking) return;
    if (!user || !identityVerified) {
      setCheckingIp(false);
      return;
    }
    let cancelled = false;
    setCheckingIp(true);
    supabase.functions
      .invoke("app-access", { body: { action: "check" } })
      .then(({ data }) => {
        if (cancelled) return;
        if ((data as any)?.allowed) {
          sessionStorage.setItem(keyFor(user.id), "1");
          setUnlocked(true);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setCheckingIp(false));
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, identityChecking, identityVerified]);

  if (loading || identityChecking || (user && identityVerified && checkingIp && !unlocked)) {
    return (
      <Frame>
        <div className="flex items-center justify-center py-8 text-primary">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Frame>
    );
  }

  // Bez serverově ověřeného účtu se desktop shell nikdy nevykreslí.
  if (!user || !identityVerified) {
    return <AppAuthGate />;
  }

  if (unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !identityVerified) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("app-access", {
      body: { action: "redeem", code: code.trim() },
    });
    setBusy(false);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    if ((data as any)?.allowed) {
      sessionStorage.setItem(keyFor(user.id), "1");
      toast({ title: "Přístup povolen", description: "Tato IP adresa už kód příště zadávat nebude." });
      setUnlocked(true);
    } else {
      toast({ title: "Neplatný kód", description: "Zkontrolujte kód nebo požádejte o nový.", variant: "destructive" });
    }
  };


  return (
    <Frame>
      <div className="text-center mb-6">
        <Crest icon={<Lock className="w-7 h-7 text-primary relative" />} />
        <div className="text-[10px] font-display uppercase tracking-[0.32em] text-primary/70 mb-1">// SECURED · NODE</div>
        <h1 className="text-2xl font-display uppercase tracking-[0.16em] text-glow mb-2">Chráněná aplikace</h1>
        <p className="text-xs text-muted-foreground">
          Pro přístup do StudioVoxario aplikace zadejte přístupový nebo promo kód.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <div className="relative">
          <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-primary/60" />
          <Input
            placeholder="XXXX-XXXX-XXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            className="text-center font-mono tracking-[0.28em] uppercase pl-9 bg-background/40 border-primary/30 focus-visible:ring-primary/40"
          />
        </div>
        <Button
          type="submit"
          className="w-full font-display uppercase tracking-[0.22em] bg-primary/15 text-primary border border-primary/50 hover:bg-primary/25 shadow-[0_0_18px_hsl(var(--primary)/0.25)]"
          disabled={busy}
        >
          {busy ? "// OVĚŘUJI…" : "// ODEMKNOUT"}
        </Button>
      </form>
      <div className="mt-5 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
        AUTH · CHANNEL · STUDIOVOXARIO
      </div>
    </Frame>
  );
}
