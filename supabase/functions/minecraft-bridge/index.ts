// Minecraft <-> Discord bridge
// Two modes:
//  A) Plugin -> bridge:  header  x-mc-token: <guild plugin_token>
//     body: { action: "chat"|"join"|"leave"|"death"|"achievement"|"server_status"|"verify_link",
//             name, uuid, message?, achievement?, status?, code? }
//  B) User  -> bridge:   Authorization: Bearer <user JWT>
//     body: { action: "create_link_code", guild_id }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-mc-token, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function format(tpl: string, vars: Record<string, string | undefined>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "").toString());
}

function randomCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) s += alphabet[buf[i] % alphabet.length];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const action = String(body?.action ?? "");

  // -------- Mode B: user creates a link code --------
  if (action === "create_link_code") {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await anon.auth.getUser();
    const user = userRes?.user;
    if (!user) return json({ error: "unauthorized" }, 401);
    const guild_id = String(body?.guild_id ?? "");
    if (!guild_id) return json({ error: "missing_guild_id" }, 400);

    // Reuse existing helper for discord id
    const { data: discordId } = await admin.rpc("discord_id_for_user", { _user_id: user.id });

    // Cleanup expired
    await admin.from("bot_minecraft_pending_links")
      .delete().lt("expires_at", new Date().toISOString());

    const code = randomCode(6);
    const { error } = await admin.from("bot_minecraft_pending_links").insert({
      guild_id, user_id: user.id, discord_user_id: discordId ?? null, code,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ code, expires_in_seconds: 15 * 60 });
  }

  // -------- Mode A: plugin token --------
  const token = req.headers.get("x-mc-token") ?? "";
  if (!token) return json({ error: "missing_token" }, 401);

  const { data: cfg, error: cfgErr } = await admin
    .from("bot_minecraft_config")
    .select("*")
    .eq("plugin_token", token)
    .maybeSingle();
  if (cfgErr) return json({ error: cfgErr.message }, 500);
  if (!cfg) return json({ error: "invalid_token" }, 401);
  if (!cfg.enabled) return json({ error: "disabled" }, 403);

  const guild_id = cfg.guild_id as string;
  const name = String(body?.name ?? "").slice(0, 64);
  const uuid = String(body?.uuid ?? "").slice(0, 64);
  const message = String(body?.message ?? "").slice(0, 1800);

  // Link verification (plugin -> bridge on /discord link CODE in game)
  if (action === "verify_link") {
    const code = String(body?.code ?? "").toUpperCase();
    if (!code || !uuid || !name) return json({ error: "missing_fields" }, 400);
    const { data: pending } = await admin
      .from("bot_minecraft_pending_links")
      .select("*")
      .eq("guild_id", guild_id)
      .eq("code", code)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (!pending) return json({ error: "invalid_or_expired_code" }, 400);

    const { error: linkErr } = await admin.from("bot_minecraft_links").upsert({
      guild_id,
      user_id: pending.user_id,
      discord_user_id: pending.discord_user_id,
      minecraft_uuid: uuid,
      minecraft_name: name,
    }, { onConflict: "guild_id,minecraft_uuid" });
    if (linkErr) return json({ error: linkErr.message }, 500);
    await admin.from("bot_minecraft_pending_links").delete().eq("id", pending.id);

    // Assign role via bot queue (if configured)
    if (cfg.link_role_id && pending.discord_user_id) {
      await admin.from("bot_outbound_queue").insert({
        source: "minecraft",
        payload: {
          action: "assign_role",
          guild_id,
          user_id: pending.discord_user_id,
          role_id: cfg.link_role_id,
        },
      });
    }
    return json({ ok: true, linked_to: pending.discord_user_id ?? null });
  }

  // Event relays -> enqueue a Discord message
  const relay = async (channel: string | null, content: string) => {
    if (!channel || !content) return;
    await admin.from("bot_outbound_queue").insert({
      source: "minecraft",
      payload: { action: "send_message", guild_id, channel_id: channel, content },
    });
  };

  const vars = { name, uuid, message, achievement: String(body?.achievement ?? "") };

  switch (action) {
    case "chat":
      if (!cfg.allow_chat_relay) return json({ ok: true, skipped: "chat_relay_disabled" });
      await relay(cfg.chat_channel, format(cfg.chat_format, vars));
      return json({ ok: true });
    case "join":
      await relay(cfg.join_leave_channel, format(cfg.join_format, vars));
      return json({ ok: true });
    case "leave":
      await relay(cfg.join_leave_channel, format(cfg.leave_format, vars));
      return json({ ok: true });
    case "death":
      await relay(cfg.death_channel, format(cfg.death_format, vars));
      return json({ ok: true });
    case "achievement":
      await relay(cfg.achievement_channel, format(cfg.achievement_format, vars));
      return json({ ok: true });
    case "server_status": {
      const status = String(body?.status ?? "");
      await relay(cfg.server_status_channel, status === "start"
        ? `✅ Minecraft server je online (${cfg.server_address ?? ""}).`
        : `⛔ Minecraft server je offline.`);
      return json({ ok: true });
    }
    case "pull_discord_to_mc": {
      // Plugin can poll for messages queued Discord->MC (not implemented yet).
      return json({ ok: true, messages: [] });
    }
    default:
      return json({ error: "unknown_action" }, 400);
  }
});
