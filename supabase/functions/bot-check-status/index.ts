// Ping configured URLs / servers and send Discord alert when status changes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Check = {
  id: string;
  label: string;
  target_type: string;
  target: string;
  discord_channel_id: string;
  webhook_url: string | null;
  enabled: boolean;
  last_status: string | null;
};

async function ping(target: string): Promise<"up" | "down"> {
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 10_000);
    const res = await fetch(target, { method: "GET", signal: ac.signal, redirect: "follow" });
    clearTimeout(t);
    return res.ok || res.status < 500 ? "up" : "down";
  } catch {
    return "down";
  }
}

async function notify(check: Check, status: "up" | "down", supabase: any) {
  const emoji = status === "up" ? "✅" : "🚨";
  const text = status === "up" ? "je opět dostupný" : "nedostupný!";
  const payload = {
    content: `${emoji} **${check.label}** ${text}`,
    embeds: [{
      title: check.label,
      description: `Status: \`${status.toUpperCase()}\`\nCíl: ${check.target}`,
      color: status === "up" ? 0x22c55e : 0xef4444,
      timestamp: new Date().toISOString(),
    }],
  };
  if (check.webhook_url) {
    const r = await fetch(check.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) console.error("webhook fail", r.status, await r.text());
  } else {
    await supabase.from("bot_outbound_queue").insert({
      channel_id: check.discord_channel_id,
      payload,
      source: "bot-check-status",
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: checks, error } = await supabase
      .from("bot_status_checks")
      .select("*")
      .eq("enabled", true);
    if (error) throw error;

    const now = new Date().toISOString();
    const results: any[] = [];
    for (const c of (checks ?? []) as Check[]) {
      const status = await ping(c.target);
      const changed = c.last_status && c.last_status !== status;
      const update: any = { last_checked_at: now, last_status: status };
      if (changed) update.last_changed_at = now;
      await supabase.from("bot_status_checks").update(update).eq("id", c.id);
      if (changed) await notify(c, status, supabase);
      results.push({ id: c.id, status, changed });
    }
    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
