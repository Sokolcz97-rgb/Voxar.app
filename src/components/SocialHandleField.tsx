import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AtSign, ExternalLink, Link as LinkIcon, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Platform = "twitch" | "youtube" | "kick";

interface Props {
  id: string;
  label: string;
  color: string;
  platform: Platform;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Hide the surrounding Label (use when embedded in a form with its own label) */
  hideLabel?: boolean;
}

interface Suggestion {
  handle: string;
  display_name: string;
  url: string;
  avatar_url: string | null;
}

/** Extract a clean handle from either a raw username/@handle or a full URL. */
export function extractHandle(platform: Platform, raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";

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
        const first = parts[0] ?? "";
        if (first.startsWith("@")) return first;
        if (["c", "user", "channel"].includes(first) && parts[1]) {
          return first === "channel" ? parts[1] : `@${parts[1]}`;
        }
        if (first) return first.startsWith("@") ? first : `@${first}`;
      }
    } catch {
      /* fall through */
    }
  }

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
  hideLabel,
}: Props) {
  const url = useMemo(() => buildUrl(platform, value), [platform, value]);
  const display = useMemo(() => {
    if (!value) return "";
    if (platform === "youtube") return value.startsWith("@") ? value : `@${value}`;
    return value;
  }, [platform, value]);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Live search (twitch / youtube). Kick nemá public search.
  useEffect(() => {
    if (platform === "kick") return;
    if (picked) return;
    const raw = value.trim();
    // Skip URLs and short strings
    if (!raw || /^https?:\/\//i.test(raw) || raw.includes("/") || raw.replace(/^@/, "").length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await supabase.functions.invoke("social-search", {
          body: { platform, query: raw.replace(/^@/, "") },
        });
        setSuggestions((data?.results as Suggestion[]) || []);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [value, platform, picked]);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text && (text.includes("/") || /^https?:/i.test(text))) {
      e.preventDefault();
      const cleaned = extractHandle(platform, text);
      if (cleaned) {
        setPicked(true);
        onChange(cleaned);
      }
    }
  };

  const onBlur = () => {
    if (!value) return;
    const cleaned = extractHandle(platform, value);
    if (cleaned !== value) onChange(cleaned);
  };

  const pick = (s: Suggestion) => {
    setPicked(true);
    onChange(s.handle);
    setOpen(false);
  };

  return (
    <div className="space-y-2" ref={wrapRef}>
      {!hideLabel && (
        <Label htmlFor={id} style={{ color }} className="flex items-center gap-2">
          {label}
          <span className="text-xs text-muted-foreground font-normal">
            — uživatelské jméno, URL kanálu, nebo začni psát pro vyhledání
          </span>
        </Label>
      )}
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
          onChange={(e) => {
            setPicked(false);
            onChange(e.target.value);
          }}
          onPaste={onPaste}
          onBlur={onBlur}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-28"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && (
          <Loader2 className="absolute right-24 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
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

        {open && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
            {suggestions.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => pick(s)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted transition-colors"
              >
                {s.avatar_url ? (
                  <img src={s.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-muted" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{s.display_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.handle}</div>
                </div>
              </button>
            ))}
          </div>
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
