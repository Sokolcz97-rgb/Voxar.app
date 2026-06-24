// Moderate an image URL using Lovable AI (Gemini vision).
// Returns { scam, nsfw, severe, reason, categories[] }
import { createClient } from "npm:@supabase/supabase-js@2";
import { geminiChatCompletion } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function authorize(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice(7);
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) return false;
    return true;
  } catch {
    return false;
  }
}

const IMG_EXT = /\.(png|jpe?g|webp|gif|bmp)(\?.*)?$/i;

function isLikelyImage(url: string, contentType?: string | null): boolean {
  if (contentType && contentType.startsWith("image/")) return true;
  return IMG_EXT.test(url);
}

async function classifyImage(url: string): Promise<{
  scam: boolean;
  nsfw: boolean;
  severe: boolean;
  reason: string;
  categories: string[];
}> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { scam: false, nsfw: false, severe: false, reason: "no key", categories: [] };

  const sys =
    "Jsi PŘÍSNÝ a OPATRNÝ obrázkový moderátor pro Discord server. Odpověz POUZE JSON: " +
    '{"scam":bool,"nsfw":bool,"severe":bool,"confidence":number,"reason":string,"categories":string[]}. ' +
    "confidence = 0.0–1.0 (jak moc jsi si jistý). " +
    "\n\n" +
    "DEFAULT: scam=false, nsfw=false, severe=false. Když si NEJSI 100% jistý, vrať false.\n\n" +
    "scam=true POUZE pokud obrázek je ZJEVNĚ phishingový/podvodný landing page: " +
    "fake Discord/Steam/Nitro/Epic login formulář, falešná stránka pro 'claim' nitro/gift/skinu, " +
    "QR kód s textem nabádajícím k naskenování pro odměnu/nitro/gift, " +
    "falešné airdrop / crypto giveaway stránky, fake 'tvůj účet byl napaden' phishing. " +
    "Musí obsahovat JASNĚ podvodný UI prvek (tlačítko Claim, login pole na podvodné doméně, fake Discord stránka).\n\n" +
    "scam=false (NIKDY neflaguj jako scam) pokud jde o:\n" +
    "- screenshot chatu / Discord zpráv / SMS / WhatsApp konverzace (i kdyby zmiňovaly nitro/gift/scam – je to JEN screenshot rozhovoru),\n" +
    "- memy, vtipy, reaction obrázky, šablony memů,\n" +
    "- screenshoty her, gameplay, herní inventáře, CS2/CSGO skiny v inventáři,\n" +
    "- screenshoty profilů, statistik, leaderboardů,\n" +
    "- normální fotky lidí, věcí, krajiny, jídla, zvířat,\n" +
    "- screenshoty webů / článků / YouTube / Twitch / sociálních sítí,\n" +
    "- obrázky kde je jen text bez podvodného UI,\n" +
    "- screenshot Discord notifikace / pinglu / ping zprávy,\n" +
    "- fan-art, kresby, anime obrázky (pokud nejsou explicitně NSFW).\n\n" +
    "nsfw=true POUZE pokud explicitní pornografie, plná nahota, reálné gore (krev/zranění), " +
    "scény týrání, hard drogy v akci. Sexy oblečení, bikini, plavky, lehký fanservice = false.\n\n" +
    "severe=true POUZE pokud (scam=true a confidence>=0.85) NEBO (nsfw=true a confidence>=0.85). " +
    "Když confidence < 0.85, severe MUSÍ být false.\n" +
    "reason krátce česky. categories krátké tagy.";

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: [
            { type: "text", text: "Vyhodnoť tento obrázek." },
            { type: "image_url", image_url: { url } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { scam: false, nsfw: false, severe: false, reason: `ai ${r.status}: ${t.slice(0, 200)}`, categories: [] };
  }
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content ?? "{}";
  try {
    const p = JSON.parse(content);
    const conf = typeof p.confidence === "number" ? p.confidence : 0;
    const scam = !!p.scam && conf >= 0.85;
    const nsfw = !!p.nsfw && conf >= 0.85;
    // severe must be a high-confidence positive — never trust model's severe flag alone
    const severe = scam || nsfw;
    return {
      scam,
      nsfw,
      severe,
      reason: String(p.reason ?? ""),
      categories: Array.isArray(p.categories) ? p.categories.map(String) : [],
    };
  } catch {
    return { scam: false, nsfw: false, severe: false, reason: "parse error", categories: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!(await authorize(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body?.urls)
      ? body.urls
      : body?.url
        ? [body.url]
        : [];
    if (!urls.length) {
      return new Response(JSON.stringify({ error: "url(s) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const u of urls.slice(0, 5)) {
      if (typeof u !== "string" || !u) continue;
      if (!isLikelyImage(u)) {
        results.push({ url: u, skipped: true, reason: "not image" });
        continue;
      }
      try {
        const r = await classifyImage(u);
        results.push({ url: u, ...r });
      } catch (e) {
        results.push({ url: u, scam: false, nsfw: false, severe: false, reason: `err ${String(e).slice(0,200)}`, categories: [] });
      }
    }

    const severe = results.some((x: any) => x.severe);
    const scam = results.some((x: any) => x.scam);
    const nsfw = results.some((x: any) => x.nsfw);
    const reason = results.find((x: any) => x.severe)?.reason || "";

    return new Response(JSON.stringify({ severe, scam, nsfw, reason, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
