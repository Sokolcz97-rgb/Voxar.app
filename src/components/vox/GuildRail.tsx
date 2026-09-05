import { LogIn, Plus } from "lucide-react";
import { CosmeticFrame } from "@/components/CosmeticFrame";

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

export function GuildRail({ guilds, activeId, onSelect, onCreate, onJoin }: Props) {
  return (
    <div className="sv-guild-rail" aria-label="Komunity">
      <div className="sv-guild-rail-list">
        {guilds.map((guild) => {
          const active = guild.id === activeId;
          const initials = guild.name.slice(0, 2).toUpperCase();

          return (
            <button
              key={guild.id}
              type="button"
              className={`sv-guild-rail-item${active ? " active" : ""}`}
              onClick={() => onSelect(guild.id)}
              title={guild.name}
              aria-label={guild.name}
            >
              <span className="sv-guild-active-mark" aria-hidden="true" />
              <CosmeticFrame cosmeticId={guild.cosmetic_id} className="sv-guild-frame">
                <span className="sv-guild-icon">
                  {guild.icon_url
                    ? <img src={guild.icon_url} alt="" loading="lazy" decoding="async" />
                    : <span>{initials}</span>}
                </span>
              </CosmeticFrame>
            </button>
          );
        })}
      </div>

      <div className="sv-guild-rail-actions">
        <button type="button" onClick={onCreate} title="Vytvořit komunitu" aria-label="Vytvořit komunitu">
          <Plus />
        </button>
        <button type="button" onClick={onJoin} title="Připojit se ke komunitě" aria-label="Připojit se ke komunitě">
          <LogIn />
        </button>
      </div>
    </div>
  );
}
