import { useEffect, useState } from "react";
import { Download as DownloadIcon, Monitor, Info, Shield, Bell, Package, RefreshCw, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import winInstaller from "@/assets/downloads/windows-installer.asset.json";
import winAsset from "@/assets/downloads/windows.asset.json";
import linuxAsset from "@/assets/downloads/linux.asset.json";

const ACCESS_KEY = "sv_download_access_v1";

const features = [
  { icon: Bell, title: "Desktop notifikace", desc: "Zprávy, zakázky a stream alerty přímo v systému." },
  { icon: Package, title: "Tray & minimalizace", desc: "Aplikace tiše běží v systémové liště." },
  { icon: RefreshCw, title: "Auto-start s OS", desc: "Volitelně startuje s Windows/Linuxem." },
  { icon: Shield, title: "Vlastní okno", desc: "Bez URL řádku – vypadá a chová se jako Discord." },
];

function AccessGate({ onUnlock }: { onUnlock: () => void }) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

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
      onUnlock();
    } else {
      toast({ title: "Neplatný kód", description: "Zkontrolujte kód nebo požádejte o nový.", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-md">
        <Card className="p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Chráněná stránka</h1>
            <p className="text-sm text-muted-foreground">
              Ke stažení desktop aplikace zadejte přístupový nebo promo kód.
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
    </div>
  );
}

export default function Download() {
  const [unlocked, setUnlocked] = useState<boolean>(() => localStorage.getItem(ACCESS_KEY) === "1");

  useEffect(() => {
    if (unlocked) localStorage.setItem(ACCESS_KEY, "1");
  }, [unlocked]);

  if (!unlocked) return <AccessGate onUnlock={() => setUnlocked(true)} />;

  const downloads = [
    {
      os: "Windows 10 / 11",
      file: winInstaller.url,
      filename: "StudioVoxarioSetup-0.0.9-alpha.exe",
      note: "Vlastní HUD instalátor – bez klasického Windows okna, bez UAC, bez cmd.",
      icon: "🪟",
      size: "~90 MB · v0.0.9-alpha",
      primary: true,
    },
    {
      os: "Windows (přenosná ZIP)",
      file: winAsset.url,
      filename: "StudioVoxario-win32-x64.zip",
      note: "Bez instalace – rozbalte a spusťte StudioVoxario.exe.",
      icon: "📦",
      size: "~106 MB · v0.0.9-alpha",
    },
    {
      os: "Linux (x64)",
      file: linuxAsset.url,
      filename: "StudioVoxario-linux-x64-0.0.9-alpha.tar.gz",
      note: "tar xzf StudioVoxario-linux-x64-0.0.9-alpha.tar.gz && ./StudioVoxario-linux-x64/StudioVoxario",
      icon: "🐧",
      size: "~109 MB · v0.0.9-alpha",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 mb-6 icon-cube-3d">
            <Monitor className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            StudioVoxario <span className="text-primary text-glow">pro počítač</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Nativní desktop klient s vlastním HUD instalátorem, notifikacemi, tray ikonou a auto-startem.
            Zvolte si kanál aktualizací – Stable pro stabilní verze, Beta pro nejnovější Alpha buildy.
          </p>

          <Button
            size="xl"
            variant="hero"
            className="btn-3d group relative overflow-hidden"
            asChild
          >
            <a href={winInstaller.url} download={winInstaller.original_filename || "StudioVoxarioSetup.exe"}>
              <DownloadIcon className="h-5 w-5 mr-2 group-hover:animate-bounce" />
              <span className="bg-gradient-to-r from-foreground via-primary to-primary-glow bg-clip-text text-transparent">
                Stáhnout pro Windows
              </span>
            </a>
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            {winInstaller.original_filename || "StudioVoxarioSetup.exe"} · v0.0.9-alpha
          </p>

          <button
            className="mt-4 text-xs text-muted-foreground underline hover:text-foreground"
            onClick={() => {
              localStorage.removeItem(ACCESS_KEY);
              setUnlocked(false);
            }}
          >
            Odhlásit přístupový kód
          </button>
        </div>

        <Tabs defaultValue="stable" className="mb-10">
          <TabsList className="grid grid-cols-2 w-full max-w-sm mx-auto mb-6">
            <TabsTrigger value="stable" className="gap-2">
              <Shield className="w-4 h-4" /> Stable
            </TabsTrigger>
            <TabsTrigger value="beta" className="gap-2">
              <Sparkles className="w-4 h-4" /> Beta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stable">
            <p className="text-center text-sm text-muted-foreground mb-6">
              Ověřené vydané verze. Doporučeno pro každodenní použití.
            </p>
            <div className="grid md:grid-cols-3 gap-4">
              {downloads.map((d) => (
                <Card key={d.os} className={`p-6 transition-colors ${d.primary ? "border-primary/60 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.5)]" : "hover:border-primary/50"}`}>
                  <div className="flex items-start gap-4">
                    <div className="text-4xl">{d.icon}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg mb-1">{d.os}</h3>
                      <p className="text-sm text-muted-foreground mb-1">{d.note}</p>
                      <p className="text-xs text-muted-foreground mb-4">{d.size}</p>
                      <Button asChild className="w-full" variant={d.primary ? "default" : "outline"}>
                        <a href={d.file} download={d.filename}>
                          <DownloadIcon className="w-4 h-4 mr-2" />
                          {d.primary ? "Stáhnout instalátor" : "Stáhnout"}
                        </a>
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="beta">
            <Card className="p-8 text-center max-w-xl mx-auto">
              <Sparkles className="w-10 h-10 text-primary mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Beta kanál</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Beta buildy stahujte stejným instalátorem jako Stable – po instalaci
                přepnete kanál přímo v launcheru (<b>Diagnostika → Kanál</b>) nebo
                v aplikaci (<b>Nastavení → Aktualizace</b>). Přepnutí vyžaduje
                beta přístupový kód, který získáte od administrátora.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 mt-2">
                {downloads.map((d) => (
                  <Button key={d.os} asChild variant="outline" size="sm">
                    <a href={d.file} download={d.filename}>
                      <DownloadIcon className="w-3 h-3 mr-1" /> {d.icon}
                    </a>
                  </Button>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>


        <Card className="p-6 mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Co aplikace umí
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((f) => (
              <div key={f.title} className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{f.title}</div>
                  <div className="text-sm text-muted-foreground">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-3">Instalace</h2>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
            <li>Stáhněte archiv pro váš systém.</li>
            <li>Rozbalte ho na libovolné místo (např. do <code className="bg-muted px-1 rounded">C:\Programy\StudioVoxario</code>).</li>
            <li>Spusťte <code className="bg-muted px-1 rounded">StudioVoxario.exe</code> (Windows) nebo <code className="bg-muted px-1 rounded">./StudioVoxario</code> (Linux).</li>
            <li>V okně aplikace se přihlaste stejně jako na webu.</li>
            <li>Vše ostatní (tray, auto-start, notifikace) nastavíte v aplikaci přes tray → <b>Nastavení</b>.</li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Aplikace není podepsaná – při prvním spuštění může Windows zobrazit varování „Windows chránil váš počítač".
            Klikněte na <b>Další informace → Přesto spustit</b>.
          </p>
        </Card>
      </div>
    </div>
  );
}
