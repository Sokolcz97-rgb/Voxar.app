import { useState, ReactNode } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const ACCESS_KEY = "sv_download_access_v1";

export function AppAccessGate({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [unlocked, setUnlocked] = useState<boolean>(
    () => typeof window !== "undefined" && localStorage.getItem(ACCESS_KEY) === "1",
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("redeem_download_code", { _code: code.trim() });
    setBusy(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    if (data === true) {
      localStorage.setItem(ACCESS_KEY, "1");
      toast({ title: "Přístup povolen" });
      setUnlocked(true);
    } else {
      toast({ title: "Neplatný kód", description: "Zkontrolujte kód nebo požádejte o nový.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Chráněná aplikace</h1>
          <p className="text-sm text-muted-foreground">
            Pro přístup do StudioVoxario aplikace zadejte přístupový nebo promo kód.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <Input
            placeholder="Zadejte kód"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            className="text-center font-mono tracking-wider"
          />
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Ověřuji…" : "Odemknout"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
