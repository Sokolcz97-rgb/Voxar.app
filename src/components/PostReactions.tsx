import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const EMOJIS = ["👍", "❤️", "😂", "🔥"] as const;
type Emoji = (typeof EMOJIS)[number];

interface Row {
  emoji: string;
  user_id: string;
}

export const PostReactions = ({ postId }: { postId: string }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<Emoji | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("post_reactions")
        .select("emoji,user_id")
        .eq("post_id", postId);
      if (active) setRows((data ?? []) as Row[]);
    };
    load();

    const channel = supabase
      .channel(`post-reactions-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_reactions", filter: `post_id=eq.${postId}` },
        () => load(),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const toggle = async (emoji: Emoji) => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (busy) return;
    setBusy(emoji);
    const mine = rows.some((r) => r.emoji === emoji && r.user_id === user.id);
    try {
      if (mine) {
        const { error } = await supabase
          .from("post_reactions")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
        if (error) throw error;
        setRows((prev) => prev.filter((r) => !(r.emoji === emoji && r.user_id === user.id)));
      } else {
        const { error } = await supabase
          .from("post_reactions")
          .insert({ post_id: postId, user_id: user.id, emoji });
        if (error) throw error;
        setRows((prev) => [...prev, { emoji, user_id: user.id }]);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {EMOJIS.map((emoji) => {
        const count = rows.filter((r) => r.emoji === emoji).length;
        const mine = !!user && rows.some((r) => r.emoji === emoji && r.user_id === user.id);
        if (count === 0 && !user) return null;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => toggle(emoji)}
            disabled={busy === emoji}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all",
              "hover:scale-105 active:scale-95",
              mine
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:border-primary/40",
              count === 0 && "opacity-60",
            )}
            aria-label={`React ${emoji}`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 && <span className="font-medium">{count}</span>}
          </button>
        );
      })}
    </div>
  );
};
