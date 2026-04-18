// AI Auto-Helper for NEONHUB community
// Uses Lovable AI Gateway (LOVABLE_API_KEY auto-provisioned)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Jsi NEON — přátelský AI asistent herní komunity NEONHUB.
Odpovídáš stručně, česky, v gaming tónu (ale profesionálně). Můžeš používat markdown
(tučné, seznamy, odkazy). Pokud uživatel nechce detail, drž odpovědi pod 4 věty.

# Co je NEONHUB
NEONHUB je česká herní komunitní platforma s neonovým "cyber" designem. Funguje
jako jednostránková React aplikace nad Lovable Cloud (Supabase) backendem.

# Hlavní sekce a URL
- "/" — Úvodní stránka (hero, featured Discord, top hráči, doporučená vlákna, live streamy).
- "/forum" — Fórum: kategorie → vlákna → příspěvky. Reakce emoji, pinned/locked vlákna, plnotextové vyhledávání.
- "/forum/:slug" — Detail kategorie. "/forum/:slug/:threadSlug" — detail vlákna.
- "/novinky" — Nadcházející a nedávno vydané hry (data z IGDB). Filtr podle platformy
  a řazení od nejnovějších po nejstarší.
- "/leaderboard" — Žebříček hráčů podle aktivity (příspěvky, vlákna, reakce).
- "/servery" — Veřejný seznam herních serverů schválených adminem. Live ping pro
  Steam servery, Discord/website odkazy, filtr podle hry.
- "/messages" — Soukromé zprávy 1:1 (realtime přes Supabase channels).
- "/tickets" — Helpdesk. Uživatel může založit ticket (kategorie, priorita).
  Staff vidí všechny tickety s autorem a může odpovídat (i interní poznámky).
- "/dashboard" — Osobní přehled po přihlášení.
- "/profile" — Vlastní profil: avatar, bio, jména na Twitch/YouTube/Kick, nastavení
  notifikací, mazání účtu. "/profile/:userId" — veřejný profil.
- "/auth" — Přihlášení / registrace e-mailem (s ověřením) i přes Google.
- "/terms" — Podmínky používání. "/privacy" — Zásady ochrany soukromí.

# Administrace (jen pro role admin / editor)
- "/admin" — rozcestník.
- "/admin/users" — Uživatelé, role & oprávnění (sjednocená stránka se záložkami).
- "/admin/moderation" — log automaticky filtrovaného / zablokovaného textu.
- "/admin/pages" — Page Builder: drag&drop bloky, draft → publish.
- "/admin/games" — katalog her pro server list.
- "/admin/streams" — featured streameři (Twitch, YouTube, Kick).
- "/admin/novinky" — ruční sync IGDB s volbou platforem (Steam vyžaduje sync zvlášť).
- "/admin/discord" — Discord servery + výběr "featured" pozvánky na úvodce.
- "/admin/settings" — texty hero sekce, navbar, logo, favicon, footer.
- "/admin/stats" — statistiky komunity, obsahu a provozu.
- "/admin/forum-categories" — správa kategorií fóra.

# Pravidla odpovídání
- Když nevíš, řekni to upřímně a navrhni založit ticket nebo napsat adminovi.
- Nikdy si nevymýšlej funkce ani URL, které tu nejsou.
- Pro citlivé věci (právo, peníze, zdraví) doporuč jiný zdroj.
- Pokud se uživatel ptá na soukromí dat, odkaž ho na "/privacy"; na pravidla na "/terms".`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- AUTH: require valid JWT to prevent credit abuse ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- INPUT VALIDATION: sanitize messages ----
    const body = await req.json().catch(() => ({}));
    const rawMessages = body?.messages;
    if (!Array.isArray(rawMessages)) {
      return new Response(
        JSON.stringify({ error: "messages must be an array" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    const safeMessages = rawMessages
      .filter(
        (m: unknown): m is { role: string; content: unknown } =>
          !!m &&
          typeof m === "object" &&
          (("role" in m && (m as { role: unknown }).role === "user") ||
            ("role" in m && (m as { role: unknown }).role === "assistant"))
      )
      .slice(-50)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: String((m as { content: unknown }).content ?? "").slice(0, 4000),
      }))
      .filter((m) => m.content.length > 0);

    if (safeMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: "no valid messages" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...safeMessages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Příliš mnoho dotazů. Zkus to za chvíli znovu.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI kredity vyčerpány. Kontaktuj administrátora.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-helper error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
