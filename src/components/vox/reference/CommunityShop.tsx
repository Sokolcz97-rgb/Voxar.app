import { useMemo, useState } from "react";
import { Check, Code2, HeartHandshake, Loader2, Settings2, ShieldAlert, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CosmeticFrame } from "@/components/CosmeticFrame";
import { PurchaseDialog } from "@/components/shop/PurchaseDialog";
import { ShopAdminPanel } from "@/components/shop/ShopAdminPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useShop, type ShopItem } from "@/hooks/useShop";

type Tab = "frames" | "plugins" | "donate";

type Checkout = {
  title: string;
  amount: number;
  note: string;
  kind: "frame" | "plugin" | "donation";
  itemId: string | null;
  cosmeticId: string | null;
};

export function CommunityShop() {
  const { items, settings, loading, refresh } = useShop();
  const { isAdmin, isEditor } = useAuth();
  const canManage = isAdmin || isEditor;
  const [tab, setTab] = useState<Tab>("frames");
  const [adminMode, setAdminMode] = useState(false);
  const [donation, setDonation] = useState(100);
  const [checkout, setCheckout] = useState<Checkout | null>(null);

  const frames = useMemo(() => items.filter((item) => item.kind === "frame" && (item.active || adminMode)), [items, adminMode]);
  const plugins = useMemo(() => items.filter((item) => item.kind === "plugin" && (item.active || adminMode)), [items, adminMode]);
  const min = settings?.donate_min ?? 0;
  const max = settings?.donate_max ?? 500;

  const buy = (item: ShopItem) => setCheckout({
    title: item.title,
    amount: item.price_czk,
    note: item.title,
    kind: item.kind,
    itemId: item.id,
    cosmeticId: item.cosmetic_id,
  });

  return (
    <div className="sv-feature-page sv-shop-page">
      <div className="sv-feature-toolbar">
        <div>
          <span className="sv-feature-kicker">STUDIOVOXARIO MARKET</span>
          <h2>Obchod</h2>
          <p>Rámečky, pluginy a podpora projektu. Nabídka používá stejná data jako současný obchod.</p>
        </div>
        {canManage && (
          <button type="button" className={`sv-hud-button${adminMode ? " secondary" : ""}`} onClick={() => setAdminMode((v) => !v)}>
            <Settings2 /> {adminMode ? "Zpět do obchodu" : "Upravit nabídku"}
          </button>
        )}
      </div>

      {adminMode ? (
        <div className="sv-shop-admin"><ShopAdminPanel items={items} settings={settings} onRefresh={refresh} /></div>
      ) : (
        <>
          <div className="sv-feature-tabs">
            <button type="button" className={tab === "frames" ? "active" : ""} onClick={() => setTab("frames")}><Sparkles /> Rámečky</button>
            <button type="button" className={tab === "plugins" ? "active" : ""} onClick={() => setTab("plugins")}><Code2 /> Plugin code</button>
            <button type="button" className={tab === "donate" ? "active" : ""} onClick={() => setTab("donate")}><HeartHandshake /> Podpořit projekt</button>
          </div>

          {loading ? (
            <div className="sv-feature-loading"><Loader2 className="spin" /> Načítám nabídku…</div>
          ) : tab === "frames" ? (
            frames.length ? <div className="sv-shop-grid">
              {frames.map((item) => (
                <article className="sv-shop-card" key={item.id}>
                  <div className="sv-shop-frame-stage">
                    <span className="sv-shop-stage-glow" />
                    <CosmeticFrame cosmeticId={item.cosmetic_id} className="sv-shop-cosmetic-frame">
                      <Avatar className="h-24 w-24"><AvatarFallback className="bg-[#071a28] text-cyan-100">VOX</AvatarFallback></Avatar>
                    </CosmeticFrame>
                  </div>
                  <div className="sv-shop-card-copy"><small>PROFILOVÝ RÁMEČEK</small><h3>{item.title}</h3><p>{item.description || "Kosmetické orámování profilu Voxar.app."}</p></div>
                  <footer><strong>{item.price_czk} Kč</strong><button type="button" className="sv-hud-button" onClick={() => buy(item)}>Koupit</button></footer>
                </article>
              ))}
            </div> : <div className="sv-feature-empty"><Sparkles /><strong>Zatím tu nejsou žádné rámečky</strong><span>Přidáš je přes správu nabídky a automaticky se zobrazí tady.</span></div>
          ) : tab === "plugins" ? (
            plugins.length ? <div className="sv-shop-grid plugins">
              {plugins.map((item) => (
                <article className="sv-shop-card plugin" key={item.id}>
                  <div className="sv-plugin-mark"><Code2 /></div>
                  <div className="sv-shop-card-copy"><small>PLUGIN LICENSE</small><h3>{item.title}</h3><p>{item.description || "Digitální licence StudioVoxario."}</p></div>
                  {!!item.features?.length && <ul>{item.features.map((feature, index) => <li key={`${item.id}-${index}`}><Check /> {feature}</li>)}</ul>}
                  <footer><strong>{item.price_czk} Kč</strong><button type="button" className="sv-hud-button" onClick={() => buy(item)}>Koupit licenci</button></footer>
                </article>
              ))}
            </div> : <div className="sv-feature-empty"><Code2 /><strong>Žádné pluginy v nabídce</strong><span>Aktivní položky se načítají ze současného shop systému.</span></div>
          ) : (
            <div className="sv-donation-layout">
              <section className="sv-feature-card sv-donation-card">
                <span className="sv-feature-kicker">SUPPORT STUDIOVOXARIO</span>
                <h3>Pomoz s provozem a dalším vývojem</h3>
                <p>Vyber částku od {min} do {max} Kč. Platba používá současný PayPal / QR systém.</p>
                <div className="sv-donation-amount">{donation} <small>Kč</small></div>
                <input type="range" min={min} max={max} step={10} value={donation} onChange={(event) => setDonation(Number(event.target.value))} />
                <div className="sv-donation-presets">
                  {[50, 100, 250, 500].filter((value) => value >= min && value <= max).map((value) => <button type="button" key={value} onClick={() => setDonation(value)}>{value} Kč</button>)}
                </div>
                <button type="button" className="sv-hud-button wide" disabled={donation <= 0} onClick={() => setCheckout({ title: "Podpora projektu", amount: donation, note: "Dar StudioVoxario", kind: "donation", itemId: null, cosmeticId: null })}>
                  <HeartHandshake /> Přispět {donation} Kč
                </button>
              </section>
              <aside className="sv-refund-card"><ShieldAlert /><div><strong>Digitální obsah</strong><p>{settings?.refund_notice || "Na dary ani na zakoupený digitální obsah neposkytujeme vrácení peněz (refund)."}</p></div></aside>
            </div>
          )}
        </>
      )}

      <PurchaseDialog
        open={!!checkout}
        onOpenChange={(open) => !open && setCheckout(null)}
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
}
