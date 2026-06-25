// AI Auto-Helper for NEONHUB community — with tool calling + owner escalation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { geminiChatCompletion } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Jsi NEON — přátelský AI asistent herní komunity NEONHUB.
Odpovídáš stručně, česky, v gaming tónu (ale profesionálně). Markdown OK.

# Co umíš
Máš přístup k nástrojům (tools), pomocí kterých můžeš číst živá data webu:
fórum, herní servery, Discord servery, streamy, novinky/hry, statistiky a profil
přihlášeného uživatele. Když uživatel chce konkrétní info ("kde najdu...",
"co je nového...", "kdo streamuje..."), VŽDY zavolej nejdřív vhodný tool a
odpověz až podle reálných dat.

# Eskalace na majitele
Pokud narazíš na TECHNICKÝ problém, který sám nevyřešíš (chyba webu, něco
nefunguje, podezření na bug, výpadek bota, problém s platbou/účtem který
neumíš opravit), použij tool "contact_owner". Ten automaticky založí
ticket s vysokou prioritou pro majitele/admina. Uživateli pak řekni, že jsi
problém eskaloval a kdy se může čekat odpověď.

NEVOLEJ contact_owner zbytečně — jen pro skutečné technické problémy. Běžné
dotazy "jak na to" vyřeš sám nebo doporuč "/tickets".

# Pravidla
- Nevymýšlej si funkce ani URL.
- Citlivé věci (právo, peníze, zdraví) → odkaž jinam.
- Soukromí → "/privacy". Pravidla → "/terms".
- Drž odpovědi pod 5 vět, pokud uživatel nechce detail.`;

type ChatMsg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

const tools = [
  {
    type: "function",
    function: {
      name: "search_forum_threads",
      description: "Vyhledá vlákna fóra podle textu v názvu/obsahu.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "hledaný text" },
          limit: { type: "number", default: 5 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_recent_threads",
      description: "Vrátí poslední aktivní vlákna fóra.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number", default: 5 } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_discord_servers",
      description: "Schválené Discord servery zobrazené v adresáři.",
      parameters: { type: "object", properties: { limit: { type: "number", default: 10 } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_game_servers",
      description: "Schválené herní servery (Steam/jiné) viditelné na /servery.",
      parameters: {
        type: "object",
        properties: {
          game: { type: "string", description: "filtr podle hry (volitelně)" },
          limit: { type: "number", default: 10 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_streams",
      description: "Aktuálně doporučení streameři (Twitch/YouTube/Kick).",
      parameters: { type: "object", properties: { limit: { type: "number", default: 8 } } },
    },
  },
  {
    type: "function",
    function: {
      name: "list_novinky",
      description: "Nadcházející/nedávno vydané hry z katalogu.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string" },
          limit: { type: "number", default: 8 },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_site_stats",
      description: "Souhrn: počet uživatelů, vláken, příspěvků, ticketů, serverů.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_profile",
      description: "Profil přihlášeného uživatele (display_name, role).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "contact_owner",
      description:
        "ESKALACE: Založí ticket s vysokou prioritou pro majitele/admina. Použij JEN pro skutečné technické problémy, které neumíš sám vyřešit.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "krátký předmět" },
          description: {
            type: "string",
            description:
              "popis problému + kontext z konverzace + co AI zkusila",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
            default: "high",
          },
        },
        required: ["subject", "description"],
      },
    },
  },
];

async function executeTool(
  name: string,
  args: any,
  ctx: {
    userClient: ReturnType<typeof createClient>;
    serviceClient: ReturnType<typeof createClient>;
    userId: string;
  },
): Promise<unknown> {
  const { userClient, serviceClient, userId } = ctx;
  try {
    switch (name) {
      case "search_forum_threads": {
        const q = String(args.query ?? "").slice(0, 100);
        const limit = Math.min(Number(args.limit) || 5, 10);
        const { data } = await userClient
          .from("forum_threads")
          .select("id, title, slug, category_id, reply_count, view_count, created_at")
          .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
          .order("created_at", { ascending: false })
          .limit(limit);
        return data ?? [];
      }
      case "list_recent_threads": {
        const limit = Math.min(Number(args.limit) || 5, 10);
        const { data } = await userClient
          .from("forum_threads")
          .select("id, title, slug, reply_count, view_count, updated_at")
          .order("updated_at", { ascending: false })
          .limit(limit);
        return data ?? [];
      }
      case "list_discord_servers": {
        const limit = Math.min(Number(args.limit) || 10, 20);
        const { data } = await userClient
          .from("discord_servers")
          .select("name, invite_url, member_count, is_featured")
          .eq("is_approved", true)
          .order("is_featured", { ascending: false })
          .order("member_count", { ascending: false })
          .limit(limit);
        return data ?? [];
      }
      case "list_game_servers": {
        const limit = Math.min(Number(args.limit) || 10, 20);
        let q = userClient
          .from("game_servers")
          .select("name, game, address, website, discord_url, description")
          .eq("is_approved", true)
          .limit(limit);
        if (args.game) q = q.ilike("game", `%${String(args.game)}%`);
        const { data } = await q;
        return data ?? [];
      }
      case "list_streams": {
        const limit = Math.min(Number(args.limit) || 8, 20);
        const { data } = await userClient
          .from("featured_streams")
          .select("platform, channel_name, display_name, is_live")
          .order("is_live", { ascending: false })
          .limit(limit);
        return data ?? [];
      }
      case "list_novinky": {
        const limit = Math.min(Number(args.limit) || 8, 20);
        let q = serviceClient
          .from("games")
          .select("name, release_date, platforms, summary")
          .order("release_date", { ascending: false })
          .limit(limit);
        if (args.platform) q = q.contains("platforms", [String(args.platform)]);
        const { data } = await q;
        return data ?? [];
      }
      case "get_site_stats": {
        const [u, t, p, tk, gs] = await Promise.all([
          serviceClient.from("profiles").select("*", { count: "exact", head: true }),
          serviceClient.from("forum_threads").select("*", { count: "exact", head: true }),
          serviceClient.from("forum_posts").select("*", { count: "exact", head: true }),
          serviceClient.from("tickets").select("*", { count: "exact", head: true }),
          serviceClient.from("game_servers").select("*", { count: "exact", head: true }).eq("is_approved", true),
        ]);
        return {
          users: u.count ?? 0,
          threads: t.count ?? 0,
          posts: p.count ?? 0,
          tickets: tk.count ?? 0,
          game_servers: gs.count ?? 0,
        };
      }
      case "get_my_profile": {
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("display_name, username, bio")
          .eq("user_id", userId)
          .maybeSingle();
        const { data: roles } = await serviceClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);
        return { ...profile, roles: (roles ?? []).map((r: any) => r.role) };
      }
      case "contact_owner": {
        const subject = String(args.subject ?? "Eskalace od AI asistenta").slice(0, 200);
        const description = String(args.description ?? "").slice(0, 4000);
        const priority = ["low", "medium", "high", "urgent"].includes(args.priority)
          ? args.priority
          : "high";
        // Find an owner/admin to assign
        const { data: admin } = await serviceClient
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();
        const { data: ticket, error } = await serviceClient
          .from("tickets")
          .insert({
            user_id: userId,
            subject: `[AI eskalace] ${subject}`,
            description: `🤖 Tento ticket byl založen automaticky AI asistentem NEON.\n\n${description}`,
            priority,
            category: "technical",
            assigned_to: admin?.user_id ?? null,
          })
          .select("id")
          .single();
        if (error) return { ok: false, error: error.message };
        return {
          ok: true,
          ticket_id: ticket.id,
          message: "Ticket s vysokou prioritou byl založen a přiřazen majiteli.",
        };
      }
      default:
        return { error: `unknown tool ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "tool error" };
  }
}

async function callAI(messages: ChatMsg[], _apiKey: string) {
  return await geminiChatCompletion({
    model: "gemini-3-flash",
    messages: messages as any,
    tools,
    tool_choice: "auto",
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const rawMessages = body?.messages;
    if (!Array.isArray(rawMessages)) {
      return new Response(JSON.stringify({ error: "messages must be an array" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const safeMessages: ChatMsg[] = rawMessages
      .filter(
        (m: any) =>
          m && typeof m === "object" && (m.role === "user" || m.role === "assistant"),
      )
      .slice(-30)
      .map((m: any) => ({
        role: m.role,
        content: String(m.content ?? "").slice(0, 4000),
      }))
      .filter((m) => (m.content ?? "").length > 0);

    if (safeMessages.length === 0) {
      return new Response(JSON.stringify({ error: "no valid messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const convo: ChatMsg[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...safeMessages,
    ];

    let escalated = false;
    let escalatedTicketId: string | null = null;

    // Tool loop, max 6 rounds
    for (let i = 0; i < 6; i++) {
      const resp = await callAI(convo, GEMINI_KEY);
      if (resp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Příliš mnoho dotazů. Zkus to za chvíli znovu." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (resp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI kredity vyčerpány. Kontaktuj administrátora." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!resp.ok) {
        const t = await resp.text();
        console.error("AI gateway error:", resp.status, t);
        return new Response(JSON.stringify({ error: "AI gateway error" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await resp.json();
      const msg = json.choices?.[0]?.message;
      if (!msg) break;
      convo.push(msg);

      const toolCalls = msg.tool_calls ?? [];
      if (!toolCalls.length) {
        return new Response(
          JSON.stringify({
            content: msg.content ?? "",
            escalated,
            ticket_id: escalatedTicketId,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      for (const call of toolCalls) {
        const fname = call.function?.name;
        let fargs: any = {};
        try {
          fargs = JSON.parse(call.function?.arguments ?? "{}");
        } catch { /* ignore */ }
        const result = await executeTool(fname, fargs, {
          userClient,
          serviceClient,
          userId,
        });
        if (fname === "contact_owner" && (result as any)?.ok) {
          escalated = true;
          escalatedTicketId = (result as any).ticket_id ?? null;
        }
        convo.push({
          role: "tool",
          tool_call_id: call.id,
          name: fname,
          content: JSON.stringify(result).slice(0, 6000),
        });
      }
    }

    return new Response(
      JSON.stringify({
        content:
          "Omlouvám se, něco se zaseklo. Zkus dotaz upřesnit nebo založ ticket na /tickets.",
        escalated,
        ticket_id: escalatedTicketId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai-helper error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
