import { Download as DownloadIcon, Monitor, Info, Shield, Bell, Package, RefreshCw, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";

const features = [
  { icon: Bell, title: "Desktop notifikace", desc: "Zprávy, zakázky a stream alerty přímo v systému." },
  { icon: Package, title: "Tray & minimalizace", desc: "Aplikace tiše běží v systémové liště." },
  { icon: RefreshCw, title: "Auto-start s OS", desc: "Volitelně startuje s Windows/Linuxem." },
  { icon: Shield, title: "Vlastní okno", desc: "Bez URL řádku – vypadá a chová se jako samostatná desktop aplikace." },
];

/**
 * Stabilní URL jsou navázané na poslední veřejný produkční release.
 * Release pipeline publikuje oba instalátory pod neměnnými názvy, takže web
 * nemusí měnit URL při každé nové verzi.
 */
const WINDOWS_SETUP_URL =
  "https://github.com/Sokolcz97-rgb/Voxar.app/releases/latest/download/StudioVoxarioSetup.exe";
const BROWSER_SETUP_URL =
  "https://github.com/Sokolcz97-rgb/Voxar.app/releases/latest/download/VoxarioBrowserSetup.exe";

export default function Download() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-16 max-w-5xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 mb-6 icon-cube-3d">
            <Monitor className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            StudioVoxario <span className="text-primary text-glow">pro Windows</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
            Voxar.app a VoxarioBrowser jsou samostatné produkty. Vyber si, co chceš nainstalovat — oba mají vlastní instalátor a aktualizační kanál.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 mb-10">
          <Card className="p-6 border-primary/25 bg-card/80 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                <Monitor className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-primary mb-1">Hlavní aplikace</div>
                <h2 className="text-2xl font-semibold">Voxar.app</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Komunita, launcher StudioVoxario, notifikace, tray a propojení s dalšími moduly.
                </p>
              </div>
            </div>

            <Button size="lg" variant="hero" className="btn-3d group w-full" asChild>
              <a href={WINDOWS_SETUP_URL}>
                <DownloadIcon className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                Stáhnout Voxar.app
              </a>
            </Button>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              StudioVoxarioSetup.exe · vlastní StudioVoxario Setup · nejnovější stabilní verze
            </p>
          </Card>

          <Card className="p-6 border-primary/35 bg-card/80 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary-glow via-primary to-transparent" />
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-primary mb-1">Samostatný produkt</div>
                <h2 className="text-2xl font-semibold">VoxarioBrowser</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Samostatný herní prohlížeč StudioVoxario s vlastním EXE, instalací a aktualizacemi.
                </p>
              </div>
            </div>

            <Button size="lg" variant="hero" className="btn-3d group w-full" asChild>
              <a href={BROWSER_SETUP_URL}>
                <DownloadIcon className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                Stáhnout VoxarioBrowser
              </a>
            </Button>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              VoxarioBrowserSetup.exe · samostatný StudioVoxario Setup · nejnovější stabilní verze
            </p>
          </Card>
        </div>

        <Card className="p-6 mb-10">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Co Voxar.app umí
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
            <li>Vyber nahoře Voxar.app nebo VoxarioBrowser a stáhni příslušný instalátor.</li>
            <li>
              Pro hlavní aplikaci spusť <code className="bg-muted px-1 rounded">StudioVoxarioSetup.exe</code>, pro prohlížeč <code className="bg-muted px-1 rounded">VoxarioBrowserSetup.exe</code>.
            </li>
            <li>Produkty můžeš mít nainstalované oba zároveň; Voxar.app umí samostatně nainstalovaný VoxarioBrowser rozpoznat a spustit.</li>
            <li>Po spuštění se otevře moderní StudioVoxario Setup s výběrem komponent, umístění a aktualizačního kanálu; nejde o klasický NSIS průvodce.</li>
            <li>Další aktualizace se řeší přes vlastní aktualizační kanál každého produktu.</li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Aplikace zatím nejsou podepsané – při prvním spuštění může Windows zobrazit varování „Windows chránil váš počítač".
            Klikni na <b>Další informace → Přesto spustit</b>.
          </p>
        </Card>
      </div>
    </div>
  );
}
