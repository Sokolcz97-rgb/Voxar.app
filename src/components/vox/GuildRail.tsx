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

function GuildGlyph({ guild }: { guild: VoxGuild }) {
  const initials = guild.name.slice(0, 2).toUpperCase();
  return (
    <CosmeticFrame cosmeticId={guild.cosmetic_id} className="sv-guild-frame">
      <span className="sv-guild-icon">
        {guild.icon_url
          ? <img src={guild.icon_url} alt="" loading="lazy" decoding="async" />
          : <span>{initials}</span>}
      </span>
    </CosmeticFrame>
  );
}

export function GuildRail({ guilds, activeId, onSelect, onCreate, onJoin }: Props) {
  const activeGuild = guilds.find((guild) => guild.id === activeId) ?? guilds[0] ?? null;
  const otherGuilds = guilds.filter((guild) => guild.id !== activeGuild?.id);

  return (
    <div className="sv-guild-rail sv-guild-rail-v18" aria-label="Komunity">
      {activeGuild ? (
        <button
          type="button"
          className="sv-guild-rail-primary active"
          onClick={() => onSelect(activeGuild.id)}
          title={activeGuild.name}
          aria-label={`Aktivní komunita ${activeGuild.name}`}
        >
          <span className="sv-guild-primary-mark" aria-hidden="true" />
          <GuildGlyph guild={activeGuild} />
          <span className="sv-guild-primary-pulse" aria-hidden="true" />
        </button>
      ) : (
        <div className="sv-guild-rail-primary sv-guild-rail-placeholder" aria-hidden="true">
          <span>SV</span>
        </div>
      )}

      <span className="sv-guild-rail-separator" aria-hidden="true" />

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
        {otherGuilds.map((guild) => (
          <button
            key={guild.id}
            type="button"
            className="sv-guild-rail-item"
            onClick={() => onSelect(guild.id)}
            title={guild.name}
            aria-label={guild.name}
          >
            <span className="sv-guild-active-mark" aria-hidden="true" />
            <GuildGlyph guild={guild} />
          </button>
        ))}
      </div>

      <div className="sv-guild-rail-spacer" aria-hidden="true" />

      <button
        type="button"
        className="sv-guild-rail-join"
        onClick={onJoin}
        title="Připojit se ke komunitě"
        aria-label="Připojit se ke komunitě"
      >
        <LogIn />
      </button>

      <div className="sv-guild-rail-status" aria-hidden="true">
        <span />
        <small>LINK</small>
      </div>
    </div>
  );
}
