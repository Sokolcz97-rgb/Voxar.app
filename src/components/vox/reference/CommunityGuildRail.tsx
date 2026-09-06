import { LogIn, Plus } from "lucide-react";
import { CosmeticFrame } from "@/components/CosmeticFrame";
import type { VoxGuild } from "@/components/vox/GuildRail";

interface Props {
  guilds: VoxGuild[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onJoin: () => void;
}

export function CommunityGuildRail({ guilds, activeId, onSelect, onCreate, onJoin }: Props) {
  const otherGuilds = guilds.filter((guild) => guild.id !== activeId);

  return (
    <div className="sv-guild-rail" aria-label="Komunity">
      <div className="sv-guild-rail-home" aria-hidden="true">
        <span className="sv-guild-home-hex"><b>SV</b></span>
      </div>

      <button
        type="button"
        className="sv-guild-rail-create"
        onClick={onCreate}
        title="Vytvořit komunitu"
        aria-label="Vytvořit komunitu"
      >
        <Plus />
      </button>

      <div className="sv-guild-rail-list">
        {otherGuilds.map((guild) => {
          const initials = guild.name.slice(0, 2).toUpperCase();

          return (
            <button
              key={guild.id}
              type="button"
              className="sv-guild-rail-item"
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

      <button
        type="button"
        className="sv-guild-rail-join"
        onClick={onJoin}
        title="Připojit se ke komunitě"
        aria-label="Připojit se ke komunitě"
      >
        <LogIn />
      </button>

      <div className="sv-guild-rail-spacer" aria-hidden="true" />
    </div>
  );
}
