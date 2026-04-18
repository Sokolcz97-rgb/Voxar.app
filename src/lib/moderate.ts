import { supabase } from "@/integrations/supabase/client";

export interface ModerationResult {
  clean: string;
  flagged: boolean;
  severe: boolean;
  reason: string;
  blocked: boolean;
}

export async function moderate(content: string, useAI = true): Promise<ModerationResult> {
  try {
    const { data, error } = await supabase.functions.invoke("moderate", {
      body: { content, useAI },
    });
    if (error || !data) {
      return { clean: content, flagged: false, severe: false, reason: "", blocked: false };
    }
    return data as ModerationResult;
  } catch {
    return { clean: content, flagged: false, severe: false, reason: "", blocked: false };
  }
}
