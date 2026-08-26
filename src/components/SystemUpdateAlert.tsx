import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, X } from "lucide-react";
import { useVersionCheck } from "@/hooks/useVersionCheck";

/**
 * Taktický HUD alert: nová verze aplikace je nasazená.
 * Kliknutí na „Apply Update" vyčistí cache/SW a natvrdo přenačte assety.
 */
export function SystemUpdateAlert() {
  const { updateReady, applyUpdate, dismiss } = useVersionCheck();
  const [busy, setBusy] = useState(false);

  if (!updateReady) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[80] w-[min(94vw,560px)] animate-in fade-in slide-in-from-bottom-4">
      <div
        className="relative flex items-center gap-4 px-5 py-4 bg-card/95 backdrop-blur-md border border-primary/40 shadow-[0_0_32px_hsl(var(--primary)/0.28)]"
        style={{
          clipPath:
            "polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)",
        }}
      >
        <span className="absolute left-0 top-0 h-full w-[3px] bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
        <AlertTriangle className="w-5 h-5 shrink-0 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.8)]" />
        <div className="min-w-0 flex-1">
          <p className="font-display uppercase tracking-[0.28em] text-[10px] text-primary">
            // System Update Available
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Initialize reboot to apply changes.
          </p>
        </div>
        <button
          onClick={async () => {
            setBusy(true);
            await applyUpdate();
          }}
          disabled={busy}
          className="shrink-0 flex items-center gap-2 px-4 py-2 border border-primary/50 bg-primary/10 text-primary font-display uppercase tracking-[0.2em] text-[10px] hover:bg-primary/20 disabled:opacity-60 transition-colors"
          style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Apply Update
        </button>
        <button
          onClick={dismiss}
          className="shrink-0 p-1 border border-primary/20 text-primary/50 hover:text-primary hover:bg-primary/10"
          title="Odložit"
          aria-label="Odložit aktualizaci"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
