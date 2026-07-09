import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { GuildResourceSelect, GuildResourceLabel } from "@/components/GuildResourceSelect";

export function MultiChannelPicker({
  guildId,
  value,
  onChange,
  disabled,
  placeholder,
  kind = "text",
}: {
  guildId: string | null;
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  kind?: "text" | "voice" | "category";
}) {
  const add = (id: string | null) => {
    if (!id || value.includes(id)) return;
    onChange([...value, id]);
  };
  const remove = (id: string) => onChange(value.filter((v) => v !== id));

  return (
    <div className="space-y-2">
      <GuildResourceSelect
        guildId={guildId}
        kind={kind as any}
        value={null}
        onChange={add}
        disabled={disabled}
        placeholder={placeholder || "Přidat kanál"}
        allowEmpty={false}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((id) => (
            <Badge key={id} variant="secondary" className="gap-1 pr-1">
              <GuildResourceLabel guildId={guildId} id={id} kind="channel" />
              {!disabled && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 ml-1"
                  onClick={() => remove(id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
