import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Landmark, QrCode, ShieldAlert, Loader2, CheckCircle2, Copy, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { czAccountFromIban, spayd, variableSymbol } from "@/lib/payments";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { LEGAL_VERSION } from "@/components/legal/LegalPage";
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
  period?: "month" | "year" | "license" | "pass_month" | "pass_year" | null;
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
  const [accTerms, setAccTerms] = useState(false);
  const [accWaiver, setAccWaiver] = useState(false);
  const digital = kind !== "donation";
  const consented = accTerms && (!digital || accWaiver);

  useEffect(() => {
    if (!open) {
      setRecorded(false);
      lastKey.current = "";
      setAccTerms(false);
      setAccWaiver(false);
    }
  }, [open]);

  // ID objednávky známe předem → variabilní symbol pro spárování platby v bance.
  // U obnovení předplatného je objednávka už založená (renewalId).
  const orderId = useMemo(() => renewalId ?? crypto.randomUUID(), [renewalId, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const vs = useMemo(() => variableSymbol(orderId), [orderId]);
  const account = settings?.account_number || czAccountFromIban(settings?.iban) || null;

  const qr = useMemo(
    () =>
      spayd({
        iban: settings?.iban,
        amount,
        message: note,
        recipient: settings?.bank_recipient,
        vs,
      }),
    [settings, amount, note, vs],
  );

  const copy = (label: string, value: string) => {
    void navigator.clipboard?.writeText(value).then(
      () => toast.success(`${label} zkopírováno`),
      () => toast.error("Kopírování se nepovedlo"),
    );
  };

  const [paying, setPaying] = useState(false);
  const payByCard = async () => {
    if (!user) {
      toast.error("Pro platbu kartou se prosím přihlas.");
      return;
    }
    if (!consented) {
      toast.error("Nejdřív prosím potvrď souhlasy nad platebními možnostmi.");
      return;
    }
    setPaying(true);
    const { data, error } = await supabase.functions.invoke("stripe-checkout", {
      body: renewalId
        ? { renewal_id: renewalId, terms_version: LEGAL_VERSION, terms_accepted: true }
        : {
            kind,
            item_id: itemId,
            amount,
            note,
            period: kind === "software" ? period ?? "month" : null,
            auto_renew: kind === "software" ? autoRenew : false,
            terms_version: LEGAL_VERSION,
            terms_accepted: true,
          },
    });
    const url = (data as { url?: string } | null)?.url;
    if (error || !url) {
      setPaying(false);
      let msg = (data as { error?: string } | null)?.error;
      try {
        const ctx = (error as { context?: Response } | null)?.context;
        if (!msg && ctx) msg = (await ctx.json())?.error;
      } catch {
        /* ignore */
      }
      toast.error(msg || "Platební bránu se nepodařilo otevřít. Zkus to znovu nebo zaplať převodem.");
      return;
    }
    window.location.href = url;
  };

  const record = async (method: "qr") => {
    if (!user) {
      toast.error("Pro dokončení objednávky se prosím přihlas.");
      return;
    }
    if (!consented) {
      toast.error("Nejdřív prosím potvrď souhlasy nad platebními možnostmi.");
      return;
    }
    const now = new Date().toISOString();
    const key = `${itemId ?? kind}-${amount}-${method}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    setSaving(true);
    const { error } = renewalId
      ? await supabase.rpc("shop_renewal_pay", { p_purchase: renewalId, p_method: method, p_terms: LEGAL_VERSION })
      : await supabase.from("shop_purchases").insert({
          id: orderId,
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
          terms_version: LEGAL_VERSION,
          terms_accepted_at: now,
          waiver_accepted_at: digital ? now : null,
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
                {period === "license"
                  ? "Jednorázová trvalá licence (včetně aktualizací na dobu uvedenou u produktu)"
                  : period === "pass_year"
                    ? "Upgrade pass – prodloužení aktualizací o 365 dní"
                    : period === "pass_month"
                      ? "Upgrade pass – prodloužení aktualizací o 30 dní"
                      : period === "year"
                        ? "Roční předplatné (365 dní)"
                        : "Měsíční předplatné (30 dní)"}
                {autoRenew && (period === "month" || period === "year") ? " · automatické obnovení zapnuto" : ""}
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

          <div className="space-y-2 rounded-md border border-border p-3 text-xs leading-relaxed">
            <label className="flex gap-2 items-start cursor-pointer">
              <Checkbox checked={accTerms} onCheckedChange={(v) => setAccTerms(v === true)} className="mt-0.5" />
              <span>
                Souhlasím s{" "}
                <Link to="/obchodni-podminky" target="_blank" className="text-primary underline">obchodními podmínkami</Link>
                {digital && (
                  <>
                    {" "}a{" "}
                    <Link to="/licence" target="_blank" className="text-primary underline">licenčními podmínkami</Link>
                  </>
                )}{" "}
                a beru na vědomí{" "}
                <Link to="/privacy" target="_blank" className="text-primary underline">zásady ochrany osobních údajů</Link>.
              </span>
            </label>
            {digital && (
              <label className="flex gap-2 items-start cursor-pointer">
                <Checkbox checked={accWaiver} onCheckedChange={(v) => setAccWaiver(v === true)} className="mt-0.5" />
                <span>
                  Výslovně žádám o okamžité dodání digitálního obsahu{kind === "software" ? (period === "month" || period === "year" ? " (zahájení předplatného)" : " (aktivace licence / aktualizací)") : ""} před
                  uplynutím 14denní lhůty pro odstoupení a beru na vědomí, že jeho aktivací <strong>ztrácím právo na odstoupení
                  od smlouvy</strong> (§ 1837 písm. l) občanského zákoníku).
                  {kind === "software" && (period === "month" || period === "year") && " U předplatného mohu do 30 minut od aktivace požádat o vrácení peněz podle bodu 10 obchodních podmínek."}
                </span>
              </label>
            )}
            {kind === "donation" && <p className="text-muted-foreground">Dar je dobrovolný a nevrací se.</p>}
          </div>

          {settings?.stripe_enabled && (
            <Card className={`glass border-primary/40 p-4 space-y-3 ${consented ? "" : "opacity-50 pointer-events-none select-none"}`} aria-disabled={!consented}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-primary" /> Platba kartou
              </div>
              {!user ? (
                <p className="text-sm text-muted-foreground">Platba kartou je dostupná po přihlášení.</p>
              ) : amount < 15 ? (
                <p className="text-sm text-muted-foreground">Kartou lze platit od 15 Kč – pro menší částku použij převod.</p>
              ) : (
                <>
                  <Button className="w-full" disabled={!consented || paying} onClick={() => void payByCard()}>
                    {paying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                    Zaplatit kartou {amount} Kč
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Zabezpečená platba přes Stripe (karta, Apple Pay, Google Pay). Údaje o kartě zadáváš jen u Stripe –
                    objednávka se po zaplacení potvrdí sama.
                  </p>
                </>
              )}
            </Card>
          )}

          <Card className={`glass border-border p-4 space-y-3 ${consented ? "" : "opacity-50 pointer-events-none select-none"}`} aria-disabled={!consented}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Landmark className="h-4 w-4 text-primary" /> Bankovní převod / QR platba
            </div>
            {!user ? (
              <p className="text-sm text-muted-foreground">Platební údaje se zobrazí po přihlášení.</p>
            ) : !account && !qr ? (
              <p className="text-sm text-muted-foreground">Bankovní účet pro platbu zatím není nastaven.</p>
            ) : !consented ? (
              <p className="text-sm text-muted-foreground">Platební údaje a QR kód se zobrazí po potvrzení souhlasů výše.</p>
            ) : (
              <div className="flex flex-col items-center gap-3">
                {qr && (
                  <>
                    <div className="bg-white p-3 border border-border rounded">
                      <QRCodeSVG value={qr} size={184} />
                    </div>
                    <p className="text-xs text-muted-foreground text-center flex items-center gap-1">
                      <QrCode className="h-3.5 w-3.5" /> Naskenuj v aplikaci své banky – údaje se vyplní samy.
                    </p>
                  </>
                )}
                <div className="w-full grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1.5 text-sm items-center">
                  {(
                    [
                      ["Číslo účtu", account],
                      ["IBAN", settings?.iban ? settings.iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim() : null],
                      ["Částka", `${amount} Kč`],
                      ["Variabilní symbol", vs],
                      ["Zpráva", note],
                      ["Příjemce", settings?.bank_recipient],
                    ] as [string, string | null | undefined][]
                  )
                    .filter(([, v]) => !!v)
                    .map(([label, value]) => (
                      <div key={label} className="contents">
                        <span className="text-muted-foreground text-xs">{label}</span>
                        <span className={`break-all ${label === "Variabilní symbol" || label === "Částka" ? "font-bold text-primary" : ""}`}>{value}</span>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-primary p-1"
                          aria-label={`Kopírovat: ${label}`}
                          onClick={() => copy(label, label === "Částka" ? String(amount) : String(value).replace(/\s+/g, label === "IBAN" ? "" : " "))}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Při ručním zadání převodu nezapomeň na <strong>variabilní symbol</strong> – podle něj platbu přiřadíme k objednávce.
                </p>
                <Button
                  className="w-full"
                  disabled={saving || recorded}
                  onClick={() => void record("qr")}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : recorded ? (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  ) : null}
                  {recorded ? "Objednávka zaznamenána" : "Zaplatil(a) jsem – zaznamenat objednávku"}
                </Button>
              </div>
            )}
          </Card>

          <p className="text-xs text-muted-foreground flex gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
            {settings?.refund_notice ||
              "Zaplacené částky obecně nevracíme. U předplatného lze požádat o vrácení do 30 minut od aktivace."}
          </p>
          {kind === "software" && autoRenew && (
            <p className="text-xs text-muted-foreground">
              Automatické obnovení: 3 dny před koncem ti připravíme platbu za další období a pošleme upozornění.
              Stačí ji zaplatit – předplatné se po ověření prodlouží. Vypnout to můžeš kdykoli v Obchodě → Software.
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
