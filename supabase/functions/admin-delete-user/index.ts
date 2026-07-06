import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing bearer token" }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: me, error: meErr } = await userClient.auth.getUser();
    if (meErr || !me?.user) return json({ error: "Unauthorized" }, 401);

    // Check admin
    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: me.user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      const { data: canManage } = await userClient.rpc("can", {
        _module: "admin",
        _action: "manage_users",
      });
      if (!canManage) return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const targetId = String(body?.user_id ?? "");
    if (!targetId) return json({ error: "user_id required" }, 400);
    if (targetId === me.user.id) return json({ error: "Cannot delete yourself" }, 400);

    const admin = createClient(url, service);
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
