import { Download as DownloadIcon, Monitor, Info, Shield, Bell, Package, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";

const features = [
  { icon: Bell, title: "Desktop notifikace", desc: "Zprávy, zakázky a stream alerty přímo v systému." },
  { icon: Package, title: "Tray & minimalizace", desc: "Aplikace tiše běží v systémové liště." },
  { icon: RefreshCw, title: "Auto-start s OS", desc: "Volitelně startuje s Windows/Linuxem." },
  { icon: Shield, title: "Vlastní okno", desc: "Bez URL řádku – vypadá a chová se jako Discord." },
];

/**
 * Stálý přímý download nejnovějšího VLASTNÍHO StudioVoxario instalátoru.
 *
 * GitHub Actions přidává do každého version releasu také asset se stabilním
 * názvem `StudioVoxarioSetup.exe`. GitHub `/releases/latest/download/...`
 * automaticky přesměruje na asset z posledního produkčního releasu.
 *
 * Díky tomu:
 * - uživatel kliká pouze na tlačítko na našem webu a nemusí otevírat GitHub UI;
 * - URL na webu se při každé nové verzi nemění;
 * - kvůli novému desktop buildu není nutné znovu publikovat Lovable web.
 */
const WINDOWS_SETUP_URL =
  "https://github.com/Sokolcz97-rgb/Voxar.app/releases/latest/download/StudioVoxarioSetup.exe";

export default function Download() {
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
            Tlačítko vždy stáhne nejnovější produkční verzi vlastního StudioVoxario instalátoru.
          </p>

          <Button
            size="xl"
            variant="hero"
            className="btn-3d group relative overflow-hidden"
            asChild
          >
            <a href={WINDOWS_SETUP_URL}>
              <DownloadIcon className="h-5 w-5 mr-2 group-hover:animate-bounce" />
              <span className="bg-gradient-to-r from-foreground via-primary to-primary-glow bg-clip-text text-transparent">
                Stáhnout pro Windows
              </span>
            </a>
          </Button>

          <p className="text-xs text-muted-foreground mt-3">
            StudioVoxarioSetup.exe · vždy nejnovější stabilní verze
          </p>
          <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-2">
            <Globe className="h-3.5 w-3.5 text-primary" />
            Obsahuje i modul VoxarioBrowser – vybereš ho přímo v instalátoru.
          </p>
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
            <li>Stáhněte instalátor tlačítkem výše.</li>
            <li>Spusťte <code className="bg-muted px-1 rounded">StudioVoxarioSetup.exe</code> – projde vlastním HUD instalátorem bez klasického Windows okna.</li>
            <li>Po instalaci se aplikace spustí sama a přihlásíte se stejně jako na webu.</li>
            <li>Tray, auto-start a notifikace nastavíte v aplikaci přes tray → <b>Nastavení</b>.</li>
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
