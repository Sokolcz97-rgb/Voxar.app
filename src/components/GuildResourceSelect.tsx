import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

// Discord channel types
// 0 = GuildText, 2 = GuildVoice, 4 = GuildCategory, 5 = GuildAnnouncement,
// 13 = GuildStageVoice, 15 = GuildForum, 16 = GuildMedia
export type GuildChannel = {
  id: string;
  name: string;
  type: number;
  parent_id: string | null;
  position: number;
};
export type GuildRole = { id: string; name: string; color: number; position: number };
export type GuildResources = { channels: GuildChannel[]; roles: GuildRole[] };

const cache = new Map<string, Promise<GuildResources>>();

export function invalidateGuildResources(guildId: string) {
  cache.delete(guildId);
}

export async function fetchGuildResources(guildId: string): Promise<GuildResources> {
  if (!cache.has(guildId)) {
    cache.set(
      guildId,
      (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discord-guild-resources?guild_id=${guildId}`;
        const res = await fetch(url, {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          cache.delete(guildId);
          const t = await res.text();
          throw new Error(`Discord resources: ${t}`);
        }
        return res.json();
      })(),
    );
  }
  return cache.get(guildId)!;
}

export function useGuildResources(guildId: string | null) {
  const [data, setData] = useState<GuildResources | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) { setData(null); return; }
    let cancel = false;
    setLoading(true); setError(null);
    fetchGuildResources(guildId)
      .then((r) => { if (!cancel) setData(r); })
      .catch((e) => { if (!cancel) setError(e.message); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [guildId]);

  return { data, loading, error };
}

type Kind = "text" | "voice" | "category" | "any-channel" | "role";

const TYPE_LABEL: Record<number, string> = {
  0: "#", 2: "🔊", 4: "📁", 5: "📢", 13: "🎤", 15: "💬", 16: "🎞",
};

function filterChannels(channels: GuildChannel[], kind: Kind): GuildChannel[] {
  if (kind === "text") return channels.filter((c) => c.type === 0 || c.type === 5);
  if (kind === "voice") return channels.filter((c) => c.type === 2 || c.type === 13);
  if (kind === "category") return channels.filter((c) => c.type === 4);
  return channels.filter((c) => c.type !== 4);
}

export function GuildResourceSelect({
  guildId,
  kind,
  value,
  onChange,
  disabled,
  placeholder,
  allowEmpty = true,
}: {
  guildId: string | null;
  kind: Kind;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const { data, loading, error } = useGuildResources(guildId);

  // Fallback: no guild → free-text ID
  if (!guildId) {
    return (
      <Input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value.trim() || null)}
        placeholder={placeholder || "ID"}
        disabled={disabled}
      />
    );
  }

  if (error) {
    return (
      <div className="space-y-1">
        <Input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value.trim() || null)}
          placeholder={placeholder || "ID (Discord nedostupný)"}
          disabled={disabled}
        />
        <p className="text-xs text-destructive">Nelze načíst: {error}</p>
      </div>
    );
  }

  const items = useMemo(() => {
    if (!data) return [];
    if (kind === "role") return data.roles.map((r) => ({ id: r.id, label: r.name }));
    const filtered = filterChannels(data.channels, kind);
    // Group children under their categories for text/voice/any-channel
    if (kind === "category") {
      return filtered.map((c) => ({ id: c.id, label: `📁 ${c.name}` }));
    }
    const cats = new Map<string, string>();
    data.channels.filter((c) => c.type === 4).forEach((c) => cats.set(c.id, c.name));
    return filtered
      .sort((a, b) => {
        const ca = a.parent_id ? cats.get(a.parent_id) ?? "" : "";
        const cb = b.parent_id ? cats.get(b.parent_id) ?? "" : "";
        return ca.localeCompare(cb) || a.position - b.position;
      })
      .map((c) => ({
        id: c.id,
        label: `${TYPE_LABEL[c.type] || "#"} ${c.name}${c.parent_id && cats.get(c.parent_id) ? `  ·  ${cats.get(c.parent_id)}` : ""}`,
      }));
  }, [data, kind]);

  const NONE = "__none__";
  return (
    <Select
      value={value || (allowEmpty ? NONE : "")}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || loading}
    >
      <SelectTrigger>
        {loading ? (
          <span className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Načítání…</span>
        ) : (
          <SelectValue placeholder={placeholder || "Vyber"} />
        )}
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {allowEmpty && <SelectItem value={NONE}>— žádné —</SelectItem>}
        {items.map((it) => (
          <SelectItem key={it.id} value={it.id}>{it.label}</SelectItem>
        ))}
        {items.length === 0 && !loading && (
          <div className="px-2 py-3 text-xs text-muted-foreground">Nic k zobrazení</div>
        )}
      </SelectContent>
    </Select>
  );
}

export function GuildResourceLabel({
  guildId, id, kind,
}: { guildId: string | null; id: string | null | undefined; kind: "channel" | "role" }) {
  const { data } = useGuildResources(guildId);
  if (!id) return null;
  if (!data) return <code>#{id}</code>;
  if (kind === "role") {
    const r = data.roles.find((x) => x.id === id);
    return <span>@{r?.name ?? id}</span>;
  }
  const c = data.channels.find((x) => x.id === id);
  if (!c) return <code>#{id}</code>;
  return <span>{TYPE_LABEL[c.type] || "#"} {c.name}</span>;
}
