import { supabase } from "@/integrations/supabase/client";

export async function syncTicketToDiscord(payload: {
  ticket_id: string;
  event: "created" | "reply" | "status" | "deleted";
  reply_content?: string;
  new_status?: string;
}) {
  try {
    await supabase.functions.invoke("ticket-sync-discord", { body: payload });
  } catch (e) {
    // best-effort; never block the UI flow
    console.warn("ticket discord sync failed", e);
  }
}
