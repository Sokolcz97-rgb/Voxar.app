import { Download as DownloadIcon, Monitor, Info, Shield, Bell, Package, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import winAsset from "@/assets/downloads/windows.asset.json";
import linuxAsset from "@/assets/downloads/linux.asset.json";

const features = [
  { icon: Bell, title: "Desktop notifikace", desc: "Zprávy, zakázky a stream alerty přímo v systému." },
  { icon: Package, title: "Tray & minimalizace", desc: "Aplikace tiše běží v systémové liště." },
  { icon: RefreshCw, title: "Auto-start s OS", desc: "Volitelně startuje s Windows/Linuxem." },
  { icon: Shield, title: "Vlastní okno", desc: "Bez URL řádku – vypadá a chová se jako Discord." },
];

export default function Download() {
  const downloads = [
    {
      os: "Windows 10 / 11",
      file: winAsset.url,
      note: "Rozbalte ZIP a spusťte StudioVoxario.exe",
      icon: "🪟",
      size: "~114 MB",
    },
    {
      os: "Linux (x64)",
      file: linuxAsset.url,
      note: "tar xzf a spusťte ./StudioVoxario",
      icon: "🐧",
      size: "~110 MB",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 mb-6">
            <Monitor className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            StudioVoxario <span className="text-primary">pro počítač</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Nativní desktop klient s notifikacemi, tray ikonou a auto-startem. 
            Vždy synchronizován s webem – žádné manuální aktualizace obsahu.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-10">
          {downloads.map((d) => (
            <Card key={d.os} className="p-6 hover:border-primary/50 transition-colors">
              <div className="flex items-start gap-4">
                <div className="text-4xl">{d.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{d.os}</h3>
                  <p className="text-sm text-muted-foreground mb-1">{d.note}</p>
                  <p className="text-xs text-muted-foreground mb-4">{d.size}</p>
                  <Button asChild className="w-full">
                    <a href={d.file} download>
                      <DownloadIcon className="w-4 h-4 mr-2" />
                      Stáhnout
                    </a>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

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
