import { useUserCosmetic } from "@/contexts/CosmeticsContext";

/** Returns an extra className for `.rank-ring` elements based on the user's equipped cosmetic. */
export function useCosmeticRing(userId?: string | null) {
  const cosmetic = useUserCosmetic(userId);
  return cosmetic === "supporter_gold" ? "cosmetic-ring-supporter" : "";
}
