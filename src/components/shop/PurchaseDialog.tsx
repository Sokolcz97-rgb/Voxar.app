import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, QrCode, ShieldAlert } from "lucide-react";
import { paypalLink, spayd } from "@/lib/payments";
import type { ShopSettings } from "@/hooks/useShop";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  amount: number;
  note: string;
  settings: ShopSettings | null;
}

export function PurchaseDialog({ open, onOpenChange, title, amount, note, settings }: Props) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">{title}</DialogTitle>
          <DialogDescription>
            Částka k úhradě: <span className="text-primary font-bold">{amount} Kč</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Card className="glass border-border p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CreditCard className="h-4 w-4 text-primary" /> PayPal
            </div>
            {pp ? (
              <Button asChild className="w-full">
                <a href={pp} target="_blank" rel="noopener noreferrer">
                  Zaplatit přes PayPal
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">PayPal zatím není nastaven.</p>
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
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Bankovní účet pro QR platbu zatím není nastaven.</p>
            )}
          </Card>

          <p className="text-xs text-muted-foreground flex gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
            {settings?.refund_notice ||
              "Na dary ani na zakoupený digitální obsah neposkytujeme vrácení peněz (refund)."}
          </p>
          <p className="text-xs text-muted-foreground">
            Po zaplacení nám prosím napiš přes ticket nebo na Discordu, ať můžeme obsah přiřadit k tvému účtu.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
