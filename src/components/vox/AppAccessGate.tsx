import { useEffect, useState, ReactNode } from "react";
import { Lock, KeyRound, LogIn, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const LEGACY_KEYS = ["sv_download_access_v1"];
// Přístup platí jen pro aktuální relaci (sessionStorage) a jen pro daného uživatele.
const keyFor = (uid: string) => `sv_download_access_v3_${uid}`;

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
  const { user, loading } = useAuth();
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  // Přístup je vázaný na přihlášeného uživatele – po odhlášení se zámek vrátí.
  useEffect(() => {
    try {
      // Vyčistíme všechny staré (trvalé) odemčené stavy – kód nesmí přežít odhlášení.
      for (const k of LEGACY_KEYS) localStorage.removeItem(k);
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sv_download_access_"))
        .forEach((k) => localStorage.removeItem(k));
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith("sv_download_access_") && (!user || k !== keyFor(user.id)))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    if (!user) {
      setUnlocked(false);
      return;
    }
    setUnlocked(sessionStorage.getItem(keyFor(user.id)) === "1");
  }, [user?.id]);

  if (loading) {
    return (
      <Frame>
        <div className="flex items-center justify-center py-8 text-primary">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </Frame>
    );
  }

  if (!user) {
    return (
      <Frame>
        <div className="text-center">
          <Crest icon={<LogIn className="w-7 h-7 text-primary relative" />} />
          <div className="text-[10px] font-display uppercase tracking-[0.32em] text-primary/70 mb-1">// SESSION · OFFLINE</div>
          <h1 className="text-2xl font-display uppercase tracking-[0.16em] text-glow mb-2">Nejste přihlášen</h1>
          <p className="text-xs text-muted-foreground mb-6">
            Přístup do StudioVoxario aplikace je vázán na přihlášený účet. Přihlaste se a poté zadejte svůj přístupový nebo
            promo kód.
          </p>
          <Button
            asChild
            className="w-full font-display uppercase tracking-[0.22em] bg-primary/15 text-primary border border-primary/50 hover:bg-primary/25 shadow-[0_0_18px_hsl(var(--primary)/0.25)]"
          >
            <Link to="/auth">// PŘIHLÁSIT SE</Link>
          </Button>
          <div className="mt-5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70">
            AUTH · CHANNEL · STUDIOVOXARIO
          </div>
        </div>
      </Frame>
    );
  }

  if (unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_download_code", { _code: code.trim() });
    setBusy(false);
    if (error) return toast({ title: "Chyba", description: error.message, variant: "destructive" });
    if (data === true) {
      localStorage.setItem(keyFor(user.id), "1");
      toast({ title: "Přístup povolen" });
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
