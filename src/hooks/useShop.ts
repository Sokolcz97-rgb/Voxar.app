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
    const [itemsRes, publicRes, settingsRes] = await Promise.all([
      supabase.from("shop_items").select("*").order("sort_order").order("title"),
      supabase.rpc("get_public_shop_config"),
      // payment account details are only readable for signed-in users
      supabase.from("shop_settings").select("*").limit(1).maybeSingle(),
    ]);

    setItems((itemsRes.data ?? []) as unknown as ShopItem[]);

    const pub = (Array.isArray(publicRes.data) ? publicRes.data[0] : publicRes.data) as
      | { id: string; donate_min: number; donate_max: number; refund_notice: string | null }
      | undefined;
    const priv = settingsRes.data as unknown as ShopSettings | null;

    if (priv) {
      setSettings(priv);
    } else if (pub) {
      setSettings({
        id: pub.id,
        paypal_email: null,
        paypal_me: null,
        iban: null,
        account_number: null,
        bank_recipient: null,
        donate_min: pub.donate_min,
        donate_max: pub.donate_max,
        refund_notice: pub.refund_notice,
      });
    } else {
      setSettings(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { items, settings, loading, refresh };
}
