import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Czech + English profanity / slurs (basic list — AI handles edge cases)
const BLOCKED = [
  "kurva", "piča", "pica", "mrdka", "mrdat", "kokot", "čurák", "curak", "hovno",
  "zkurvenej", "zkurveny", "buzerant", "buzna", "cikan", "cikán", "negr",
  "fuck", "shit", "bitch", "cunt", "asshole", "nigger", "nigga", "faggot", "retard",
  "porn", "porno", "xxx", "sex chat", "nahá", "naha", "nude",
];

function maskBasic(text: string): { clean: string; flagged: boolean } {
  let flagged = false;
  let clean = text;
  for (const word of BLOCKED) {
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (re.test(clean)) {
      flagged = true;
      clean = clean.replace(re, (m) => m[0] + "*".repeat(Math.max(1, m.length - 1)));
    }
  }
  return { clean, flagged };
}

async function authorize(req: Request): Promise<{ ok: boolean; status?: number }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, status: 401 };
  const token = authHeader.slice(7);
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) return { ok: false, status: 401 };
    return { ok: true };
  } catch {
    return { ok: false, status: 401 };
  }
}

async function aiModerate(text: string): Promise<{ severe: boolean; reason: string }> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return { severe: false, reason: "" };
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You are a content moderator. Reply ONLY with JSON: {\"severe\":boolean,\"reason\":string}. " +
              "Mark severe=true ONLY for: explicit sexual content, threats of violence, hate speech against protected groups, " +
              "or sharing personal data (phone numbers, addresses). Mild profanity = NOT severe. Reply in Czech.",
          },
          { role: "user", content: text.slice(0, 2000) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) return { severe: false, reason: "" };
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    return { severe: !!parsed.severe, reason: String(parsed.reason ?? "") };
  } catch {
    return { severe: false, reason: "" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await authorize(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: auth.status ?? 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { content, useAI } = await req.json();
    if (typeof content !== "string" || !content.trim()) {
      return new Response(JSON.stringify({ error: "Content required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { clean, flagged } = maskBasic(content);

    let severe = false;
    let reason = "";
    if (useAI !== false) {
      const ai = await aiModerate(content);
      severe = ai.severe;
      reason = ai.reason;
    }

    return new Response(
      JSON.stringify({ clean, flagged, severe, reason, blocked: severe }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
