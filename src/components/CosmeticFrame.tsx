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
 * renders the equipped cosmetic frame around it.
 *
 * The frame keeps the wrapper's original footprint (1:1, never stretched) and
 * the avatar itself is scaled down so it sits fully inside the frame's hole —
 * nothing of the profile/server picture ends up hidden underneath the badge.
 */
export function CosmeticFrame({ cosmeticId, className, children }: Props) {
  const builtin = getCosmetic(cosmeticId);
  const uploaded = useCosmeticStyle(builtin ? null : cosmeticId);

  if (!cosmeticId || (!builtin && !uploaded)) {
    return <>{children}</>;
  }

  const src = builtin?.id === "supporter_gold" ? vipFrame.url : uploaded?.image_url;
  if (!src) return <>{children}</>;

  // `scale` describes how much bigger the badge is than the avatar.
  // The avatar is shrunk by the same factor so the total footprint stays 1:1.
  const overlayScale = (builtin ? 135 : uploaded?.scale) || 135;
  const inner = 100 / (overlayScale / 100);

  return (
    <span className={cn("relative inline-flex aspect-square shrink-0 isolate", className)}>
      <span
        className="absolute left-1/2 top-1/2 inline-flex items-center justify-center z-0"
        style={{ transform: `translate(-50%, -50%) scale(${inner / 100})` }}
      >
        {children}
      </span>
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        loading="lazy"
        decoding="async"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none object-contain"
      />
    </span>
  );
}
