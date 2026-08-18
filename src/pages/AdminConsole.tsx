import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Terminal, RefreshCw, Trash2, Download, Bug } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type LogLine = { level: "log" | "warn" | "error" | "info"; msg: string; t: number };

const MAX_LINES = 500;

const AdminConsole = () => {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState("");
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Intercept console output while the page is mounted
  useEffect(() => {
    const orig = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
    };
    const push = (level: LogLine["level"]) => (...args: unknown[]) => {
      orig[level](...args);
      if (pausedRef.current) return;
      const msg = args
        .map((a) => {
          try {
            return typeof a === "string" ? a : JSON.stringify(a);
          } catch {
            return String(a);
          }
        })
        .join(" ");
      setLogs((prev) => [...prev.slice(-(MAX_LINES - 1)), { level, msg, t: Date.now() }]);
    };
    console.log = push("log");
    console.warn = push("warn");
    console.error = push("error");
    console.info = push("info");

    const onError = (e: ErrorEvent) => push("error")(`[window.onerror] ${e.message}`);
    const onRejection = (e: PromiseRejectionEvent) =>
      push("error")(`[unhandledrejection] ${String(e.reason)}`);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      console.log = orig.log;
      console.warn = orig.warn;
      console.error = orig.error;
      console.info = orig.info;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  const diagnostics = useMemo(
    () => ({
      url: window.location.href,
      userAgent: navigator.userAgent,
      language: navigator.language,
      online: String(navigator.onLine),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      dpr: String(window.devicePixelRatio),
      platform: navigator.platform,
      cores: String(navigator.hardwareConcurrency ?? "?"),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      secureContext: String(window.isSecureContext),
    }),
    [],
  );

  const filtered = filter
    ? logs.filter((l) => l.msg.toLowerCase().includes(filter.toLowerCase()))
    : logs;

  const clearStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      toast({ title: "Local storage vyčištěn" });
    } catch (e) {
      toast({ title: "Nepovedlo se", description: String(e), variant: "destructive" });
    }
  };

  const exportLogs = () => {
    const body = logs
      .map((l) => `[${new Date(l.t).toISOString()}] ${l.level.toUpperCase()} ${l.msg}`)
      .join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `console-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">Administrace</p>
          <h1 className="font-display font-black text-4xl md:text-5xl mt-2 flex items-center gap-3">
            <Terminal className="h-8 w-8 text-primary" /> Konzole
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Vývojářská konzole webu – živý stream console.log/warn/error, chyby a diagnostika prohlížeče.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="glass border-border p-5 lg:col-span-1">
            <h2 className="font-display font-bold text-lg mb-3">Diagnostika</h2>
            <div className="space-y-1 font-mono text-[11px]">
              {Object.entries(diagnostics).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">{k}:</span>
                  <span className="break-all">{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload
              </Button>
              <Button size="sm" variant="secondary" onClick={clearStorage}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Storage
              </Button>
              <Button size="sm" variant="secondary" onClick={exportLogs}>
                <Download className="w-3.5 h-3.5 mr-1.5" /> Export
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => console.log("[test]", { ok: true, ts: Date.now() })}
              >
                <Bug className="w-3.5 h-3.5 mr-1.5" /> Test log
              </Button>
            </div>
          </Card>

          <Card className="glass border-border p-0 lg:col-span-2 flex flex-col overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrovat…"
                className="h-8 max-w-xs"
              />
              <Button size="sm" variant={paused ? "default" : "secondary"} onClick={() => setPaused((p) => !p)}>
                {paused ? "Pokračovat" : "Pauza"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLogs([])}>
                Vyčistit
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {filtered.length}/{logs.length} řádků
              </span>
            </div>
            <div
              ref={scrollRef}
              className="h-[60vh] overflow-auto font-mono text-[11px] leading-relaxed p-3 bg-background/40"
            >
              {filtered.length === 0 ? (
                <div className="text-muted-foreground italic">
                  // stream je prázdný – konzole zaznamenává výstup od otevření této stránky.
                </div>
              ) : (
                filtered.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.level === "error"
                        ? "text-destructive"
                        : l.level === "warn"
                          ? "text-yellow-400"
                          : "text-foreground/85"
                    }
                  >
                    <span className="text-muted-foreground">[{new Date(l.t).toLocaleTimeString()}]</span>{" "}
                    <span className="text-primary/70">{l.level.toUpperCase().padEnd(5)}</span> {l.msg}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminConsole;
