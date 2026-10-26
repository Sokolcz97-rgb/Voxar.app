// Obchod: platba kartou přes Stripe Checkout.
//
// Přihlášený zákazník pošle, co kupuje. Cenu NIKDY nebereme od klienta (kromě daru v povoleném
// rozmezí) – počítá se z shop_items. Funkce založí objednávku (shop_purchases, pending, metoda
// "stripe") a platební stránku Stripe; po zaplacení ji vyřídí stripe-webhook.
//
// Tajné klíče (nastavuje správce v Lovable Cloud → Secrets, nikdy ne do kódu):
//   STRIPE_SECRET_KEY      – sk_live_… / sk_test_…
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// kam se zákazník po platbě vrátí (jen naše domény)
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?studiovoxario\.com$/, /^https:\/\/(www\.)?voxar\.app$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^http:\/\/localhost:\d+$/];
const STRIPE_MIN_CZK = 15; // nejmenší platba kartou, kterou Stripe v CZK přijme

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return json({ error: "Platba kartou zatím není nastavená." }, 503);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Přihlas se." }, 401);
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: auth } = await userClient.auth.getUser();
  const user = auth.user;
  if (!user) return json({ error: "Přihlas se." }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Neplatný požadavek." }, 400);
  }

  const { data: settings } = await admin.from("shop_settings").select("stripe_enabled, donate_min, donate_max").limit(1).maybeSingle();
  if (!settings?.stripe_enabled) return json({ error: "Platba kartou je vypnutá." }, 503);

  const terms = typeof body.terms_version === "string" ? body.terms_version.slice(0, 20) : null;
  if (!terms || body.terms_accepted !== true) return json({ error: "Nejdřív potvrď souhlas s podmínkami." }, 400);
  const now = new Date().toISOString();

  let purchaseId: string;
  let title: string;
  let amount: number;

  if (typeof body.renewal_id === "string") {
    // platba za obnovení předplatného – objednávka už existuje
    const { data: p } = await admin.from("shop_purchases")
      .select("id, user_id, title, amount_czk, renewal, status").eq("id", body.renewal_id).maybeSingle();
    if (!p || p.user_id !== user.id || !p.renewal || p.status !== "pending") return json({ error: "Platba za obnovení nenalezena." }, 404);
    await admin.from("shop_purchases").update({
      payment_method: "stripe", terms_version: terms, terms_accepted_at: now, waiver_accepted_at: now,
    }).eq("id", p.id);
    purchaseId = p.id;
    title = p.title;
    amount = p.amount_czk;
  } else {
    const kind = String(body.kind ?? "");
    let itemId: string | null = null;
    let cosmeticId: string | null = null;
    let period: string | null = null;
    let autoRenew = false;
    let note = typeof body.note === "string" ? body.note.slice(0, 200) : null;

    if (kind === "donation") {
      amount = Math.round(Number(body.amount));
      const min = Math.max(STRIPE_MIN_CZK, settings.donate_min ?? 0);
      const max = settings.donate_max ?? 500;
      if (!Number.isFinite(amount) || amount < min || amount > max) {
        return json({ error: `Kartou lze přispět ${min}–${max} Kč.` }, 400);
      }
      title = "Podpora projektu";
      note = note || "Dar StudioVoxario";
    } else if (["frame", "plugin", "software"].includes(kind)) {
      const { data: item } = await admin.from("shop_items")
        .select("id, kind, title, price_czk, price_year_czk, cosmetic_id, active").eq("id", String(body.item_id ?? "")).maybeSingle();
      if (!item || !item.active || item.kind !== kind) return json({ error: "Položka není v nabídce." }, 404);
      itemId = item.id;
      cosmeticId = item.cosmetic_id;
      title = item.title;
      if (kind === "software") {
        period = body.period === "year" && item.price_year_czk ? "year" : "month";
        amount = period === "year" ? item.price_year_czk! : item.price_czk;
        autoRenew = body.auto_renew === true;
        title = `${item.title} – ${period === "year" ? "roční" : "měsíční"} předplatné`;
      } else {
        amount = item.price_czk;
      }
      if (amount < STRIPE_MIN_CZK) return json({ error: `Kartou lze platit od ${STRIPE_MIN_CZK} Kč – použij převod.` }, 400);
    } else {
      return json({ error: "Neznámý druh nákupu." }, 400);
    }

    const { data: created, error } = await admin.from("shop_purchases").insert({
      user_id: user.id,
      item_id: itemId,
      kind,
      title,
      amount_czk: amount,
      cosmetic_id: cosmeticId,
      requires_manual: kind === "plugin",
      payment_method: "stripe",
      note,
      period,
      auto_renew: autoRenew,
      terms_version: terms,
      terms_accepted_at: now,
      waiver_accepted_at: kind === "donation" ? null : now,
    }).select("id").single();
    if (error || !created) return json({ error: "Objednávku se nepodařilo založit." }, 500);
    purchaseId = created.id;
  }

  const origin = req.headers.get("Origin") ?? "";
  const base = ALLOWED_ORIGINS.some((r) => r.test(origin)) ? origin : "https://studiovoxario.com";

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("locale", "cs");
  form.set("client_reference_id", purchaseId);
  form.set("success_url", `${base}/obchod?platba=ok`);
  form.set("cancel_url", `${base}/obchod?platba=zrusena`);
  if (user.email) form.set("customer_email", user.email);
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "czk");
  form.set("line_items[0][price_data][unit_amount]", String(amount * 100));
  form.set("line_items[0][price_data][product_data][name]", title.slice(0, 250));
  form.set("metadata[purchase_id]", purchaseId);
  form.set("payment_intent_data[metadata][purchase_id]", purchaseId);
  form.set("payment_intent_data[description]", title.slice(0, 250));
  // nezaplacená platební stránka vyprší za 1 hodinu (webhook objednávku zruší)
  form.set("expires_at", String(Math.floor(Date.now() / 1000) + 60 * 60));

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": `checkout-${purchaseId}-${Date.now()}`,
    },
    body: form,
  });
  const session = await res.json();
  if (!res.ok || !session?.url) {
    console.error("stripe checkout", res.status, session?.error?.message);
    if (typeof body.renewal_id !== "string") {
      await admin.from("shop_purchases").update({ status: "cancelled" }).eq("id", purchaseId);
    }
    return json({ error: "Platební bránu se nepodařilo otevřít. Zkus to prosím znovu nebo zaplať převodem." }, 502);
  }
  await admin.from("shop_purchases").update({ stripe_session_id: session.id }).eq("id", purchaseId);
  return json({ url: session.url, purchase_id: purchaseId });
});
