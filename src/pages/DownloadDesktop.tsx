import { useEffect, useState } from "react";
import { Download as DownloadIcon, Monitor, Info, Shield, Bell, Package, RefreshCw, Sparkles, Loader2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";

const features = [
  { icon: Bell, title: "Desktop notifikace", desc: "Zprávy, zakázky a stream alerty přímo v systému." },
  { icon: Package, title: "Tray & minimalizace", desc: "Aplikace tiše běží v systémové liště." },
  { icon: RefreshCw, title: "Auto-start s OS", desc: "Volitelně startuje s Windows/Linuxem." },
  { icon: Shield, title: "Vlastní okno", desc: "Bez URL řádku – vypadá a chová se jako Discord." },
];

// CI (GitHub Actions) po každém buildu nahraje čerstvý installer a přepíše
// `src/assets/downloads/windows-installer.asset.json`. Načítáme ho dynamicky,
// aby stránka nespadla, když pointer zatím neexistuje (build ještě neproběhl).
type AssetPointer = { url: string; original_filename?: string; size?: number };

async function loadInstallerPointer(): Promise<AssetPointer | null> {
  try {
    // Vite glob – returns empty object until CI drops the pointer file.
    const mods = import.meta.glob("@/assets/downloads/windows-installer.asset.json", { eager: true }) as Record<string, any>;
    const first = Object.values(mods)[0];
    const data = first?.default ?? first;
    if (!data?.url) return null;
    return await resolveLiveAsset(data as AssetPointer);
  } catch {
    return null;
  }
}

/**
 * Pointer může ukazovat na release, který ještě neexistuje (nebo je repo privátní) —
 * pak by tlačítko vedlo na GitHub 404. Ověříme asset přes GitHub API a vrátíme
 * skutečnou download URL; když asset není dostupný, vrátíme null.
 */
async function resolveLiveAsset(p: AssetPointer): Promise<AssetPointer | null> {
  const m = p.url.match(/github\.com\/([^/]+)\/([^/]+)\/releases\/download\/([^/]+)\/(.+)$/);
  if (!m) return p; // non-GitHub host (CDN) – důvěřujeme pointeru
  const [, owner, repo, tag] = m;
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    const rel = await res.json();
    const asset =
      (rel.assets ?? []).find((a: any) => a.name === p.original_filename) ??
      (rel.assets ?? []).find((a: any) => String(a.name).toLowerCase().endsWith(".exe"));
    if (!asset) return null;
    return { url: asset.browser_download_url, original_filename: asset.name, size: asset.size };
  } catch {
    return null;
  }
}



export default function Download() {
  const [pointer, setPointer] = useState<AssetPointer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    loadInstallerPointer().then((p) => {
      if (!alive) return;
      setPointer(p);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const sizeMb = pointer?.size ? `${(pointer.size / 1_000_000).toFixed(1)} MB` : "";
  const filename = pointer?.original_filename || "VoxarAppSetup.exe";
  // GitHub Release URL už samo redirectuje na podepsaný objekt – žádný cache-buster,
  // ten by redirect rozbil.
  const href = pointer?.url ?? "#";


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
            Instalátor sestavuje GitHub Actions CI – tlačítko níže vždy odkazuje na poslední čerstvý build.
          </p>

          {loading ? (
            <Button size="xl" variant="hero" disabled className="btn-3d">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Načítám instalátor…
            </Button>
          ) : pointer ? (
            <>
              <Button
                size="xl"
                variant="hero"
                className="btn-3d group relative overflow-hidden"
                asChild
              >
                <a href={href} download={filename}>
                  <DownloadIcon className="h-5 w-5 mr-2 group-hover:animate-bounce" />
                  <span className="bg-gradient-to-r from-foreground via-primary to-primary-glow bg-clip-text text-transparent">
                    Stáhnout pro Windows
                  </span>
                </a>
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                {filename}{sizeMb ? ` · ${sizeMb}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-2">
                <Globe className="h-3.5 w-3.5 text-primary" />
                Obsahuje i modul VoxarioBrowser – vybereš ho přímo v instalátoru.
              </p>

            </>
          ) : (
            <Card className="max-w-lg mx-auto p-6 border-primary/40">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-2">Instalátor zatím není dostupný</h3>
              <p className="text-sm text-muted-foreground">
                Poslední build ještě není publikovaný jako veřejný GitHub Release
                (release/repozitář je nedostupný nebo privátní). Jakmile CI nahraje
                asset do veřejného releasu, tlačítko se tu objeví samo.
              </p>

            </Card>
          )}

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
