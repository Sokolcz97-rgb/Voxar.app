import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { getCosmetic } from "@/lib/cosmetics";
import { useCosmeticStyle } from "@/hooks/useCosmeticStyles";
import vipFrame from "@/assets/vip-supporter-frame.png.asset.json";

interface Props {
  /** Cosmetic (badge) id — built-in or uploaded through the admin panel. */
  cosmeticId?: string | null;
  className?: string;
  children: ReactNode;
}

/**
 * Wraps any square avatar-like element (user avatar, server hexagon) and
 * renders the equipped cosmetic frame as a centred transparent overlay.
 */
export function CosmeticFrame({ cosmeticId, className, children }: Props) {
  const builtin = getCosmetic(cosmeticId);
  const uploaded = useCosmeticStyle(builtin ? null : cosmeticId);

  if (!cosmeticId || (!builtin && !uploaded)) {
    return <>{children}</>;
  }

  const src = builtin?.id === "supporter_gold" ? vipFrame.url : uploaded?.image_url;
  const size = `${(builtin ? 135 : uploaded?.scale) || 135}%`;

  if (!src) return <>{children}</>;

  return (
    <span className={cn("relative inline-flex shrink-0 isolate", className)}>
      <span className="relative z-0 inline-flex">{children}</span>
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute z-10 max-w-none select-none"
        style={{ width: size, height: size, left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
      />
    </span>
  );
}
