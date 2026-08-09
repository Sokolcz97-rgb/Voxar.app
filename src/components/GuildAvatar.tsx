import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  src?: string | null;
  name: string;
  className?: string;
  /** Tailwind text size for the fallback initials. */
  textClassName?: string;
}

/**
 * Server avatar with graceful fallback — never renders a broken image icon.
 * Falls back to a dark circle with the first two letters of the server name.
 */
export function GuildAvatar({ src, name, className, textClassName = "text-xs" }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  const initials = (name || "?").slice(0, 2).toUpperCase();

  if (!src || failed) {
    return (
      <div
        className={cn(
          "rounded-full bg-muted text-foreground flex items-center justify-center font-semibold shrink-0",
          textClassName,
          className,
        )}
        aria-label={name}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={cn("rounded-full object-cover shrink-0", className)}
    />
  );
}
