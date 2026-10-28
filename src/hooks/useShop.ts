import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ShopItem = {
  id: string;
  kind: "frame" | "plugin" | "software";
  title: string;
  description: string | null;
  price_czk: number;
  /** Předplatné: cena ročního tarifu (null = jen měsíční). price_czk je měsíční cena. */
  price_year_czk?: number | null;
  cosmetic_id: string | null;
  features: string[];
  image_url: string | null;
  sort_order: number;
  active: boolean;
  /** Software: doba přístupu ke stažení po zaplacení (minuty). */
  access_minutes?: number | null;
  file_name?: string | null;
  file_size?: number | null;
  file_sha256?: string | null;
  file_version?: string | null;
  file_parts?: string[];
  file_uploaded_at?: string | null;
  /** Software: "subscription" = měsíční/roční předplatné, "license" = jednorázová licence + Upgrade pass. */
  sale_mode?: "subscription" | "license";
  /** Licence: počet dní aktualizací v ceně licence (price_czk). */
  license_updates_days?: number;
  /** Licence: cena Upgrade passu (prodloužení aktualizací) na měsíc / rok. */
  pass_month_czk?: number | null;
  pass_year_czk?: number | null;
  /** Klíč produktu pro aplikaci (např. voxario-studio-engine) – odkazy z enginu do obchodu. */
  product_key?: string | null;
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
  stripe_enabled: boolean;
};

export function useShop() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [itemsRes, publicRes] = await Promise.all([
      supabase.from("shop_items").select("*").order("sort_order").order("title"),
      supabase.rpc("get_public_shop_config"),
    ]);

    setItems((itemsRes.data ?? []) as unknown as ShopItem[]);

    const pub = (Array.isArray(publicRes.data) ? publicRes.data[0] : publicRes.data) as
      | {
          id: string;
          donate_min: number;
          donate_max: number;
          refund_notice: string | null;
          paypal_me: string | null;
          iban: string | null;
          account_number: string | null;
          bank_recipient: string | null;
          stripe_enabled?: boolean | null;
        }
      | undefined;

    if (pub) {
      setSettings({
        id: pub.id,
        paypal_email: null,
        paypal_me: pub.paypal_me,
        iban: pub.iban,
        account_number: pub.account_number,
        bank_recipient: pub.bank_recipient,
        donate_min: pub.donate_min,
        donate_max: pub.donate_max,
        refund_notice: pub.refund_notice,
        stripe_enabled: !!pub.stripe_enabled,
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
