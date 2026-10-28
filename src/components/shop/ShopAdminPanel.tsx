import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LicenseAdminDialog } from "@/components/shop/LicenseAdminDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Save, Upload, FileDown, KeyRound } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatBytes, formatDuration, removeShopFiles, uploadShopFile } from "@/lib/shopFiles";
import { useCosmeticStyles } from "@/hooks/useCosmeticStyles";
import { COSMETICS } from "@/lib/cosmetics";
import type { ShopItem, ShopSettings } from "@/hooks/useShop";

interface Props {
  items: ShopItem[];
  settings: ShopSettings | null;
  onRefresh: () => Promise<void> | void;
}

type DurationUnit = "hours" | "days" | "weeks" | "months";
const UNIT_MINUTES: Record<DurationUnit, number> = { hours: 60, days: 24 * 60, weeks: 7 * 24 * 60, months: 30 * 24 * 60 };

function splitDuration(minutes?: number | null): { value: number; unit: DurationUnit } {
  const m = minutes ?? 7 * 24 * 60;
  for (const unit of ["months", "weeks", "days", "hours"] as DurationUnit[]) {
    if (m % UNIT_MINUTES[unit] === 0) return { value: m / UNIT_MINUTES[unit], unit };
  }
  return { value: Math.max(1, Math.round(m / 60)), unit: "hours" };
}

const EMPTY: Partial<ShopItem> = {
  kind: "frame",
  title: "",
  description: "",
  price_czk: 0,
  cosmetic_id: null,
  features: [],
  sort_order: 0,
  active: true,
};

export function ShopAdminPanel({ items, settings, onRefresh }: Props) {
  const { styles } = useCosmeticStyles();
  const [editing, setEditing] = useState<Partial<ShopItem> | null>(null);
  const [featuresText, setFeaturesText] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<ShopSettings>>({});
  const [durationValue, setDurationValue] = useState(7);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("days");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<{ k: number; msg: string } | null>(null);
  const [licItem, setLicItem] = useState<ShopItem | null>(null);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const resetSoftware = (minutes?: number | null) => {
    const d = splitDuration(minutes);
    setDurationValue(d.value);
    setDurationUnit(d.unit);
    setPendingFile(null);
    setUpload(null);
  };

  const openNew = (kind: "frame" | "plugin" | "software") => {
    setEditing(kind === "software" ? { ...EMPTY, kind, sale_mode: "license", license_updates_days: 365 } : { ...EMPTY, kind });
    setFeaturesText("");
    resetSoftware(null);
  };

  const openEdit = (item: ShopItem) => {
    setEditing(item);
    setFeaturesText((item.features || []).join("\n"));
    resetSoftware(item.access_minutes);
  };

  const saveItem = async () => {
    if (!editing?.title?.trim()) {
      toast.error("Vyplň název");
      return;
    }
    setSaving(true);
    const software = editing.kind === "software";
    if (software && !editing.id && !pendingFile) {
      toast.error("Vyber soubor instalátoru (Setup).");
      return;
    }
    const payload = {
      kind: editing.kind ?? "frame",
      access_minutes: software ? UNIT_MINUTES.months : null,
      price_year_czk: software && editing.sale_mode !== "license" && editing.price_year_czk ? Math.max(0, Number(editing.price_year_czk)) : null,
      sale_mode: software ? editing.sale_mode ?? "subscription" : "subscription",
      license_updates_days: software ? Math.max(0, Number(editing.license_updates_days ?? 365)) : 365,
      pass_month_czk: software && editing.sale_mode === "license" && editing.pass_month_czk ? Math.max(0, Number(editing.pass_month_czk)) : null,
      pass_year_czk: software && editing.sale_mode === "license" && editing.pass_year_czk ? Math.max(0, Number(editing.pass_year_czk)) : null,
      product_key: software && editing.product_key?.trim() ? editing.product_key.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") : null,
      file_version: software ? editing.file_version || null : null,
      title: editing.title.trim(),
      description: editing.description || null,
      price_czk: Number(editing.price_czk) || 0,
      cosmetic_id: editing.cosmetic_id || null,
      features: featuresText.split("\n").map((f) => f.trim()).filter(Boolean),
      sort_order: Number(editing.sort_order) || 0,
      active: editing.active ?? true,
    };
    const res = editing.id
      ? await supabase.from("shop_items").update(payload).eq("id", editing.id).select("id").single()
      : await supabase.from("shop_items").insert(payload).select("id").single();
    if (res.error || !res.data) {
      setSaving(false);
      toast.error(res.error?.message ?? "Uložení se nezdařilo");
      return;
    }
    // nahrání instalátoru po částech (soukromé úložiště)
    if (software && pendingFile) {
      try {
        const meta = await uploadShopFile(res.data.id, pendingFile, (k, msg) => setUpload({ k, msg }));
        const old = editing.file_parts;
        const { error } = await supabase.from("shop_items").update(meta).eq("id", res.data.id);
        if (error) throw new Error(error.message);
        await removeShopFiles(old);
        setUpload({ k: 1, msg: "Soubor nahrán." });
      } catch (e) {
        setSaving(false);
        toast.error(e instanceof Error ? e.message : "Nahrání selhalo");
        return;
      }
    }
    setSaving(false);
    toast.success("Uloženo");
    setEditing(null);
    await onRefresh();
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("shop_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Smazáno");
    await onRefresh();
  };

  const saveSettings = async () => {
    if (!settings) return;
    const { error } = await supabase
      .from("shop_settings")
      .update({
        // PayPal se už nepoužívá (platby jen převodem / QR)
        paypal_email: null,
        paypal_me: null,
        iban: form.iban || null,
        account_number: form.account_number || null,
        bank_recipient: form.bank_recipient || null,
        donate_min: Number(form.donate_min) || 0,
        donate_max: Number(form.donate_max) || 500,
        refund_notice: form.refund_notice || null,
        stripe_enabled: !!form.stripe_enabled,
      })
      .eq("id", settings.id);
    if (error) return toast.error(error.message);
    toast.success("Nastavení uloženo");
    await onRefresh();
  };

  return (
    <div className="space-y-6">
      <Card className="glass border-primary/30 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display font-bold text-lg">Správa nabídky</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openNew("frame")}>
              <Plus className="h-4 w-4 mr-1" /> Rámeček
            </Button>
            <Button size="sm" variant="outline" onClick={() => openNew("plugin")}>
              <Plus className="h-4 w-4 mr-1" /> Plugin
            </Button>
            <Button size="sm" variant="outline" onClick={() => openNew("software")}>
              <Plus className="h-4 w-4 mr-1" /> Software
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 border border-border/60 px-3 py-2 text-sm"
            >
              <span className="text-xs uppercase tracking-wider text-muted-foreground w-16">
                {item.kind === "frame" ? "Rámeček" : item.kind === "software" ? (item.sale_mode === "license" ? "Licence" : "Předplatné") : "Plugin"}
              </span>
              <span className="font-medium flex-1 min-w-[140px]">
                {item.title}
                {item.kind === "software" && (
                  <span className="block text-xs text-muted-foreground font-normal">
                    {item.sale_mode === "license"
                      ? `${item.price_czk} Kč licence · aktualizace ${item.license_updates_days ?? 365} dní · pass ${item.pass_month_czk ?? "–"} Kč/měs., ${item.pass_year_czk ?? "–"} Kč/rok`
                      : item.price_year_czk ? `${item.price_czk} Kč/měs. · ${item.price_year_czk} Kč/rok` : `${item.price_czk} Kč/měs.`}{" "}
                    · {item.file_name ? `${item.file_name} (${formatBytes(item.file_size)})` : "soubor chybí"}
                  </span>
                )}
              </span>
              <span className="text-primary font-bold">{item.price_czk} Kč</span>
              {!item.active && <span className="text-xs text-destructive">skryto</span>}
              {item.kind === "software" && item.sale_mode === "license" && (
                <Button size="sm" variant="outline" onClick={() => setLicItem(item)} title="Přidělit / spravovat licence">
                  <KeyRound className="h-4 w-4 mr-1" /> Licence
                </Button>
              )}
              <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => removeItem(item.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">Zatím žádné položky.</p>
          )}
        </div>
      </Card>

      <Card className="glass border-primary/30 p-5 space-y-4">
        <h3 className="font-display font-bold text-lg">Platební nastavení</h3>
        <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
          <div className="text-sm">
            <p className="font-medium">Platba kartou (Stripe)</p>
            <p className="text-xs text-muted-foreground">
              Zákazník zaplatí kartou / Apple Pay / Google Pay na stránce Stripe a objednávka se po zaplacení potvrdí sama.
              Zapni až po nastavení klíčů STRIPE_SECRET_KEY a STRIPE_WEBHOOK_SECRET (Lovable Cloud → Secrets). Vrácení peněz
              u plateb kartou provedeš ve Stripe Dashboard.
            </p>
          </div>
          <Switch checked={!!form.stripe_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, stripe_enabled: v }))} />
        </div>
        <p className="text-xs text-muted-foreground">
          Zákazníci platí bankovním převodem nebo QR kódem na tento účet. Každá objednávka má vlastní variabilní symbol –
          podle něj platbu v bance spáruješ a potvrdíš v Admin → Nákupy.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>IBAN (pro QR platbu)</Label>
            <Input
              value={form.iban ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
              placeholder="CZ6508000000192000145399"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Číslo účtu (zobrazené)</Label>
            <Input
              value={form.account_number ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))}
              placeholder="1920001453/0800"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Příjemce</Label>
            <Input
              value={form.bank_recipient ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, bank_recipient: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dar min.</Label>
              <Input
                type="number"
                value={form.donate_min ?? 0}
                onChange={(e) => setForm((f) => ({ ...f, donate_min: Number(e.target.value) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dar max.</Label>
              <Input
                type="number"
                value={form.donate_max ?? 500}
                onChange={(e) => setForm((f) => ({ ...f, donate_max: Number(e.target.value) }))}
              />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Text o nevratnosti plateb</Label>
          <Textarea
            rows={2}
            value={form.refund_notice ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, refund_notice: e.target.value }))}
          />
        </div>
        <Button onClick={saveSettings}>
          <Save className="h-4 w-4 mr-1" /> Uložit nastavení
        </Button>
      </Card>

      <LicenseAdminDialog item={licItem} onClose={() => setLicItem(null)} />

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Upravit položku" : "Nová položka"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Typ</Label>
              <Select
                value={editing?.kind ?? "frame"}
                onValueChange={(v) => setEditing((e) => ({ ...e, kind: v as "frame" | "plugin" | "software" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="frame">Orámování (badge)</SelectItem>
                  <SelectItem value="plugin">Plugin code</SelectItem>
                  <SelectItem value="software">Software (licence nebo předplatné, se souborem ke stažení)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{editing?.kind === "plugin" ? "Název pluginu" : editing?.kind === "software" ? "Název produktu" : "Název rámečku"}</Label>
              <Input
                value={editing?.title ?? ""}
                onChange={(e) => setEditing((x) => ({ ...x, title: e.target.value }))}
              />
            </div>
            {editing?.kind === "frame" && (
              <div className="space-y-1.5">
                <Label>Napojený badge</Label>
                <Select
                  value={editing?.cosmetic_id ?? "none"}
                  onValueChange={(v) => setEditing((x) => ({ ...x, cosmetic_id: v === "none" ? null : v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Vyber badge" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— žádný —</SelectItem>
                    {COSMETICS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                    {styles.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editing?.kind === "software" && (
              <div className="space-y-4 border border-primary/30 p-3">
                <div className="space-y-1.5">
                  <Label>Způsob prodeje</Label>
                  <Select
                    value={editing?.sale_mode ?? "subscription"}
                    onValueChange={(v) => setEditing((x) => ({ ...x, sale_mode: v as "subscription" | "license" }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="license">Jednorázová licence + Upgrade pass</SelectItem>
                      <SelectItem value="subscription">Předplatné (měsíční / roční)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editing?.sale_mode === "license" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Cena licence (Kč, jednorázově)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editing?.price_czk ?? 0}
                        onChange={(e) => setEditing((x) => ({ ...x, price_czk: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Aktualizace v ceně (dní)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={editing?.license_updates_days ?? 365}
                        onChange={(e) => setEditing((x) => ({ ...x, license_updates_days: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Upgrade pass – měsíc (Kč)</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="prázdné = nenabízet"
                        value={editing?.pass_month_czk ?? ""}
                        onChange={(e) => setEditing((x) => ({ ...x, pass_month_czk: e.target.value === "" ? null : Number(e.target.value) }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Upgrade pass – rok (Kč)</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="prázdné = nenabízet"
                        value={editing?.pass_year_czk ?? ""}
                        onChange={(e) => setEditing((x) => ({ ...x, pass_year_czk: e.target.value === "" ? null : Number(e.target.value) }))}
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Klíč produktu pro aplikaci</Label>
                      <Input
                        value={editing?.product_key ?? ""}
                        placeholder="např. voxario-studio-engine"
                        onChange={(e) => setEditing((x) => ({ ...x, product_key: e.target.value }))}
                      />
                    </div>
                    <p className="col-span-2 text-xs text-muted-foreground">
                      Licence je trvalá. Aktualizace (nové verze ke stažení) platí uvedený počet dní od koupě; potom si je zákazník
                      prodlouží Upgrade passem – v obchodě nebo z aplikace přes odkaz
                      {" "}<code>/obchod?pass={editing?.product_key || "klíč"}</code>. Pass navazuje na konec aktualizací. Aplikace
                      zjistí stav licence přes <code>shop_license_status(&quot;{editing?.product_key || "klíč"}&quot;)</code>.
                    </p>
                  </div>
                ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Měsíční cena (Kč / 30 dní)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editing?.price_czk ?? 0}
                      onChange={(e) => setEditing((x) => ({ ...x, price_czk: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Roční cena (Kč / 365 dní)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="prázdné = jen měsíční"
                      value={editing?.price_year_czk ?? ""}
                      onChange={(e) =>
                        setEditing((x) => ({ ...x, price_year_czk: e.target.value === "" ? null : Number(e.target.value) }))
                      }
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Zákazník si vybere měsíční nebo roční tarif a může zapnout automatické obnovení – 3 dny před koncem
                    mu systém připraví platbu a pošle upozornění; po potvrzení platby se předplatné prodlouží.
                  </p>
                </div>
                )}
                <div className="space-y-1.5">
                  <Label>Verze (nepovinné)</Label>
                  <Input
                    value={editing?.file_version ?? ""}
                    onChange={(e) => setEditing((x) => ({ ...x, file_version: e.target.value }))}
                    placeholder="např. 1.2.0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Soubor předplatného – Setup / instalátor z tvého repozitáře (.exe, .msi, .zip…)</Label>
                  {editing?.file_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileDown className="h-3.5 w-3.5" /> Aktuální: {editing.file_name} ({formatBytes(editing.file_size)})
                    </p>
                  )}
                  <Input type="file" onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
                  {pendingFile && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Upload className="h-3.5 w-3.5" /> Po uložení se nahraje: {pendingFile.name} ({formatBytes(pendingFile.size)})
                    </p>
                  )}
                  {upload && (
                    <div className="space-y-1">
                      <Progress value={upload.k * 100} />
                      <p className="text-xs text-muted-foreground">{upload.msg}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Popis {editing?.kind === "plugin" ? "(iniciály / k čemu je)" : ""}</Label>
              <Textarea
                rows={3}
                value={editing?.description ?? ""}
                onChange={(e) => setEditing((x) => ({ ...x, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{editing?.kind === "software" ? "Co předplatné obsahuje / požadavky (jeden bod na řádek)" : "Co plugin umí / obsah balíčku (jeden bod na řádek)"}</Label>
              <Textarea rows={4} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className={`space-y-1.5 ${editing?.kind === "software" ? "hidden" : ""}`}>
                <Label>Cena (Kč)</Label>
                <Input
                  type="number"
                  value={editing?.price_czk ?? 0}
                  onChange={(e) => setEditing((x) => ({ ...x, price_czk: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Pořadí</Label>
                <Input
                  type="number"
                  value={editing?.sort_order ?? 0}
                  onChange={(e) => setEditing((x) => ({ ...x, sort_order: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editing?.active ?? true}
                onCheckedChange={(v) => setEditing((x) => ({ ...x, active: v }))}
              />
              <Label>Zobrazit v obchodě</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Zrušit</Button>
            <Button onClick={saveItem} disabled={saving}>{saving && upload ? "Nahrávám…" : "Uložit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
