import { Plus, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface VoxGuild {
  id: string;
  name: string;
  icon_url: string | null;
}

interface Props {
  guilds: VoxGuild[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onJoin: () => void;
}

export function GuildRail({ guilds, activeId, onSelect, onCreate, onJoin }: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-[72px] h-full flex flex-col items-center gap-2 py-3 bg-[hsl(220_30%_2%)] border-r border-border/40">
        {guilds.map((g) => {
          const active = g.id === activeId;
          const initials = g.name.slice(0, 2).toUpperCase();
          return (
            <Tooltip key={g.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onSelect(g.id)}
                  className="relative group"
                  aria-label={g.name}
                >
                  <span className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-primary transition-all",
                    active ? "h-8" : "h-0 group-hover:h-4"
                  )} />
                  <div className={cn(
                    "w-12 h-12 flex items-center justify-center overflow-hidden text-sm font-semibold transition-all",
                    active
                      ? "rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.5)]"
                      : "rounded-3xl bg-secondary text-foreground hover:rounded-xl hover:bg-primary/20"
                  )}>
                    {g.icon_url
                      ? <img src={g.icon_url} alt={g.name} className="w-full h-full object-cover" />
                      : initials}
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{g.name}</TooltipContent>
            </Tooltip>
          );
        })}

        <div className="w-8 h-px bg-border/60 my-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onCreate}
              size="icon"
              variant="ghost"
              className="w-12 h-12 rounded-3xl hover:rounded-xl bg-secondary/50 hover:bg-emerald-500/20 hover:text-emerald-400 transition-all"
              aria-label="Vytvořit server"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Vytvořit server</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onJoin}
              size="icon"
              variant="ghost"
              className="w-12 h-12 rounded-3xl hover:rounded-xl bg-secondary/50 hover:bg-primary/20 hover:text-primary transition-all"
              aria-label="Připojit přes kód"
            >
              <Compass className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Připojit se přes pozvánku</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
