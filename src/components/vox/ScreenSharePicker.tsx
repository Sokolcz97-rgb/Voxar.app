import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MonitorUp, AppWindow, Monitor, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listCaptureSources, readVideoPrefs, writeVideoPrefs, QUALITY_PRESETS, FPS_OPTIONS,
  type CaptureSource, type QualityKey, type FpsOption,
} from "@/lib/videoQuality";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (sourceId: string, quality: QualityKey) => void;
}

/** HUD picker: whole screens (desktop + taskbar) or a single window / game. */
export function ScreenSharePicker({ open, onOpenChange, onPick }: Props) {
  const [sources, setSources] = useState<CaptureSource[] | null>(null);
  const [tab, setTab] = useState<"screen" | "window">("screen");
  const [selected, setSelected] = useState<string | null>(null);
  const [quality, setQuality] = useState<QualityKey>(readVideoPrefs().screenQuality);
  const [fps, setFps] = useState<FpsOption>(readVideoPrefs().screenFps);

  useEffect(() => {
    if (!open) return;
    setSources(null);
    setSelected(null);
    void listCaptureSources().then(setSources);
  }, [open]);

  const list = (sources ?? []).filter((s) => s.type === tab);

  const chip =
    "h-7 px-3 font-display text-[9px] tracking-[0.22em] uppercase border transition-colors [clip-path:polygon(6px_0,100%_0,100%_calc(100%-6px),calc(100%-6px)_100%,0_100%,0_6px)]";

  const confirm = () => {
    if (!selected) return;
    writeVideoPrefs({ screenQuality: quality, screenFps: fps });
    onPick(selected, quality);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[hsl(222_42%_6%/0.96)] border-primary/30 [clip-path:polygon(18px_0,100%_0,100%_calc(100%-18px),calc(100%-18px)_100%,0_100%,0_18px)]">
        <div className="flex items-center gap-2 border-b border-primary/20 pb-3">
          <MonitorUp className="w-4 h-4 text-primary text-glow" />
          <span className="font-display text-xs tracking-[0.26em] uppercase text-primary text-glow">
            Zdroj sdílení
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTab("screen")}
            className={cn(chip, tab === "screen" ? "border-primary text-primary bg-primary/15" : "border-primary/25 text-muted-foreground hover:text-primary")}
          >
            <Monitor className="w-3 h-3 inline mr-1.5 -mt-0.5" /> Obrazovky
          </button>
          <button
            onClick={() => setTab("window")}
            className={cn(chip, tab === "window" ? "border-primary text-primary bg-primary/15" : "border-primary/25 text-muted-foreground hover:text-primary")}
          >
            <AppWindow className="w-3 h-3 inline mr-1.5 -mt-0.5" /> Okna / hry
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            {QUALITY_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setQuality(p.key)}
                className={cn(chip, quality === p.key ? "border-emerald-400/60 text-emerald-300 bg-emerald-500/10" : "border-primary/25 text-muted-foreground hover:text-primary")}
              >
                {p.label}
              </button>
            ))}
            {FPS_OPTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFps(f)}
                className={cn(chip, fps === f ? "border-emerald-400/60 text-emerald-300 bg-emerald-500/10" : "border-primary/25 text-muted-foreground hover:text-primary")}
              >
                {f} FPS
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[46vh] overflow-y-auto">
          {sources === null ? (
            <div className="py-12 flex items-center justify-center gap-2 text-primary/80">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="font-display text-[10px] tracking-[0.24em] uppercase">Skenuji zdroje…</span>
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center font-display text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
              Žádné zdroje nenalezeny
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-1">
              {list.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s.id)}
                  className={cn(
                    "text-left border bg-[hsl(222_40%_5%)] overflow-hidden transition-all [clip-path:polygon(12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%,0_12px)]",
                    selected === s.id
                      ? "border-emerald-400/70 shadow-[0_0_22px_hsl(160_84%_50%/0.35)]"
                      : "border-primary/25 hover:border-primary/60",
                  )}
                >
                  {s.thumbnail ? (
                    <img src={s.thumbnail} alt={s.name} className="w-full aspect-video object-cover" />
                  ) : (
                    <div className="w-full aspect-video flex items-center justify-center bg-primary/5">
                      <Monitor className="w-6 h-6 text-primary/60" />
                    </div>
                  )}
                  <div className="px-2 py-1.5 flex items-center gap-1.5">
                    {s.appIcon && <img src={s.appIcon} alt="" className="w-3.5 h-3.5" />}
                    <span className="text-[10px] font-display tracking-wide truncate text-foreground/90">{s.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-primary/20 pt-3">
          <button onClick={() => onOpenChange(false)} className={cn(chip, "border-primary/25 text-muted-foreground hover:text-primary")}>
            Zrušit
          </button>
          <button
            onClick={confirm}
            disabled={!selected}
            className={cn(chip, "border-emerald-400/60 text-emerald-300 bg-emerald-500/10 disabled:opacity-40")}
          >
            Sdílet
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
