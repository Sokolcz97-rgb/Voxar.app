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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Save } from "lucide-react";
import { useCosmeticStyles } from "@/hooks/useCosmeticStyles";
import { COSMETICS } from "@/lib/cosmetics";
import type { ShopItem, ShopSettings } from "@/hooks/useShop";

interface Props {
  items: ShopItem[];
  settings: ShopSettings | null;
  onRefresh: () => Promise<void> | void;
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

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const openNew = (kind: "frame" | "plugin") => {
    setEditing({ ...EMPTY, kind });
    setFeaturesText("");
  };

  const openEdit = (item: ShopItem) => {
    setEditing(item);
    setFeaturesText((item.features || []).join("\n"));
  };

  const saveItem = async () => {
    if (!editing?.title?.trim()) {
      toast.error("Vyplň název");
      return;
    }
    setSaving(true);
    const payload = {
      kind: editing.kind ?? "frame",
      title: editing.title.trim(),
      description: editing.description || null,
      price_czk: Number(editing.price_czk) || 0,
      cosmetic_id: editing.cosmetic_id || null,
      features: featuresText.split("\n").map((f) => f.trim()).filter(Boolean),
      sort_order: Number(editing.sort_order) || 0,
      active: editing.active ?? true,
    };
    const res = editing.id
      ? await supabase.from("shop_items").update(payload).eq("id", editing.id)
      : await supabase.from("shop_items").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
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
        paypal_email: form.paypal_email || null,
        paypal_me: form.paypal_me || null,
        iban: form.iban || null,
        account_number: form.account_number || null,
        bank_recipient: form.bank_recipient || null,
        donate_min: Number(form.donate_min) || 0,
        donate_max: Number(form.donate_max) || 500,
        refund_notice: form.refund_notice || null,
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
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center gap-3 border border-border/60 px-3 py-2 text-sm"
            >
              <span className="text-xs uppercase tracking-wider text-muted-foreground w-16">
                {item.kind === "frame" ? "Rámeček" : "Plugin"}
              </span>
              <span className="font-medium flex-1 min-w-[140px]">{item.title}</span>
              <span className="text-primary font-bold">{item.price_czk} Kč</span>
              {!item.active && <span className="text-xs text-destructive">skryto</span>}
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
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>PayPal.me jméno</Label>
            <Input
              value={form.paypal_me ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, paypal_me: e.target.value }))}
              placeholder="napr. studiovoxario"
            />
          </div>
          <div className="space-y-1.5">
            <Label>PayPal e-mail (záloha)</Label>
            <Input
              value={form.paypal_email ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, paypal_email: e.target.value }))}
              placeholder="platby@studiovoxario.com"
            />
          </div>
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
                onValueChange={(v) => setEditing((e) => ({ ...e, kind: v as "frame" | "plugin" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="frame">Orámování (badge)</SelectItem>
                  <SelectItem value="plugin">Plugin code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{editing?.kind === "plugin" ? "Název pluginu" : "Název rámečku"}</Label>
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
            <div className="space-y-1.5">
              <Label>Popis {editing?.kind === "plugin" ? "(iniciály / k čemu je)" : ""}</Label>
              <Textarea
                rows={3}
                value={editing?.description ?? ""}
                onChange={(e) => setEditing((x) => ({ ...x, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Co plugin umí / obsah balíčku (jeden bod na řádek)</Label>
              <Textarea rows={4} value={featuresText} onChange={(e) => setFeaturesText(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
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
            <Button onClick={saveItem} disabled={saving}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
