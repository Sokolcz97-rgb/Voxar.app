import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, QrCode, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { paypalLink, spayd } from "@/lib/payments";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { ShopSettings } from "@/hooks/useShop";

export type PurchaseKind = "frame" | "plugin" | "software" | "donation";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  amount: number;
  note: string;
  settings: ShopSettings | null;
  kind?: PurchaseKind;
  itemId?: string | null;
  cosmeticId?: string | null;
  /** Předplatné: tarif a automatické obnovení. */
  period?: "month" | "year" | null;
  autoRenew?: boolean;
  /** Platba za obnovení, kterou už připravil systém (jen se zaznamená způsob platby). */
  renewalId?: string | null;
}

export function PurchaseDialog({
  open,
  onOpenChange,
  title,
  amount,
  note,
  settings,
  kind = "donation",
  itemId = null,
  cosmeticId = null,
  period = null,
  autoRenew = false,
  renewalId = null,
}: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (!open) {
      setRecorded(false);
      lastKey.current = "";
    }
  }, [open]);

  const pp = useMemo(
    () =>
      paypalLink({
        paypalMe: settings?.paypal_me,
        paypalEmail: settings?.paypal_email,
        amount,
        note,
      }),
    [settings, amount, note],
  );

  const qr = useMemo(
    () =>
      spayd({
        iban: settings?.iban,
        amount,
        message: note,
        recipient: settings?.bank_recipient,
      }),
    [settings, amount, note],
  );

  const record = async (method: "paypal" | "qr") => {
    if (!user) {
      toast.error("Pro dokončení objednávky se prosím přihlas.");
      return;
    }
    const key = `${itemId ?? kind}-${amount}-${method}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    setSaving(true);
    const { error } = renewalId
      ? await supabase.rpc("shop_renewal_pay", { p_purchase: renewalId, p_method: method })
      : await supabase.from("shop_purchases").insert({
          user_id: user.id,
          item_id: itemId,
          kind,
          title,
          amount_czk: amount,
          cosmetic_id: cosmeticId,
          requires_manual: kind === "plugin",
          payment_method: method,
          note,
          period: kind === "software" ? period ?? "month" : null,
          auto_renew: kind === "software" ? autoRenew : false,
        });
    setSaving(false);
    if (error) {
      lastKey.current = "";
      toast.error("Objednávku se nepodařilo zaznamenat.");
      return;
    }
    setRecorded(true);
    toast.success("Objednávka zaznamenána — po ověření platby ji aktivujeme.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>
            Částka k úhradě: <span className="text-primary font-bold">{amount} Kč</span>
            {kind === "software" && (
              <span className="block mt-1">
                {period === "year" ? "Roční předplatné (365 dní)" : "Měsíční předplatné (30 dní)"}
                {autoRenew ? " · automatické obnovení zapnuto" : ""}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!user && (
            <p className="text-sm text-destructive">
              Přihlas se, ať můžeme nákup přiřadit k tvému účtu a rámeček aktivovat automaticky.
            </p>
          )}

          <Card className="glass border-border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="h-4 w-4 text-primary" /> PayPal
            </div>
            {pp ? (
              <Button asChild className="w-full" disabled={!user}>
                <a href={pp} target="_blank" rel="noopener noreferrer" onClick={() => void record("paypal")}>
                  Zaplatit přes PayPal
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {user ? "PayPal zatím není nastaven." : "Platební údaje se zobrazí po přihlášení."}
              </p>
            )}
          </Card>

          <Card className="glass border-border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <QrCode className="h-4 w-4 text-primary" /> QR platba (české banky)
            </div>
            {qr ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-background p-3 border border-border">
                  <QRCodeSVG value={qr} size={176} />
                </div>
                <p className="text-xs text-muted-foreground text-center break-all">
                  {settings?.account_number || settings?.iban}
                  {settings?.bank_recipient ? ` · ${settings.bank_recipient}` : ""}
                </p>
                <p className="text-xs text-muted-foreground text-center">
                  Zpráva pro příjemce: <span className="text-foreground">{note}</span>
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={!user || saving || recorded}
                  onClick={() => void record("qr")}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : recorded ? (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  ) : null}
                  {recorded ? "Objednávka zaznamenána" : "Zaplaceno – zaznamenat objednávku"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {user ? "Bankovní účet pro QR platbu zatím není nastaven." : "Platební údaje se zobrazí po přihlášení."}
              </p>
            )}
          </Card>

          <p className="text-xs text-muted-foreground flex gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
            {settings?.refund_notice ||
              "Na dary ani na zakoupený digitální obsah neposkytujeme vrácení peněz (refund)."}
          </p>
          {kind === "software" && autoRenew && (
            <p className="text-xs text-muted-foreground">
              Automatické obnovení: 3 dny před koncem ti připravíme platbu za další období a pošleme upozornění.
              Stačí ji zaplatit – předplatné se po ověření prodlouží. Vypnout to můžeš kdykoli v Obchodě → Předplatné.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Po ověření platby ti rámeček aktivujeme automaticky; ručně spravované položky (např. pluginy) se
            objeví jako zakázka.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
