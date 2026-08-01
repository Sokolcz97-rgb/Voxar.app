import { Plus, Compass } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import voxLogo from "@/assets/vox-logo.png.asset.json";

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

/**
 * Blueprint layout: horizontal sector dock, centered at the top of the HUD.
 */
export function GuildRail({ guilds, activeId, onSelect, onCreate, onJoin }: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full flex flex-wrap items-center gap-4 px-2 py-1.5">
        {/* Voxar.app logo — jediná část s podkladem */}
        <div className="holo-pod flex items-center gap-2.5 shrink-0 px-3 py-1.5">
          <img
            src={voxLogo.url}
            alt="Voxar.app logo"
            className="w-11 h-11 object-contain drop-shadow-[0_0_14px_hsl(var(--primary)/0.55)]"
          />
          <div className="text-[9px] font-display tracking-[0.35em] text-primary/75 text-glow uppercase leading-[1.4] hidden sm:block">
            VOX<br />.APP
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2.5">
          {guilds.map((g) => {
            const active = g.id === activeId;
            const initials = g.name.slice(0, 2).toUpperCase();
            return (
              <Tooltip key={g.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelect(g.id)}
                    className={cn(
                      "relative group shrink-0 flex items-center gap-2.5 pr-3 rounded-md transition-all",
                      active ? "bg-primary/10" : "hover:bg-primary/5"
                    )}
                    aria-label={g.name}
                    style={{ ["--rank-color" as any]: active ? "hsl(184 100% 54%)" : "hsl(184 100% 54% / 0.35)" }}
                  >
                    <div className={cn("hex-ring w-12 h-12 transition-all shrink-0", active && "speaking-ring")}>
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
                    <span className={cn(
                      "hidden md:block max-w-[10rem] xl:max-w-[16rem] truncate text-left font-display text-[11px] tracking-[0.18em] uppercase transition-colors",
                      active ? "text-primary text-glow" : "text-primary/60 group-hover:text-primary/90"
                    )}>
                      {g.name}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="holo-context-menu font-display tracking-wider text-xs uppercase">
                  {g.name}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>



        <div className="flex items-center gap-3 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCreate}
                className="w-11 h-11 hex-frame flex items-center justify-center bg-secondary/50 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-400/40 transition-all hover:shadow-[0_0_16px_hsl(160_84%_45%/0.5)]"
                aria-label="Vytvořit sektor"
              >
                <Plus className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="holo-context-menu text-xs uppercase tracking-wider">Vytvořit sektor</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onJoin}
                className="w-11 h-11 hex-frame flex items-center justify-center bg-secondary/50 hover:bg-primary/25 text-primary border border-primary/40 transition-all hover:shadow-[0_0_16px_hsl(var(--primary)/0.5)]"
                aria-label="Připojit přes kód"
              >
                <Compass className="w-5 h-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="holo-context-menu text-xs uppercase tracking-wider">Připojit přes pozvánku</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
