// Obchod: události ze Stripe (webhook). Zaplacená platební stránka → objednávka se vyřídí sama
// (shop_fulfill_purchase: rámeček, předplatné, zakázka…), vypršelá / nezdařená → zrušena.
//
// Tajné klíče (Lovable Cloud → Secrets):
//   STRIPE_WEBHOOK_SECRET  – whsec_… (Stripe Dashboard → Developers → Webhooks → koncový bod)
//
// Koncový bod ve Stripe: https://<projekt>.supabase.co/functions/v1/stripe-webhook
// Události: checkout.session.completed, checkout.session.async_payment_succeeded,
//           checkout.session.async_payment_failed, checkout.session.expired
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const TOLERANCE_S = 300;

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Ověření podpisu Stripe-Signature (t=…,v1=…) – HMAC-SHA256 z "t.payload". */
async function verify(payload: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || sigs.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_S) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`)));
  return sigs.some((s) => safeEqual(s, expected));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return new Response("Webhook secret missing", { status: 503 });

  const payload = await req.text();
  if (!(await verify(payload, req.headers.get("Stripe-Signature"), secret))) {
    return new Response("Bad signature", { status: 400 });
  }

  let event: { type: string; data: { object: Record<string, any> } };
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const s = event.data?.object ?? {};
  const purchaseId: string | undefined = s.metadata?.purchase_id ?? s.client_reference_id;
  if (!purchaseId) return new Response("ok (bez objednávky)", { status: 200 });

  const { data: p } = await admin.from("shop_purchases")
    .select("id, status, amount_czk, stripe_session_id").eq("id", purchaseId).maybeSingle();
  if (!p) return new Response("ok (objednávka nenalezena)", { status: 200 });
  if (p.stripe_session_id && s.id && p.stripe_session_id !== s.id) {
    // starší platební stránka stejné objednávky (např. obnovení zaplacené na druhý pokus)
    if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
      return new Response("ok (stará relace)", { status: 200 });
    }
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (s.payment_status !== "paid") return new Response("ok (čeká na platbu)", { status: 200 });
      if (p.status === "paid") return new Response("ok (už vyřízeno)", { status: 200 });
      if (String(s.currency).toLowerCase() !== "czk" || Number(s.amount_total) !== p.amount_czk * 100) {
        console.error("stripe-webhook: částka nesedí", purchaseId, s.amount_total, s.currency);
        await admin.from("shop_purchases").update({ note: `POZOR: Stripe částka ${s.amount_total} ${s.currency} nesedí – zkontroluj ručně` }).eq("id", p.id);
        return new Response("ok (částka nesedí – ručně)", { status: 200 });
      }
      await admin.from("shop_purchases").update({
        stripe_session_id: s.id,
        stripe_payment_intent: typeof s.payment_intent === "string" ? s.payment_intent : null,
        status: p.status === "cancelled" ? "pending" : p.status,
      }).eq("id", p.id);
      const { error } = await admin.rpc("shop_fulfill_purchase", { _id: p.id });
      if (error) {
        console.error("stripe-webhook: vyřízení selhalo", purchaseId, error.message);
        return new Response("fulfill failed", { status: 500 }); // Stripe to zkusí znovu
      }
      return new Response("ok", { status: 200 });
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      if (p.status === "pending") {
        const { data: row } = await admin.from("shop_purchases").select("renewal").eq("id", p.id).maybeSingle();
        // obnovení předplatného nerušíme – zákazník ho může zaplatit jinak
        if (row?.renewal) await admin.from("shop_purchases").update({ payment_method: "renewal" }).eq("id", p.id);
        else await admin.from("shop_purchases").update({ status: "cancelled" }).eq("id", p.id);
      }
      return new Response("ok", { status: 200 });
    }
    default:
      return new Response("ok (ignorováno)", { status: 200 });
  }
});
