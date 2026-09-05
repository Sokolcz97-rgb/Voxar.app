import { memo, useCallback } from "react";
import { LogIn, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { CosmeticFrame } from "@/components/CosmeticFrame";
import voxLogo from "@/assets/vox-logo.png.asset.json";

export interface VoxGuild {
  id: string;
  name: string;
  icon_url: string | null;
  cosmetic_id?: string | null;
}

interface Props {
  guilds: VoxGuild[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onJoin: () => void;
}

const GuildButton = memo(function GuildButton({
  guild, active, onSelect,
}: { guild: VoxGuild; active: boolean; onSelect: (id: string) => void }) {
  const initials = guild.name.slice(0, 2).toUpperCase();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => onSelect(guild.id)}
          className="perf-row group relative shrink-0 flex items-center gap-4 bg-transparent border-0 p-0 overflow-visible transition-all"
          aria-label={guild.name}
        >
          <div className="guild-logo-stage w-[72px] h-[72px] p-2 shrink-0 flex items-center justify-center overflow-visible">
            <CosmeticFrame cosmeticId={guild.cosmetic_id} className="w-14 h-14">
              <div className={cn("hex-ring w-14 h-14 transition-all shrink-0 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]", active && "speaking-ring")}>
                <div className={cn(
                  "hex-frame w-full h-full flex items-center justify-center text-sm font-display font-bold overflow-hidden border border-primary/40",
                  active
                    ? "bg-gradient-to-br from-primary/40 to-accent/20 text-primary-foreground text-glow"
                    : "bg-secondary/80 text-primary/80 group-hover:bg-primary/25 group-hover:text-primary"
                )}>
                  {guild.icon_url
                    ? <img loading="lazy" decoding="async" src={guild.icon_url} alt={guild.name} className="w-full h-full object-cover" />
                    : initials}
                </div>
              </div>
            </CosmeticFrame>
          </div>

          <span className={cn(
            "hidden md:block max-w-[10rem] xl:max-w-[16rem] truncate text-left font-display text-[12px] tracking-[0.22em] uppercase transition-colors",
            active ? "text-primary text-glow" : "text-primary/55 group-hover:text-primary/90"
          )}>
            {guild.name}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="holo-context-menu font-display tracking-wider text-xs uppercase">
        {guild.name}
      </TooltipContent>
    </Tooltip>
  );
});

export function GuildRail({ guilds, activeId, onSelect, onCreate, onJoin }: Props) {
  const handleSelect = useCallback((id: string) => onSelect(id), [onSelect]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full flex flex-wrap items-center gap-4 px-2 py-3 overflow-visible">
        <div className="flex items-center gap-4 shrink-0 overflow-visible">
          <div className="w-16 h-16 shrink-0 my-1 flex items-center justify-center overflow-visible bg-transparent border-0">
            <img loading="lazy" decoding="async"
              src={voxLogo.url}
              alt="Voxar.app logo"
              className="w-12 h-12 object-contain drop-shadow-[0_0_14px_hsl(var(--primary)/0.65)]"
            />
          </div>
          <div className="text-[9px] font-display tracking-[0.3em] text-primary/75 text-glow uppercase leading-[1.4] hidden sm:block">
            VOXAR<br />.APP
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2.5">
          {guilds.map((guild) => (
            <GuildButton key={guild.id} guild={guild} active={guild.id === activeId} onSelect={handleSelect} />
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onCreate}
                aria-label="Vytvořit komunitu"
                className="vox-guild-action group relative h-11 w-11 flex items-center justify-center bg-[hsl(222_42%_9%)] border border-emerald-400/45 text-emerald-300 hover:bg-emerald-500/12 hover:border-emerald-400/80 transition-colors"
              >
                <Plus className="w-5 h-5" strokeWidth={1.7} />
                <span className="sr-only">Vytvořit komunitu</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="holo-context-menu text-xs">Vytvořit komunitu</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onJoin}
                aria-label="Připojit se přes kód"
                className="vox-guild-action group relative h-11 w-11 flex items-center justify-center bg-[hsl(222_42%_9%)] border border-primary/45 text-primary hover:bg-primary/12 hover:border-primary/80 transition-colors"
              >
                <LogIn className="w-5 h-5" strokeWidth={1.7} />
                <span className="sr-only">Připojit se přes kód</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="holo-context-menu text-xs">Připojit se přes kód</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
