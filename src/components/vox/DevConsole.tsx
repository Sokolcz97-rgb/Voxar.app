import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Terminal, RefreshCw, RotateCcw, Power, Bug, HardDriveDownload, Trash2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

/**
 * In-app developer console for the desktop shell.
 * - Open with Ctrl+Shift+` (or Cmd+Shift+` on macOS), or the tray-corner icon.
 * - Provides manual actions: soft reload, hard reload (clear cache), relaunch,
 *   open DevTools, rollback to previous build, clear localStorage.
 * - A tiny in-memory log stream captures console.log/warn/error while open.
 */
type Api = {
  reloadApp?: () => Promise<unknown>;
  hardReloadApp?: () => Promise<unknown>;
  relaunchApp?: () => Promise<unknown>;
  openDevTools?: () => Promise<unknown>;
  rollbackApp?: () => Promise<unknown>;
  quitApp?: () => Promise<unknown>;
  getDiagnostics?: () => Promise<Record<string, unknown>>;
  getVersion?: () => Promise<string>;
};

function getApi(): Api | null {
  const w = window as unknown as { studioVoxarioDesktop?: Api };
  return w.studioVoxarioDesktop ?? null;
}

type LogLine = { level: "log" | "warn" | "error"; msg: string; t: number };

export function DevConsole() {
  const api = getApi();
  const [open, setOpen] = useState(false);
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut: Ctrl/Cmd + Shift + `
  useEffect(() => {
    if (!api) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "`" || e.code === "Backquote")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  // Console interception while open
  useEffect(() => {
    if (!open) return;
    const orig = { log: console.log, warn: console.warn, error: console.error };
    const push = (level: LogLine["level"]) => (...args: unknown[]) => {
      const msg = args.map((a) => {
        try { return typeof a === "string" ? a : JSON.stringify(a); } catch { return String(a); }
      }).join(" ");
      setLogs((prev) => [...prev.slice(-199), { level, msg, t: Date.now() }]);
      orig[level](...args);
    };
    console.log = push("log");
    console.warn = push("warn");
    console.error = push("error");
    return () => {
      console.log = orig.log; console.warn = orig.warn; console.error = orig.error;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !api?.getDiagnostics) return;
    api.getDiagnostics().then(setDiag).catch(() => {});
  }, [open, api]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  if (!api) return null;

  const run = async (label: string, fn?: () => Promise<unknown>) => {
    if (!fn) return;
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      toast({ title: `${label} selhalo`, description: String(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const clearStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      toast({ title: "LocalStorage vyčištěn" });
    } catch (e) {
      toast({ title: "Nepovedlo se", description: String(e), variant: "destructive" });
    }
  };

  return (
    <>
      {/* Floating trigger — hexagonal HUD node, bottom-left */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Konzole (Ctrl+Shift+`)"
        className="fixed bottom-3 left-3 z-40 w-10 h-10 flex items-center justify-center text-primary/80 hover:text-primary transition group"
        style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }}
      >
        <span className="absolute inset-0 bg-card/90 border border-primary/40 group-hover:border-primary group-hover:shadow-[0_0_16px_hsl(var(--primary)/0.6)] transition"
              style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)" }} />
        <Terminal className="relative w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-6">
          <div className="holo-context-menu relative w-full sm:max-w-3xl h-[80vh] sm:h-[70vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/25 bg-background/40">
              <div className="flex items-center gap-2 font-display text-[11px] tracking-[0.32em] uppercase text-primary">
                <Terminal className="w-4 h-4" /> // DEV · CONSOLE
                {diag?.version ? (
                  <span className="ml-2 text-[10px] text-primary/50 font-mono tracking-normal normal-case">
                    v{String(diag.version)}
                  </span>
                ) : null}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-sm hover:bg-primary/10 border border-primary/20 hover:border-primary/60 flex items-center justify-center text-primary/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-primary/20 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("Reload", api.reloadApp)} className="font-display uppercase tracking-widest text-[10px]">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload
              </Button>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("Hard reload", api.hardReloadApp)} className="font-display uppercase tracking-widest text-[10px]">
                <HardDriveDownload className="w-3.5 h-3.5 mr-1.5" /> Hard reload
              </Button>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("Relaunch", api.relaunchApp)} className="font-display uppercase tracking-widest text-[10px]">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Relaunch
              </Button>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("DevTools", api.openDevTools)} className="font-display uppercase tracking-widest text-[10px]">
                <Bug className="w-3.5 h-3.5 mr-1.5" /> DevTools
              </Button>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={clearStorage} className="font-display uppercase tracking-widest text-[10px]">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Purge storage
              </Button>
              <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => run("Rollback", api.rollbackApp)} className="font-display uppercase tracking-widest text-[10px]">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Rollback
              </Button>
              <Button size="sm" variant="ghost" className="col-span-2 sm:col-span-3 font-display uppercase tracking-widest text-[10px] border border-destructive/40 text-destructive hover:bg-destructive/10" disabled={!!busy} onClick={() => run("Ukončit", api.quitApp)}>
                <Power className="w-3.5 h-3.5 mr-1.5" /> Terminate node
              </Button>
            </div>

            {diag && (
              <div className="px-4 py-2 border-b border-primary/20 text-[10px] text-primary/70 font-mono grid grid-cols-2 gap-x-4 gap-y-0.5 bg-background/30">
                {Object.entries(diag).map(([k, v]) => (
                  <div key={k} className="truncate">
                    <span className="text-primary/40">{k}:</span> <span className="text-foreground/85">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[11px] leading-relaxed p-3 bg-background/50">
              {logs.length === 0 ? (
                <div className="text-primary/40 italic">// stream idle — konzole zaznamenává console.log/warn/error od otevření.</div>
              ) : logs.map((l, i) => (
                <div key={i} className={
                  l.level === "error" ? "text-destructive" :
                  l.level === "warn" ? "text-yellow-400" : "text-foreground/85"
                }>
                  <span className="text-primary/40">[{new Date(l.t).toLocaleTimeString()}]</span>{" "}
                  <span className="text-primary/60">{l.level.toUpperCase().padEnd(5)}</span> {l.msg}
                </div>
              ))}
            </div>

            <div className="px-3 py-2 border-t border-primary/20 text-[10px] text-primary/60 font-mono flex items-center justify-between bg-background/40">
              <span>› HOTKEY: Ctrl+Shift+` toggle</span>
              <button className="hover:text-primary uppercase tracking-widest" onClick={() => setLogs([])}>Flush logs</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
