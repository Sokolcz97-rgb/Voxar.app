import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ShopItem = {
  id: string;
  kind: "frame" | "plugin";
  title: string;
  description: string | null;
  price_czk: number;
  cosmetic_id: string | null;
  features: string[];
  image_url: string | null;
  sort_order: number;
  active: boolean;
};

export type ShopSettings = {
  id: string;
  paypal_email: string | null;
  paypal_me: string | null;
  iban: string | null;
  account_number: string | null;
  bank_recipient: string | null;
  donate_min: number;
  donate_max: number;
  refund_notice: string | null;
};

export function useShop() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [itemsRes, settingsRes] = await Promise.all([
      supabase.from("shop_items").select("*").order("sort_order").order("title"),
      supabase.from("shop_settings").select("*").limit(1).maybeSingle(),
    ]);
    setItems(((itemsRes.data ?? []) as unknown as ShopItem[]));
    setSettings((settingsRes.data as unknown as ShopSettings) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, settings, loading, refresh };
}
