import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Loader2, MessageSquare } from "lucide-react";

/**
 * In-app login screen shown inside AppShell when the user is not signed in.
 * Keeps the Discord-like dark app chrome instead of redirecting to the
 * marketing /auth page (which non-tech visitors mistook for "another site").
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
    // Zůstáváme uvnitř React Routeru – žádný window.location reload, žádná
    // ztráta AuthContextu. AppShell se okamžitě přerenderuje jakmile
    // onAuthStateChange nastaví user, a tenhle navigate garantuje, že jsme
    // pořád na /app (kdyby nás cokoli přesměrovalo jinam).
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

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background text-foreground">
      <div className="w-full max-w-sm p-8 rounded-xl bg-card border border-border/60 shadow-xl">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-primary" />
          </div>
          <div className="text-xl font-bold">StudioVoxario</div>
          <div className="text-xs text-muted-foreground">Přihlas se pro pokračování</div>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="signin">Přihlášení</TabsTrigger>
            <TabsTrigger value="signup">Registrace</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={signIn} className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="e1">Email</Label>
                <Input id="e1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p1">Heslo</Label>
                <Input id="p1" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Přihlásit se"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signUp} className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="n2">Přezdívka</Label>
                <Input id="n2" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e2">Email</Label>
                <Input id="e2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p2">Heslo</Label>
                <Input id="p2" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vytvořit účet"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
            <span className="bg-card px-2 text-muted-foreground">nebo</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={google}>
          Pokračovat přes Google
        </Button>
      </div>
    </div>
  );
}
