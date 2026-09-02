import { useState } from "react";
import { Globe, Network, LogOut, Terminal, Users, Swords, ScrollText, Package } from "lucide-react";
import { cn } from "@/lib/utils";

type LauncherView = "launcher" | "studio" | "browser";

const MODULES = [
  {
    id: "studio" as const,
    title: "StudioVoxario Hub",
    subtitle: "Community, LFG, Contracts, Inventories",
    icon: Network,
    accent: "gold" as const,
  },
  {
    id: "browser" as const,
    title: "VoxarioBrowser",
    subtitle: "High-performance gaming web browser",
    icon: Globe,
    accent: "cyan" as const,
  },
];

function ReturnButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "fixed top-4 left-4 z-50 flex items-center gap-2 px-4 h-10",
        "bg-secondary/60 hover:bg-destructive/20 text-muted-foreground hover:text-destructive",
        "border border-primary/20 hover:border-destructive/50",
        "text-xs font-mono uppercase tracking-widest transition-all duration-200",
        "hud-cut hover:shadow-[0_0_18px_hsl(var(--destructive)/0.35)]"
      )}
    >
      <LogOut className="w-4 h-4" />
      <span>Return to Hub</span>
    </button>
  );
}

function StudioPlaceholder({ onReturn }: { onReturn: () => void }) {
  return (
    <div className="hud-root hud-shell h-screen w-screen overflow-hidden text-foreground flex flex-col">
      <ReturnButton onClick={onReturn} />

      <header className="shrink-0 pt-16 pb-6 text-center">
        <div className="inline-flex items-center gap-3 mb-2">
          <Network className="w-7 h-7 text-gold text-glow" />
          <h1 className="font-display text-2xl tracking-[0.22em] uppercase text-glow">
            StudioVoxario Hub
          </h1>
        </div>
        <p className="font-mono text-sm text-muted-foreground">
          Community command center // placeholder module
        </p>
      </header>

      <main className="flex-1 min-h-0 px-6 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Community Feed", icon: Users, color: "primary" },
          { label: "LFG Radar", icon: Swords, color: "gold" },
          { label: "Contracts", icon: ScrollText, color: "primary" },
          { label: "Inventory", icon: Package, color: "gold" },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className={cn(
                "holo-pod pod-center p-5 flex flex-col gap-4",
                "opacity-60 hover:opacity-100 transition-opacity duration-300"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn("w-5 h-5", tile.color === "gold" ? "text-gold" : "text-primary")} />
                <span className="font-display text-sm uppercase tracking-wider">{tile.label}</span>
              </div>
              <div className="flex-1 space-y-2">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-2 bg-secondary/60 w-full"
                    style={{ width: `${60 + Math.random() * 35}%`, opacity: 0.4 + i * 0.12 }}
                  />
                ))}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                Awaiting integration...
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

function BrowserPlaceholder({ onReturn }: { onReturn: () => void }) {
  return (
    <div className="hud-root hud-shell h-screen w-screen overflow-hidden text-foreground flex flex-col">
      <ReturnButton onClick={onReturn} />

      <header className="shrink-0 pt-20 pb-6 px-6">
        <div className="holo-pod pod-center p-4 flex items-center gap-4">
          <Globe className="w-5 h-5 text-primary text-glow" />
          <div className="flex-1 h-9 bg-background/60 border border-primary/20 flex items-center px-3">
            <span className="font-mono text-xs text-muted-foreground truncate">
              https://studiovoxario.com
            </span>
          </div>
          <div className="font-mono text-xs text-muted-foreground/60 uppercase tracking-widest">
            VoxarioBrowser
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 px-6 pb-6">
        <div className="holo-pod pod-center h-full flex flex-col items-center justify-center gap-6 text-center p-8 relative">
          <div className="hex-frame w-24 h-24 flex items-center justify-center bg-primary/5 animate-pulse">
            <Globe className="w-10 h-10 text-primary/60 text-glow" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display text-xl tracking-[0.22em] uppercase text-glow">
              VoxarioBrowser
            </h2>
            <p className="font-mono text-sm text-muted-foreground max-w-md">
              [Electron &lt;webview&gt; Engine Initialized Here]
            </p>
          </div>
          <div className="font-mono text-xs text-muted-foreground/60 border border-primary/20 px-4 py-2 bg-background/40">
            Active URL: https://studiovoxario.com
          </div>

          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-primary to-transparent" />
            <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary to-transparent" />
          </div>
        </div>
      </main>
    </div>
  );
}

export default function GameLauncher() {
  const [currentView, setCurrentView] = useState<LauncherView>("launcher");

  if (currentView === "studio") {
    return <StudioPlaceholder onReturn={() => setCurrentView("launcher")} />;
  }

  if (currentView === "browser") {
    return <BrowserPlaceholder onReturn={() => setCurrentView("launcher")} />;
  }

  return (
    <div className="hud-root hud-shell h-screen w-screen overflow-hidden text-foreground flex items-center justify-center p-6">
      <div className="w-full max-w-5xl flex flex-col items-center gap-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center gap-3">
            <Terminal className="w-6 h-6 text-primary text-glow" />
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-[0.35em]">
              Unified Gaming Environment
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-6xl tracking-[0.18em] uppercase text-glow-intense">
            Studio Voxario
          </h1>
          <p className="font-mono text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            Select your module. The hub connects community, contracts, and inventory.
            The browser unlocks the web with gaming-grade performance.
          </p>
        </div>

        {/* Module cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {MODULES.map((module) => {
            const Icon = module.icon;
            const isGold = module.accent === "gold";
            return (
              <button
                key={module.id}
                type="button"
                onClick={() => setCurrentView(module.id)}
                className={cn(
                  "group relative text-left p-0 bg-transparent border-0",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                <div
                  className={cn(
                    "holo-pod pod-center h-64 md:h-80 w-full p-8 flex flex-col items-start justify-between",
                    "transition-all duration-300",
                    isGold
                      ? "hover:[--hud-line:hsl(45_100%_55%_/_.65)] hover:shadow-[0_0_32px_hsl(45_100%_55%_/_.25)]"
                      : "hover:[--hud-line:hsl(184_100%_54%_/_.65)] hover:shadow-[0_0_32px_hsl(184_100%_54%_/_.25)]",
                    "group-hover:scale-[1.02]"
                  )}
                >
                  {/* Top accent line */}
                  <div
                    className={cn(
                      "absolute top-0 left-0 right-0 h-[2px] transition-all duration-300",
                      isGold
                        ? "bg-gradient-to-r from-transparent via-gold to-transparent opacity-40 group-hover:opacity-100 group-hover:shadow-[0_0_16px_hsl(45_100%_55%_/_.6)]"
                        : "bg-gradient-to-r from-transparent via-primary to-transparent opacity-40 group-hover:opacity-100 group-hover:shadow-[0_0_16px_hsl(184_100%_54%_/_.6)]"
                    )}
                  />

                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "hex-frame w-14 h-14 flex items-center justify-center transition-all duration-300",
                        isGold
                          ? "bg-gold/10 group-hover:bg-gold/20 group-hover:shadow-[0_0_24px_hsl(45_100%_55%_/_.35)]"
                          : "bg-primary/10 group-hover:bg-primary/20 group-hover:shadow-[0_0_24px_hsl(184_100%_54%_/_.35)]"
                      )}
                    >
                      <Icon
                        className={cn(
                          "w-7 h-7 transition-all duration-300",
                          isGold
                            ? "text-gold group-hover:text-glow"
                            : "text-primary group-hover:text-glow"
                        )}
                      />
                    </div>
                    <div>
                      <h2 className="font-display text-xl md:text-2xl uppercase tracking-wider">
                        {module.title}
                      </h2>
                      <p className="font-mono text-xs md:text-sm text-muted-foreground mt-1">
                        {module.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="w-full space-y-3">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "font-mono text-[10px] uppercase tracking-[0.25em] transition-colors duration-300",
                          isGold
                            ? "text-gold/70 group-hover:text-gold"
                            : "text-primary/70 group-hover:text-primary"
                        )}
                      >
                        Launch module →
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                        {module.id === "studio" ? "v2.0.0" : "v1.0.0"}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer status line */}
        <div className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-[0.3em] flex items-center gap-3">
          <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
          System online — awaiting module selection
        </div>
      </div>
    </div>
  );
}
