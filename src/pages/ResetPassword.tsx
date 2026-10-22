import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Gamepad2, Loader2, MailCheck, KeyRound } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

/**
 * Obnova hesla ve dvou krocích:
 * 1) zadání e-mailu → Supabase pošle odkaz pro obnovení,
 * 2) po kliknutí na odkaz (událost PASSWORD_RECOVERY) nastavení nového hesla.
 * Stejné heslo pak platí na webu, v aplikaci i ve hře Ashes of Eryon.
 */
const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { settings } = useSiteSettings();
  const siteName = settings.site_name || "StudioVoxario";
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const urlLooksLikeRecovery = /type=recovery/.test(window.location.hash) || searchParams.has("code");
  const [recovery, setRecovery] = useState(urlLooksLikeRecovery);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const requestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Odkaz se nepodařilo odeslat", description: error.message, variant: "destructive" });
      return;
    }
    // Z bezpečnostních důvodů neprozrazujeme, jestli účet s tímto e-mailem existuje.
    setSent(true);
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "Heslo je příliš krátké", description: "Použij aspoň 6 znaků.", variant: "destructive" });
      return;
    }
    if (password !== password2) {
      toast({ title: "Hesla se neshodují", description: "Zadej stejné heslo do obou polí.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({
        title: "Heslo se nepodařilo změnit",
        description: /session|expired|invalid/i.test(error.message)
          ? "Odkaz už vypršel nebo byl použit. Požádej o nový."
          : error.message,
        variant: "destructive",
      });
      return;
    }
    setDone(true);
    toast({ title: "Heslo změněno", description: "Teď se s ním přihlásíš na webu, v aplikaci i ve hře." });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-40" />
      <div className="fixed top-1/3 left-1/4 w-96 h-96 rounded-full bg-primary/25 blur-[120px] animate-float-slow" />

      <div className="w-full max-w-md animate-scale-in">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
          <Gamepad2 className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
          <span className="font-display font-bold text-2xl tracking-widest text-glow">{siteName}</span>
        </Link>

        <div className="glass rounded-2xl p-8 border-glow">
          {recovery ? (
            done ? (
              <div className="space-y-4 text-center">
                <KeyRound className="h-10 w-10 mx-auto text-primary" />
                <h1 className="font-display text-xl font-bold">Heslo je změněné</h1>
                <p className="text-sm text-muted-foreground">
                  Nové heslo platí pro web, desktopovou aplikaci i hru Ashes of Eryon.
                </p>
                <Button className="w-full" onClick={() => navigate("/dashboard")}>Pokračovat na účet</Button>
              </div>
            ) : (
              <form onSubmit={savePassword} className="space-y-4">
                <div>
                  <h1 className="font-display text-xl font-bold">Nastav nové heslo</h1>
                  <p className="text-sm text-muted-foreground mt-1">Zvol heslo, které jinde nepoužíváš. Aspoň 6 znaků.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-new">Nové heslo</Label>
                  <Input id="pw-new" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw-new2">Nové heslo znovu</Label>
                  <Input id="pw-new2" type="password" autoComplete="new-password" required minLength={6} value={password2} onChange={(e) => setPassword2(e.target.value)} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary-glow">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložit nové heslo"}
                </Button>
              </form>
            )
          ) : sent ? (
            <div className="space-y-4 text-center">
              <MailCheck className="h-10 w-10 mx-auto text-primary" />
              <h1 className="font-display text-xl font-bold">Zkontroluj e-mail</h1>
              <p className="text-sm text-muted-foreground">
                Pokud u nás účet s adresou <span className="text-foreground">{email.trim()}</span> existuje, poslali jsme na ni
                odkaz pro nastavení nového hesla. Odkaz platí omezenou dobu. Nepřišel? Podívej se i do spamu.
              </p>
              <Button variant="outline" className="w-full" onClick={() => setSent(false)}>Poslat znovu</Button>
            </div>
          ) : (
            <form onSubmit={requestLink} className="space-y-4">
              <div>
                <h1 className="font-display text-xl font-bold">Zapomenuté heslo</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Zadej e-mail svého účtu a pošleme ti odkaz pro nastavení nového hesla. Hodí se i když se přihlašuješ přes
                  Google nebo Discord a chceš heslo pro hru.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-reset">E-mail</Label>
                <Input id="email-reset" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="player@example.com" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground hover:bg-primary-glow">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Poslat odkaz"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/auth" className="hover:text-primary transition-colors">Zpět na přihlášení</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
