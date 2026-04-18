import { supabase } from "@/integrations/supabase/client";

export interface ModerationResult {
  clean: string;
  flagged: boolean;
  severe: boolean;
  reason: string;
  blocked: boolean;
}

export type ModerationSource = "dm" | "forum_thread" | "forum_post" | "ticket" | "ticket_reply";

export async function moderate(
  content: string,
  useAI = true,
  source?: ModerationSource
): Promise<ModerationResult> {
  let result: ModerationResult;
  try {
    const { data, error } = await supabase.functions.invoke("moderate", {
      body: { content, useAI },
    });
    if (error || !data) {
      return { clean: content, flagged: false, severe: false, reason: "", blocked: false };
    }
    result = data as ModerationResult;
  } catch {
    return { clean: content, flagged: false, severe: false, reason: "", blocked: false };
  }

  // Log to moderation_log if anything was flagged or blocked
  if (source && (result.flagged || result.blocked)) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("moderation_log").insert({
        user_id: user?.id ?? null,
        source,
        action: result.blocked ? "blocked" : "filtered",
        reason: result.reason || null,
        original: content.slice(0, 2000),
        result: result.blocked ? null : result.clean.slice(0, 2000),
      });
    } catch {
      // ignore log failures
    }
  }

  return result;
}
