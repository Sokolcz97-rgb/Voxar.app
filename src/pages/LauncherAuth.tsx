import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Gamepad2, Loader2, MonitorCheck, ShieldCheck, ShieldX, UserRound } from "lucide-react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

/**
 * Přihlášení launcheru Ashes of Eryon účtem StudioVoxario.
 * Launcher otevře tuto stránku v prohlížeči (state, challenge, port). Přihlášený hráč potvrdí,
 * web vydá jednorázový kód a předá ho launcheru přes http://127.0.0.1:<port>/callback.
 * Heslo ani relace webu se do launcheru nikdy nedostanou.
 */
const STORE = "voxario.launcherAuth";
const B64URL = /^[A-Za-z0-9_-]{16,128}$/;

type Request = { state: string; challenge: string; port: number; device: string; t: number };

function readRequest(params: URLSearchParams): Request | null {
  const state = params.get("state") ?? "";
  const challenge = params.get("challenge") ?? "";
  const port = Number(params.get("port"));
  if (B64URL.test(state) && B64URL.test(challenge) && Number.isInteger(port) && port >= 1024 && port <= 65535) {
    const req = { state, challenge, port, device: (params.get("device") ?? "").slice(0, 60), t: Date.now() };
    try { localStorage.setItem(STORE, JSON.stringify(req)); } catch { /* soukromý režim */ }
    return req;
  }
  // návrat z přihlášení (Google / Discord / e-mail) – požadavek launcheru je uložený
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as Request | null;
    if (saved && Date.now() - saved.t < 15 * 60_000) return saved;
  } catch { /* neplatná data */ }
  return null;
}

const LauncherAuth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const { settings } = useSiteSettings();
  const siteName = settings.site_name || "StudioVoxario";
  const request = useMemo(() => readRequest(params), [params]);
  const [name, setName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"ok" | "denied" | null>(null);

  useEffect(() => {
    if (loading || !request) return;
    if (!user) navigate("/auth?next=/game/auth/launcher", { replace: true });
  }, [loading, user, request, navigate]);

  useEffect(() => {
    if (!user) return;
    void supabase.from("profiles").select("display_name, username").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setName(data?.display_name || data?.username || user.email || ""));
  }, [user]);

  const finish = (query: string, result: "ok" | "denied") => {
    try { localStorage.removeItem(STORE); } catch { /* nic */ }
    setDone(result);
    window.location.href = `http://127.0.0.1:${request!.port}/callback?${query}&state=${encodeURIComponent(request!.state)}`;
  };

  const approve = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.functions.invoke("launcher-auth", {
      body: { action: "start", challenge: request.challenge, device: request.device || "Windows" },
    });
    setBusy(false);
    if (err || !data?.code) {
      setError(data?.error || "Přihlášení se nepodařilo. Zkus to v launcheru znovu.");
      return;
    }
    finish(`code=${encodeURIComponent(data.code)}`, "ok");
  };

  const switchAccount = async () => {
    await supabase.auth.signOut();
    navigate("/auth?next=/game/auth/launcher", { replace: true });
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
          {!request ? (
            <div className="space-y-4 text-center">
              <ShieldX className="h-10 w-10 mx-auto text-destructive" />
              <h1 className="font-display text-xl font-bold">Odkaz pro launcher vypršel</h1>
              <p className="text-sm text-muted-foreground">
                Tuhle stránku otevírá launcher Ashes of Eryon. V launcheru klikni znovu na <b>Přihlásit se</b>.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/desktop#ashes")}>Stáhnout launcher</Button>
            </div>
          ) : done ? (
            <div className="space-y-4 text-center">
              {done === "ok" ? <MonitorCheck className="h-10 w-10 mx-auto text-primary" /> : <ShieldX className="h-10 w-10 mx-auto text-muted-foreground" />}
              <h1 className="font-display text-xl font-bold">{done === "ok" ? "Hotovo – vrať se do launcheru" : "Přihlášení zamítnuto"}</h1>
              <p className="text-sm text-muted-foreground">
                {done === "ok" ? "Launcher je přihlášený. Tohle okno prohlížeče můžeš zavřít." : "Launcher přihlášený nebyl. Okno můžeš zavřít."}
              </p>
            </div>
          ) : loading || !user ? (
            <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-5">
              <div className="text-center space-y-2">
                <ShieldCheck className="h-10 w-10 mx-auto text-primary" />
                <h1 className="font-display text-xl font-bold">Přihlásit launcher Ashes of Eryon?</h1>
                <p className="text-sm text-muted-foreground">
                  Launcher {request.device ? <>na zařízení <b className="text-foreground">{request.device}</b> </> : null}
                  žádá o přístup k tvému účtu. Potvrď jen tehdy, když jsi ho právě spustil ty.
                </p>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                  <UserRound className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{name || "…"}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <button type="button" onClick={switchAccount} className="text-xs text-muted-foreground hover:text-primary">Jiný účet</button>
              </div>

              <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
                <li>Launcher uvidí tvé jméno a bude moct spustit hru pod tvým účtem.</li>
                <li>Heslo launcher nikdy nedostane. Odhlásit ho můžeš kdykoli přímo v něm.</li>
              </ul>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" disabled={busy} onClick={() => finish("error=denied", "denied")}>Zamítnout</Button>
                <Button disabled={busy} onClick={approve} className="bg-primary text-primary-foreground hover:bg-primary-glow">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Povolit"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LauncherAuth;
