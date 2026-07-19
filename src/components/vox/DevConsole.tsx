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
      {/* Floating trigger — small, bottom-left so it doesn't collide with the update FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Konzole (Ctrl+Shift+`)"
        className="fixed bottom-3 left-3 z-40 w-9 h-9 rounded-full bg-card border border-border/60 shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition"
      >
        <Terminal className="w-4 h-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-6">
          <div className="w-full sm:max-w-3xl h-[80vh] sm:h-[70vh] bg-card border border-border rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/60 bg-background/60">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Terminal className="w-4 h-4 text-primary" /> Vývojářská konzole
                {diag?.version ? <span className="text-xs text-muted-foreground font-normal">v{String(diag.version)}</span> : null}
              </div>
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded hover:bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-border/60 grid grid-cols-2 sm:grid-cols-3 gap-2">
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("Reload", api.reloadApp)}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload
              </Button>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("Hard reload", api.hardReloadApp)}>
                <HardDriveDownload className="w-3.5 h-3.5 mr-1.5" /> Hard reload
              </Button>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("Relaunch", api.relaunchApp)}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Relaunch
              </Button>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => run("DevTools", api.openDevTools)}>
                <Bug className="w-3.5 h-3.5 mr-1.5" /> DevTools
              </Button>
              <Button size="sm" variant="secondary" disabled={!!busy} onClick={clearStorage}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Vyčistit storage
              </Button>
              <Button size="sm" variant="destructive" disabled={!!busy} onClick={() => run("Rollback", api.rollbackApp)}>
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Rollback build
              </Button>
              <Button size="sm" variant="ghost" className="col-span-2 sm:col-span-3" disabled={!!busy} onClick={() => run("Ukončit", api.quitApp)}>
                <Power className="w-3.5 h-3.5 mr-1.5" /> Ukončit aplikaci
              </Button>
            </div>

            {diag && (
              <div className="px-4 py-2 border-b border-border/60 text-[11px] text-muted-foreground font-mono grid grid-cols-2 gap-x-4 gap-y-0.5">
                {Object.entries(diag).map(([k, v]) => (
                  <div key={k} className="truncate"><span className="opacity-70">{k}:</span> {String(v)}</div>
                ))}
              </div>
            )}

            <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[11px] leading-relaxed p-3 bg-background/40">
              {logs.length === 0 ? (
                <div className="text-muted-foreground italic">Žádné logy zatím. Konzole zaznamenává console.log/warn/error od otevření.</div>
              ) : logs.map((l, i) => (
                <div key={i} className={
                  l.level === "error" ? "text-destructive" :
                  l.level === "warn" ? "text-yellow-400" : "text-foreground/80"
                }>
                  <span className="opacity-50">{new Date(l.t).toLocaleTimeString()} </span>{l.msg}
                </div>
              ))}
            </div>

            <div className="px-3 py-2 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
              <span>Zkratka: Ctrl+Shift+` — zavírá i otevírá konzoli.</span>
              <button className="hover:text-foreground" onClick={() => setLogs([])}>Vyčistit logy</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
