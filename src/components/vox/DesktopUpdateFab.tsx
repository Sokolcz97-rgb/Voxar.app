import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * Plovoucí ikonka „stáhnout aktualizaci" viditelná pouze v Electron aplikaci.
 * Main proces broadcastuje `update:availability` každých 15 min (a hned po startu);
 * když je `available: true`, ukážeme FAB. Kliknutím spustíme instalaci — už žádný
 * restart nutný k tomu, aby se změna projevila.
 */
type Info = { available: boolean; current?: string; remote?: string | null; notes?: string | null };

export function DesktopUpdateFab() {
  const desktop: any = typeof window !== "undefined" ? (window as any).studioVoxarioDesktop : null;
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    // Okamžitá kontrola po mountu — uživatel nemusí čekat na první tick.
    desktop.checkUpdatesQuiet?.().then((r: Info) => setInfo(r)).catch(() => {});
    const off = desktop.onUpdateAvailability?.((r: Info) => {
      setInfo(r);
      if (r?.available) setDismissed(false);
    });
    return () => { try { off?.(); } catch {} };
  }, [desktop]);

  if (!desktop || !info?.available || dismissed) return null;

  const install = async () => {
    setBusy(true);
    try {
      const r = await desktop.installUpdateNow?.();
      if (r?.status === "installing") {
        toast({ title: "Instaluji aktualizaci", description: `StudioVoxario ${info.remote} — aplikace se restartuje.` });
      } else if (r?.status === "up-to-date") {
        toast({ title: "Máš nejnovější verzi" });
        setInfo({ ...info, available: false });
      } else {
        toast({ title: "Aktualizace selhala", description: r?.error || r?.status || "Neznámá chyba", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[70] holo-context-menu px-4 py-2.5 flex items-center gap-3 shadow-[0_0_24px_hsl(var(--primary)/0.35)] group">
      <span className="relative flex w-2 h-2">
        <span className="absolute inset-0 rounded-full bg-primary/60 animate-ping" />
        <span className="relative w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
      </span>
      <button
        onClick={install}
        disabled={busy}
        className="flex items-center gap-2 font-display uppercase tracking-[0.28em] text-[10px] text-primary hover:text-primary/80 disabled:opacity-60"
        title={info.notes || `Nová verze ${info.remote}`}
      >
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        <span>// PATCH · v{info.remote}</span>
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded-sm text-primary/50 hover:text-primary hover:bg-primary/10 border border-primary/20"
        title="Zavřít"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
