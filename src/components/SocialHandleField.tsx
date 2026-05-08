import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AtSign, ExternalLink, Link as LinkIcon } from "lucide-react";

type Platform = "twitch" | "youtube" | "kick";

interface Props {
  id: string;
  label: string;
  color: string;
  platform: Platform;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

/** Extract a clean handle from either a raw username/@handle or a full URL. */
export function extractHandle(platform: Platform, raw: string): string {
  let s = (raw || "").trim();
  if (!s) return "";

  // If the user pasted a URL, parse it
  if (/^https?:\/\//i.test(s) || s.includes("/")) {
    try {
      const url = new URL(s.startsWith("http") ? s : `https://${s}`);
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      const parts = url.pathname.split("/").filter(Boolean);

      if (platform === "twitch" && host.endsWith("twitch.tv")) {
        return parts[0] ?? "";
      }
      if (platform === "kick" && host.endsWith("kick.com")) {
        return parts[0] ?? "";
      }
      if (
        platform === "youtube" &&
        (host.endsWith("youtube.com") || host === "youtu.be")
      ) {
        // /@handle, /c/name, /user/name, /channel/UCxxxx
        const first = parts[0] ?? "";
        if (first.startsWith("@")) return first;
        if (["c", "user", "channel"].includes(first) && parts[1]) {
          // For /channel/UCxxx we keep raw id; for c/user we keep name
          return first === "channel" ? parts[1] : `@${parts[1]}`;
        }
        if (first) return first.startsWith("@") ? first : `@${first}`;
      }
    } catch {
      /* fall through */
    }
  }

  // Plain text input
  if (platform === "youtube") {
    return s.startsWith("@") ? s : `@${s.replace(/^@+/, "")}`;
  }
  return s.replace(/^@+/, "");
}

function buildUrl(platform: Platform, handle: string): string | null {
  const h = extractHandle(platform, handle).trim();
  if (!h) return null;
  if (platform === "twitch") return `https://twitch.tv/${h.replace(/^@/, "")}`;
  if (platform === "kick") return `https://kick.com/${h.replace(/^@/, "")}`;
  if (platform === "youtube") {
    const v = h.startsWith("@") ? h : `@${h}`;
    return `https://www.youtube.com/${v}`;
  }
  return null;
}

function openExternalUrl(url: string) {
  const popup = window.open("about:blank", "_blank", "noopener,noreferrer");
  if (popup) {
    popup.opener = null;
    popup.location.href = url;
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function SocialHandleField({
  id,
  label,
  color,
  platform,
  value,
  onChange,
  placeholder,
}: Props) {
  const url = useMemo(() => buildUrl(platform, value), [platform, value]);
  const display = useMemo(() => {
    if (!value) return "";
    if (platform === "youtube")
      return value.startsWith("@") ? value : `@${value}`;
    return value;
  }, [platform, value]);

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text && (text.includes("/") || /^https?:/i.test(text))) {
      e.preventDefault();
      const cleaned = extractHandle(platform, text);
      if (cleaned) onChange(cleaned);
    }
  };

  const onBlur = () => {
    if (!value) return;
    const cleaned = extractHandle(platform, value);
    if (cleaned !== value) onChange(cleaned);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id} style={{ color }} className="flex items-center gap-2">
        {label}
        <span className="text-xs text-muted-foreground font-normal">
          — uživatelské jméno nebo URL kanálu
        </span>
      </Label>
      <div className="relative">
        <span
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        >
          {/^https?:/i.test(value) ? (
            <LinkIcon className="h-4 w-4" />
          ) : (
            <AtSign className="h-4 w-4" />
          )}
        </span>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          onBlur={onBlur}
          placeholder={placeholder}
          className="pl-9 pr-28"
          autoComplete="off"
          spellCheck={false}
        />
        {url && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openExternalUrl(url);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs"
            style={{ color }}
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Otevřít
          </Button>
        )}
      </div>
      {display && (
        <p className="text-xs text-muted-foreground truncate">
          Náhled: <span style={{ color }}>{display}</span>
          {url && (
            <>
              {" · "}
              <span className="opacity-70">{url.replace(/^https?:\/\//, "")}</span>
            </>
          )}
        </p>
      )}
    </div>
  );
}
