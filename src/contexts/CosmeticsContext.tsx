import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CosmeticRow {
  id: string;
  user_id: string;
  cosmetic_id: string;
  quantity: number;
  equipped: boolean;
}

interface CosmeticsContextType {
  /** user_id -> equipped cosmetic_id */
  equippedByUser: Record<string, string | null>;
  /** ask the provider to load a user's equipped cosmetic (batched) */
  trackUser: (userId?: string | null) => void;
  /** current user's inventory */
  myItems: CosmeticRow[];
  loadingMine: boolean;
  refreshMine: () => Promise<void>;
  setEquipped: (cosmeticId: string, equipped: boolean) => Promise<void>;
}

const CosmeticsContext = createContext<CosmeticsContextType | undefined>(undefined);

export function CosmeticsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [equippedByUser, setEquippedByUser] = useState<Record<string, string | null>>({});
  const [myItems, setMyItems] = useState<CosmeticRow[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const requested = useRef<Set<string>>(new Set());
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const ids = Array.from(pending.current);
    pending.current.clear();
    if (ids.length === 0) return;
    const { data } = await supabase
      .from("user_cosmetics")
      .select("user_id,cosmetic_id,equipped,quantity")
      .in("user_id", ids)
      .eq("equipped", true)
      .gt("quantity", 0);
    setEquippedByUser((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = null;
      });
      (data ?? []).forEach((r: { user_id: string; cosmetic_id: string }) => {
        next[r.user_id] = r.cosmetic_id;
      });
      return next;
    });
  }, []);

  const trackUser = useCallback(
    (userId?: string | null) => {
      if (!userId || requested.current.has(userId)) return;
      requested.current.add(userId);
      pending.current.add(userId);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 60);
    },
    [flush],
  );

  const refreshMine = useCallback(async () => {
    if (!user) {
      setMyItems([]);
      return;
    }
    setLoadingMine(true);
    const { data } = await supabase
      .from("user_cosmetics")
      .select("id,user_id,cosmetic_id,quantity,equipped")
      .eq("user_id", user.id)
      .gt("quantity", 0)
      .order("cosmetic_id");
    const rows = (data ?? []) as CosmeticRow[];
    setMyItems(rows);
    setEquippedByUser((prev) => ({
      ...prev,
      [user.id]: rows.find((r) => r.equipped)?.cosmetic_id ?? null,
    }));
    setLoadingMine(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      requested.current.add(user.id);
      void refreshMine();
    } else {
      setMyItems([]);
    }
  }, [user, refreshMine]);

  const setEquipped = useCallback(
    async (cosmeticId: string, equipped: boolean) => {
      if (!user) return;
      if (equipped) {
        // only one border at a time
        await supabase
          .from("user_cosmetics")
          .update({ equipped: false })
          .eq("user_id", user.id)
          .neq("cosmetic_id", cosmeticId);
      }
      await supabase
        .from("user_cosmetics")
        .update({ equipped })
        .eq("user_id", user.id)
        .eq("cosmetic_id", cosmeticId);
      await refreshMine();
    },
    [user, refreshMine],
  );

  const value = useMemo(
    () => ({ equippedByUser, trackUser, myItems, loadingMine, refreshMine, setEquipped }),
    [equippedByUser, trackUser, myItems, loadingMine, refreshMine, setEquipped],
  );

  return <CosmeticsContext.Provider value={value}>{children}</CosmeticsContext.Provider>;
}

export function useCosmetics() {
  const ctx = useContext(CosmeticsContext);
  if (!ctx) throw new Error("useCosmetics must be used within CosmeticsProvider");
  return ctx;
}

/** Returns the equipped cosmetic id for a user, loading it on demand. */
export function useUserCosmetic(userId?: string | null) {
  const ctx = useContext(CosmeticsContext);
  const trackUser = ctx?.trackUser;
  useEffect(() => {
    trackUser?.(userId);
  }, [userId, trackUser]);
  if (!ctx || !userId) return null;
  return ctx.equippedByUser[userId] ?? null;
}
