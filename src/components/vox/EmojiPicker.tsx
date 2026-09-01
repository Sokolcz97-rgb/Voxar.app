import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EMOJI_GROUPS: Record<string, string[]> = {
  "// HUD": ["📡", "🛰️", "🔭", "⚙️", "🧿", "🔧", "🖥️", "💾", "🔒", "🛡️", "⚡", "🧪"],
  "// KOMUNITA": ["💬", "📣", "📌", "📰", "🎫", "🙋", "🤝", "🎉", "🧠", "❤️", "👀", "✅"],
  "// HRY": ["🎮", "🕹️", "🎯", "🏆", "⚔️", "🐉", "🧱", "🚀", "🏁", "🎲", "🃏", "👾"],
  "// AUDIO": ["🎧", "🎙️", "🔊", "🎵", "📻", "🎬", "📹", "🔈", "🥁", "🎸", "📺", "🔔"],
};

export function EmojiPicker({
  value,
  onChange,
  fallback,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  fallback?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  const pick = (e: string | null) => {
    onChange(e);
    setOpen(false);
    setCustom("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-11 h-11 shrink-0 flex items-center justify-center text-xl transition-all",
            "border border-primary/30 bg-background/40 hover:border-primary/70 hover:bg-primary/10",
            "shadow-[inset_0_0_12px_hsl(var(--primary)/0.12)]"
          )}
          style={{ clipPath: "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)" }}
          title="Vybrat emoji"
        >
          {value || fallback || <span className="text-[9px] font-display tracking-widest text-primary/60">SET</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-3 holo-context-menu border-0 space-y-3"
      >
        <div className="max-h-56 overflow-y-auto hud-scrollbar space-y-3 pr-1">
          {Object.entries(EMOJI_GROUPS).map(([label, list]) => (
            <div key={label}>
              <div className="text-[9px] font-display uppercase tracking-[0.28em] text-primary/60 mb-1.5">{label}</div>
              <div className="grid grid-cols-6 gap-1">
                {list.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => pick(e)}
                    className={cn(
                      "h-8 text-lg flex items-center justify-center border transition-colors",
                      value === e
                        ? "border-primary/70 bg-primary/15"
                        : "border-transparent hover:border-primary/40 hover:bg-primary/10"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-center border-t border-primary/15 pt-2.5">
          <Input
            value={custom}
            onChange={(e) => setCustom(e.target.value.slice(0, 4))}
            placeholder="Vlastní…"
            className="h-8 bg-background/40 border-primary/30 text-sm"
            onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) pick(custom.trim()); }}
          />
          <button
            type="button"
            onClick={() => pick(null)}
            className="text-[9px] font-display uppercase tracking-[0.22em] text-muted-foreground hover:text-destructive shrink-0"
          >
            Vymazat
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
