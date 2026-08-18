export type CosmeticId = "supporter_gold";

export interface CosmeticDef {
  id: CosmeticId;
  name: string;
  description: string;
  /** CSS class applied to the avatar wrapper */
  className: string;
}

export const COSMETICS: CosmeticDef[] = [
  {
    id: "supporter_gold",
    name: "Podporovatel",
    description:
      "Zlatý hexagonální rámeček pro early testery a podporovatele. Záře, vnitřní glow a prémiový vzhled.",
    className: "cosmetic-supporter",
  },
];

export const getCosmetic = (id?: string | null) =>
  COSMETICS.find((c) => c.id === id) ?? null;
