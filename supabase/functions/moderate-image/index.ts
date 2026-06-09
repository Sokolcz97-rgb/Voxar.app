// Moderate an image URL using Lovable AI (Gemini vision).
// Returns { scam, nsfw, severe, reason, categories[] }
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    "Jsi obrázkový moderátor pro Discord server. Odpověz POUZE JSON: " +
    '{"scam":bool,"nsfw":bool,"severe":bool,"reason":string,"categories":string[]}. ' +
    "scam=true pokud obrázek obsahuje phishing/fake Discord/Steam/Nitro/airdrop/CSGO skin scam, " +
    "fake login, QR kódy s podezřelými odkazy, falešné odměny, podvodné nabídky, kradené účty. " +
    "nsfw=true pokud je explicitně sexuální, nahota, gore, extrémní násilí, drogy, gore/shock content. " +
    "severe=true pokud scam NEBO nsfw. categories obsahuje krátké tagy. reason krátce česky.";

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
    return {
      scam: !!p.scam,
      nsfw: !!p.nsfw,
      severe: !!p.severe || !!p.scam || !!p.nsfw,
      reason: String(p.reason ?? ""),
      categories: Array.isArray(p.categories) ? p.categories.map(String) : [],
    };
  } catch {
    return { scam: false, nsfw: false, severe: false, reason: "parse error", categories: [] };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
