import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { PageHero } from "@/components/PageHero";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CosmeticFrame } from "@/components/CosmeticFrame";
import { PurchaseDialog } from "@/components/shop/PurchaseDialog";
import { ShopAdminPanel } from "@/components/shop/ShopAdminPanel";
import { useShop, type ShopItem } from "@/hooks/useShop";
import { useAuth } from "@/contexts/AuthContext";
import { ShoppingBag, Sparkles, Code2, HeartHandshake, Check, ShieldAlert, Settings2 } from "lucide-react";

const ShopPage = () => {
  const { items, settings, loading, refresh } = useShop();
  const { isAdmin, isEditor } = useAuth();
  const canManage = isAdmin || isEditor;

  const [adminMode, setAdminMode] = useState(false);
  const [donation, setDonation] = useState(100);
  const [checkout, setCheckout] = useState<{
    title: string;
    amount: number;
    note: string;
    kind: "frame" | "plugin" | "donation";
    itemId: string | null;
    cosmeticId: string | null;
  } | null>(null);

  const frames = useMemo(
    () => items.filter((i) => i.kind === "frame" && (i.active || adminMode)),
    [items, adminMode],
  );
  const plugins = useMemo(
    () => items.filter((i) => i.kind === "plugin" && (i.active || adminMode)),
    [items, adminMode],
  );

  const min = settings?.donate_min ?? 0;
  const max = settings?.donate_max ?? 500;
  const refundNotice =
    settings?.refund_notice ||
    "Na dary ani na zakoupené rámečky a digitální obsah neposkytujeme vrácení peněz (refund).";

  const buy = (item: ShopItem) =>
    setCheckout({
      title: item.title,
      amount: item.price_czk,
      note: item.title,
      kind: item.kind,
      itemId: item.id,
      cosmeticId: item.cosmetic_id,
    });

  return (
    <div className="min-h-screen relative">
      <SEO
        title="Obchod — StudioVoxario"
        description="Rámečky avatarů, plugin kódy a možnost podpořit projekt StudioVoxario. Platba přes PayPal nebo QR kódem."
      />
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-8 md:py-10 animate-fade-in">
        <PageHero
          eyebrow="Obchod"
          title="StudioVoxario Shop"
          description="Vyber si orámování profilu, plugin kód nebo projekt podpoř libovolnou částkou."
          icon={ShoppingBag}
          actions={
            canManage ? (
              <Button variant={adminMode ? "default" : "outline"} onClick={() => setAdminMode((v) => !v)}>
                <Settings2 className="h-4 w-4 mr-2" />
                {adminMode ? "Zpět do obchodu" : "Upravit nabídku"}
              </Button>
            ) : undefined
          }
        />

        {canManage && adminMode && (
          <ShopAdminPanel items={items} settings={settings} onRefresh={refresh} />
        )}

        {!adminMode && (
          <Tabs defaultValue="frames" className="space-y-6">
            <TabsList>
              <TabsTrigger value="frames">
                <Sparkles className="h-4 w-4 mr-2" /> Orámování
              </TabsTrigger>
              <TabsTrigger value="plugins">
                <Code2 className="h-4 w-4 mr-2" /> Plugin code
              </TabsTrigger>
              <TabsTrigger value="donate">
                <HeartHandshake className="h-4 w-4 mr-2" /> Podpořit projekt
              </TabsTrigger>
            </TabsList>

            <TabsContent value="frames">
              {loading ? (
                <p className="text-muted-foreground">Načítám…</p>
              ) : frames.length === 0 ? (
                <p className="text-muted-foreground">Zatím tu nejsou žádné rámečky.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {frames.map((item) => (
                    <Card key={item.id} className="glass border-border p-6 flex flex-col items-center text-center">
                      <CosmeticFrame cosmeticId={item.cosmetic_id} className="w-28 mb-4">
                        <Avatar className="h-24 w-24">
                          <AvatarFallback className="bg-muted text-lg">VOX</AvatarFallback>
                        </Avatar>
                      </CosmeticFrame>
                      <h3 className="font-display font-bold text-lg">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      )}
                      <div className="mt-4 text-2xl font-display font-black text-primary">
                        {item.price_czk} Kč
                      </div>
                      <Button className="mt-4 w-full" onClick={() => buy(item)}>
                        Koupit
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="plugins">
              {plugins.length === 0 ? (
                <p className="text-muted-foreground">Zatím tu nejsou žádné pluginy.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-5">
                  {plugins.map((item) => (
                    <Card key={item.id} className="glass border-border p-6 flex flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display font-bold text-lg">{item.title}</h3>
                          {item.description && (
                            <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                          )}
                        </div>
                        <Badge variant="secondary">{item.price_czk} Kč</Badge>
                      </div>
                      {item.features?.length > 0 && (
                        <ul className="mt-4 space-y-1.5 text-sm">
                          {item.features.map((f, i) => (
                            <li key={i} className="flex gap-2">
                              <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button className="mt-6" onClick={() => buy(item)}>
                        Koupit licenci
                      </Button>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="donate">
              <Card className="glass border-border p-6 max-w-2xl space-y-6">
                <div>
                  <h3 className="font-display font-bold text-xl">Podpoř StudioVoxario</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Zvol si libovolnou částku od {min} do {max} Kč. Každá koruna jde na provoz serverů a vývoj.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="text-4xl font-display font-black text-primary text-center">
                    {donation} Kč
                  </div>
                  <Slider
                    value={[donation]}
                    min={min}
                    max={max}
                    step={10}
                    onValueChange={(v) => setDonation(v[0])}
                  />
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={min}
                      max={max}
                      value={donation}
                      onChange={(e) =>
                        setDonation(Math.min(max, Math.max(min, Number(e.target.value) || 0)))
                      }
                      className="w-32"
                    />
                    <div className="flex flex-wrap gap-2">
                      {[50, 100, 250, 500]
                        .filter((v) => v >= min && v <= max)
                        .map((v) => (
                          <Button key={v} size="sm" variant="outline" onClick={() => setDonation(v)}>
                            {v} Kč
                          </Button>
                        ))}
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full"
                  disabled={donation <= 0}
                  onClick={() =>
                    setCheckout({
                      title: "Podpora projektu",
                      amount: donation,
                      note: "Dar StudioVoxario",
                      kind: "donation",
                      itemId: null,
                      cosmeticId: null,
                    })
                  }
                >
                  Přispět {donation} Kč
                </Button>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <Card className="glass border-destructive/30 p-5 mt-8 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="text-foreground font-medium">Bez nároku na vrácení peněz</p>
            <p className="mt-1">{refundNotice}</p>
            <p className="mt-2">
              Podrobnosti najdeš v{" "}
              <Link to="/obchodni-podminky" className="text-primary underline underline-offset-4">
                obchodních podmínkách
              </Link>
              .
            </p>
          </div>
        </Card>
      </main>

      <PurchaseDialog
        open={!!checkout}
        onOpenChange={(v) => !v && setCheckout(null)}
        title={checkout?.title ?? ""}
        amount={checkout?.amount ?? 0}
        note={checkout?.note ?? ""}
        settings={settings}
        kind={checkout?.kind ?? "donation"}
        itemId={checkout?.itemId ?? null}
        cosmeticId={checkout?.cosmeticId ?? null}
      />
    </div>
  );
};

export default ShopPage;
