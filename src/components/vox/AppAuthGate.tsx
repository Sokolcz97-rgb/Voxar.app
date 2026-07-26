import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

/**
 * In-app HUD login screen. Rendered inside AppShell for unauthenticated users
 * so they never bounce to the marketing /auth page.
 */
export function AppAuthGate() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const navigate = useNavigate();

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast({ title: "Přihlášení selhalo", description: error.message, variant: "destructive" });
    navigate("/app", { replace: true });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { display_name: displayName || email.split("@")[0] },
      },
    });
    setLoading(false);
    if (error) return toast({ title: "Registrace selhala", description: error.message, variant: "destructive" });
    toast({ title: "Účet vytvořen", description: "Zkontroluj email pro potvrzení." });
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/app` });
    if (r.error) toast({ title: "Google přihlášení selhalo", description: r.error.message, variant: "destructive" });
  };

  const inputCls = "bg-background/40 border-primary/25 focus-visible:ring-primary/40 font-mono text-sm";
  const labelCls = "text-[10px] font-display uppercase tracking-[0.24em] text-primary/70";

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[hsl(220_35%_4%)] text-foreground holo-scanline relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--primary)/0.06)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary)/0.06)_1px,transparent_1px)] bg-[size:44px_44px] pointer-events-none" />
      <div className="relative w-full max-w-sm">
        <div className="holo-context-menu p-8">
          <div className="flex flex-col items-center gap-2 mb-6">
            <div className="w-14 h-14 relative flex items-center justify-center">
              <div
                className="absolute inset-0 border border-primary/60 shadow-[0_0_22px_hsl(var(--primary)/0.4)]"
                style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
              />
              <span className="relative font-display text-primary text-lg tracking-[0.18em] text-glow">SV</span>
            </div>
            <div className="text-[10px] font-display uppercase tracking-[0.32em] text-primary/70">// AUTH · GATE</div>
            <div className="text-xl font-display uppercase tracking-[0.14em] text-glow">StudioVoxario</div>
            <div className="text-[11px] text-muted-foreground uppercase tracking-widest">Přihlas se pro pokračování</div>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid grid-cols-2 w-full bg-background/40 border border-primary/20 rounded-none">
              <TabsTrigger
                value="signin"
                className="font-display uppercase tracking-[0.18em] text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))] rounded-none"
              >
                Přihlášení
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="font-display uppercase tracking-[0.18em] text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--primary))] rounded-none"
              >
                Registrace
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="e1" className={labelCls}>Email</Label>
                  <Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p1" className={labelCls}>Heslo</Label>
                  <Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full font-display uppercase tracking-[0.22em] bg-primary/15 text-primary border border-primary/50 hover:bg-primary/25 shadow-[0_0_18px_hsl(var(--primary)/0.25)]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "// ENGAGE"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="space-y-3 mt-4">
                <div className="space-y-1.5">
                  <Label htmlFor="n2" className={labelCls}>Přezdívka</Label>
                  <Input id="n2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e2" className={labelCls}>Email</Label>
                  <Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p2" className={labelCls}>Heslo</Label>
                  <Input id="p2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                </div>
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full font-display uppercase tracking-[0.22em] bg-primary/15 text-primary border border-primary/50 hover:bg-primary/25 shadow-[0_0_18px_hsl(var(--primary)/0.25)]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "// CREATE · ENTITY"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-primary/20" /></div>
            <div className="relative flex justify-center text-[9px] font-display uppercase tracking-[0.32em]">
              <span className="bg-[hsl(220_35%_4%)] px-2 text-primary/60">// ALT · CHANNEL</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full font-display uppercase tracking-[0.18em] border-primary/30 hover:border-primary/60 hover:bg-primary/10"
            onClick={google}
          >
            Pokračovat přes Google
          </Button>
        </div>
      </div>
    </div>
  );
}
