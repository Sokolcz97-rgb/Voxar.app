import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { PageHero } from "@/components/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ExternalLink, Loader2, Package, Search } from "lucide-react";

type Model = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  source_url: string;
  category: string | null;
  license: string;
};

const schema = z.object({
  title: z.string().trim().min(2, "Zadejte co chcete za výrobek").max(120),
  product_size: z.enum(["S", "M", "L"]),
  description: z.string().trim().min(5, "Popište prosím výrobek").max(2000),
  product_url: z.string().trim().url("Zadejte platný odkaz").max(500).optional().or(z.literal("")),
  customer_email: z.string().trim().email("Neplatný e-mail").max(255),
  phone: z.string().trim().min(6, "Zadejte platné číslo").max(30),
  notify_preference: z.enum(["email", "phone"]),
});

export default function CreateOrder() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [models, setModels] = useState<Model[]>([]);
  const [modelQuery, setModelQuery] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    product_size: "M" as "S" | "M" | "L",
    description: "",
    product_url: "",
    customer_email: "",
    phone: "",
    notify_preference: "email" as "email" | "phone",
  });

  useEffect(() => {
    if (user?.email) setForm((f) => ({ ...f, customer_email: user.email ?? "" }));
  }, [user]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("order_models")
        .select("id,name,description,image_url,source_url,category,license")
        .eq("is_active", true)
        .order("name");
      setModels((data ?? []) as Model[]);
    })();
  }, []);

  const selectedModel = models.find((m) => m.id === selectedModelId) || null;
  const filteredModels = models.filter((m) => {
    if (!modelQuery) return true;
    const q = modelQuery.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.category ?? "").toLowerCase().includes(q) ||
      (m.description ?? "").toLowerCase().includes(q)
    );
  });

  const pickModel = (m: Model) => {
    setSelectedModelId(m.id);
    setForm((f) => ({
      ...f,
      title: f.title || m.name,
      product_url: m.source_url,
      description: f.description || (m.description ?? ""),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("orders").insert({
      title: parsed.data.title,
      description: parsed.data.description,
      customer_email: parsed.data.customer_email,
      phone: parsed.data.phone,
      product_size: parsed.data.product_size,
      product_url: parsed.data.product_url || null,
      notify_preference: parsed.data.notify_preference,
      model_id: selectedModelId,
      is_public_request: true,
      status: "processing",
      created_by: user.id,
      currency: "CZK",
    });
    setSaving(false);
    if (error) return toast.error("Chyba: " + error.message);
    toast.success("Zakázka odeslána. Ozveme se!");
    navigate("/profile/zakazky");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: "/objednat" }} />;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <SEO title="Vytvořit zakázku – 3D tisk" description="Objednejte si 3D tištěný výrobek z Public Domain katalogu." />
      <Navbar />
      <main className="container py-10 max-w-4xl animate-fade-in">
        <PageHero
          eyebrow="Zakázka"
          title="Vytvořit zakázku"
          description="Vyplňte co chcete vyrobit. Můžete si vybrat z katalogu Public Domain modelů, nebo vložit vlastní odkaz."
          icon={Package}
        />

        <form onSubmit={submit} className="grid lg:grid-cols-[1fr_1.2fr] gap-6">
          {/* Left: catalog picker */}
          <Card className="glass border-border">
            <CardHeader>
              <CardTitle className="text-lg">Katalog Public Domain modelů</CardTitle>
              <p className="text-xs text-muted-foreground">
                Ze zákona lze tisknout pouze modely s licencí <strong>Public Domain</strong>.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hledat model (např. karambit)…"
                  className="pl-9"
                  value={modelQuery}
                  onChange={(e) => setModelQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredModels.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    Žádné modely v katalogu. Použijte vlastní odkaz vpravo.
                  </p>
                )}
                {filteredModels.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => pickModel(m)}
                    className={`w-full text-left flex gap-3 p-2 rounded-lg border transition-colors ${
                      selectedModelId === m.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/60"
                    }`}
                  >
                    {m.image_url ? (
                      <img src={m.image_url} alt={m.name} className="w-16 h-16 object-cover rounded-md flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{m.name}</div>
                      {m.category && <div className="text-xs text-muted-foreground">{m.category}</div>}
                      <div className="text-[10px] uppercase tracking-wider text-primary mt-1">{m.license}</div>
                    </div>
                  </button>
                ))}
              </div>
              {selectedModel && (
                <a
                  href={selectedModel.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="w-4 h-4" /> Otevřít vybraný model na původní stránce
                </a>
              )}
            </CardContent>
          </Card>

          {/* Right: form */}
          <Card className="glass border-border">
            <CardHeader>
              <CardTitle className="text-lg">Detail zakázky</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Co chcete za výrobek? *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="např. Nůž karambit"
                  maxLength={120}
                />
              </div>

              <div className="space-y-2">
                <Label>Velikost *</Label>
                <RadioGroup
                  value={form.product_size}
                  onValueChange={(v) => setForm({ ...form, product_size: v as "S" | "M" | "L" })}
                  className="flex gap-2"
                >
                  {(["S", "M", "L"] as const).map((s) => (
                    <label
                      key={s}
                      className={`flex-1 border rounded-lg py-3 text-center cursor-pointer transition-colors ${
                        form.product_size === s ? "border-primary bg-primary/10" : "border-border"
                      }`}
                    >
                      <RadioGroupItem value={s} className="sr-only" />
                      <div className="font-bold">{s}</div>
                      <div className="text-xs text-muted-foreground">
                        {s === "S" ? "malý" : s === "M" ? "střední" : "velký"}
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Popis *</Label>
                <Textarea
                  id="desc"
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Popište co přesně chcete – barva, materiál, detaily…"
                  maxLength={2000}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">Odkaz na model (MakerWorld / Creality / jiné)</Label>
                <Input
                  id="url"
                  type="url"
                  value={form.product_url}
                  onChange={(e) => setForm({ ...form, product_url: e.target.value })}
                  placeholder="https://…"
                />
                <p className="text-xs text-muted-foreground">
                  Vyplňte pokud jste model nevybrali z katalogu. Musí být <strong>Public Domain</strong>.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.customer_email}
                    onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+420 …"
                    maxLength={30}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Jak vás mám kontaktovat? *</Label>
                <RadioGroup
                  value={form.notify_preference}
                  onValueChange={(v) => setForm({ ...form, notify_preference: v as "email" | "phone" })}
                  className="flex gap-2"
                >
                  {(["email", "phone"] as const).map((p) => (
                    <label
                      key={p}
                      className={`flex-1 border rounded-lg py-3 text-center cursor-pointer transition-colors ${
                        form.notify_preference === p ? "border-primary bg-primary/10" : "border-border"
                      }`}
                    >
                      <RadioGroupItem value={p} className="sr-only" />
                      {p === "email" ? "E-mailem" : "Telefonicky"}
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Odeslat zakázku
              </Button>
            </CardContent>
          </Card>
        </form>
      </main>
    </div>
  );
}
