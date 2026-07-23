import { Plus, Compass } from "lucide-react";
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
      <div className="w-[72px] h-full flex flex-col items-center gap-3 py-3 bg-transparent">
        {/* Blueprint: STUDIO // VOXARIO monogram badge */}
        <div className="w-12 h-12 hex-frame bg-gradient-to-br from-primary/30 to-accent/10 border border-primary/40 flex items-center justify-center shadow-[0_0_18px_hsl(var(--primary)/0.45)]">
          <span className="font-display font-black text-[13px] tracking-widest text-primary text-glow">SV</span>
        </div>
        <div className="text-[8px] font-display tracking-[0.35em] text-primary/70 text-glow uppercase leading-none">
          STUDIO<br/>VOXARIO
        </div>
        <div className="w-8 h-px bg-primary/40 shadow-[0_0_6px_hsl(var(--primary))]" />

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
                  style={{ ["--rank-color" as any]: active ? "hsl(184 100% 54%)" : "hsl(184 100% 54% / 0.35)" }}
                >
                  <span className={cn(
                    "absolute -left-3 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-primary transition-all shadow-[0_0_10px_hsl(var(--primary))]",
                    active ? "h-9" : "h-0 group-hover:h-4"
                  )} />
                  <div className={cn(
                    "hex-ring w-12 h-12 transition-all",
                    active && "speaking-ring"
                  )}>
                    <div className={cn(
                      "hex-frame w-full h-full flex items-center justify-center text-sm font-display font-bold overflow-hidden",
                      active
                        ? "bg-gradient-to-br from-primary/40 to-accent/20 text-primary-foreground text-glow"
                        : "bg-secondary/80 text-primary/80 group-hover:bg-primary/25 group-hover:text-primary"
                    )}>
                      {g.icon_url
                        ? <img src={g.icon_url} alt={g.name} className="w-full h-full object-cover" />
                        : initials}
                    </div>
                  </div>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="holo-context-menu font-display tracking-wider text-xs uppercase">
                {g.name}
              </TooltipContent>
            </Tooltip>
          );
        })}

        <div className="w-8 h-px bg-primary/40 my-1 shadow-[0_0_6px_hsl(var(--primary))]" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onCreate}
              className="w-12 h-12 hex-frame flex items-center justify-center bg-secondary/50 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-400/40 transition-all hover:shadow-[0_0_16px_hsl(160_84%_45%/0.5)]"
              aria-label="Vytvořit sektor"
            >
              <Plus className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="holo-context-menu text-xs uppercase tracking-wider">Vytvořit sektor</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onJoin}
              className="w-12 h-12 hex-frame flex items-center justify-center bg-secondary/50 hover:bg-primary/25 text-primary border border-primary/40 transition-all hover:shadow-[0_0_16px_hsl(var(--primary)/0.5)]"
              aria-label="Připojit přes kód"
            >
              <Compass className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="holo-context-menu text-xs uppercase tracking-wider">Připojit přes pozvánku</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
