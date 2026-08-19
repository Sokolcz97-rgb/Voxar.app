import { useEffect, useMemo, useState } from "react";
import { Languages, Dices, Target, Users, Clock, HelpCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlashCommand {
  name: string;
  args?: string;
  description: string;
  icon: LucideIcon;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: "translate", args: "<jazyk>", description: "Přeloží poslední zprávu do zvoleného jazyka", icon: Languages },
  { name: "roll", args: "[k20]", description: "Hodí virtuální kostkou", icon: Dices },
  { name: "bounty", args: "[id]", description: "Zobrazí aktivní kontrakt z Bounty Board", icon: Target },
  { name: "who", description: "Vypíše online členy v konverzaci", icon: Users },
  { name: "remind", args: "<čas> <text>", description: "Nastaví tichou připomínku", icon: Clock },
  { name: "help", description: "Seznam všech dostupných příkazů", icon: HelpCircle },
];

interface Props {
  /** Raw query typed after the leading slash */
  query: string;
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

/** Tactical terminal dropdown rendered ABOVE the composer. */
export function SlashCommandMenu({ query, onSelect, onClose }: Props) {
  const list = useMemo(
    () =>
      SLASH_COMMANDS.filter((c) =>
        c.name.toLowerCase().startsWith(query.toLowerCase().replace(/^\//, "")),
      ),
    [query],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (list.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => (i + 1) % list.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => (i - 1 + list.length) % list.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        onSelect(list[index]);
      } else if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [list, index, onSelect, onClose]);

  if (list.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 z-40">
      <div className="web-panel p-1.5" style={{ ["--wc" as string]: "12px" }}>
        <div className="px-2 py-1 flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-[0.28em] text-primary">
            Command terminal
          </span>
          <span className="text-[10px] text-muted-foreground">↑↓ · Enter</span>
        </div>
        <ul className="max-h-64 overflow-y-auto">
          {list.map((c, i) => {
            const Icon = c.icon;
            return (
              <li key={c.name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => onSelect(c)}
                  className={cn(
                    "w-full flex items-center gap-3 px-2.5 py-2 text-left transition-colors web-cut",
                    i === index
                      ? "bg-primary/15 text-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]"
                      : "hover:bg-primary/10 text-muted-foreground",
                  )}
                  style={{ ["--wc" as string]: "8px" }}
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-mono text-xs text-primary">/{c.name}</span>
                  {c.args && (
                    <span className="font-mono text-[10px] text-muted-foreground">{c.args}</span>
                  )}
                  <span className="ml-auto text-[11px] truncate max-w-[55%]">{c.description}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
