import { useUserCosmetic } from "@/contexts/CosmeticsContext";

/** Returns an extra className for `.rank-ring` elements based on the user's equipped cosmetic. */
export function useCosmeticRing(userId?: string | null) {
  const cosmetic = useUserCosmetic(userId);
  return cosmetic === "supporter_gold" ? "cosmetic-ring-supporter" : "";
}

import { useContext, useEffect, useMemo } from "react";
import { useCosmeticsSafe } from "@/contexts/CosmeticsContext";

/** Batch variant: map of userId -> ring className. */
export function useCosmeticRings(userIds: string[]) {
  const ctx = useCosmeticsSafe();
  const key = userIds.join(",");
  useEffect(() => {
    userIds.forEach((id) => ctx?.trackUser(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ctx]);
  return useMemo(() => {
    const out: Record<string, string> = {};
    userIds.forEach((id) => {
      out[id] = ctx?.equippedByUser[id] === "supporter_gold" ? "cosmetic-ring-supporter" : "";
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ctx?.equippedByUser]);
}
