import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const ip = clientIp(req);
    const { action, code } = await req.json().catch(() => ({ action: "check" }));

    // Kdo volá (volitelné) – jen pro evidenci.
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      userId = data.user?.id ?? null;
    }

    if (!ip) return json({ allowed: false, reason: "no_ip" });

    if (action === "check") {
      const { data } = await supabase
        .from("app_access_ips")
        .select("id")
        .eq("ip", ip)
        .maybeSingle();
      if (data) {
        await supabase
          .from("app_access_ips")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", data.id);
        return json({ allowed: true });
      }
      return json({ allowed: false });
    }

    if (action === "redeem") {
      const trimmed = String(code ?? "").trim();
      if (!trimmed) return json({ allowed: false, reason: "empty" });

      const { data: row } = await supabase
        .from("download_access_codes")
        .select("*")
        .ilike("code", trimmed)
        .maybeSingle();

      if (
        !row ||
        !row.active ||
        (row.expires_at && new Date(row.expires_at) < new Date()) ||
        (row.max_uses !== null && (row.uses ?? 0) >= row.max_uses)
      ) {
        return json({ allowed: false, reason: "invalid" });
      }

      await supabase
        .from("download_access_codes")
        .update({ uses: (row.uses ?? 0) + 1 })
        .eq("id", row.id);

      await supabase
        .from("app_access_ips")
        .upsert(
          { ip, user_id: userId, code_id: row.id, last_seen_at: new Date().toISOString() },
          { onConflict: "ip" },
        );

      return json({ allowed: true });
    }

    return json({ allowed: false, reason: "unknown_action" }, 400);
  } catch (e) {
    console.error("app-access error", e);
    return json({ allowed: false, reason: "error" }, 500);
  }
});
