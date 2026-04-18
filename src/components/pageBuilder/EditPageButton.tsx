import { Pencil, Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useInlineEditor } from "@/contexts/InlineEditorContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { PageRow } from "@/hooks/usePages";
import type { Block } from "@/lib/pageBuilder/types";

export function EditPageButton({ slug }: { slug: string }) {
  const { isEditor } = useAuth();
  const { active, start } = useInlineEditor();
  const [loading, setLoading] = useState(false);

  if (!isEditor || active) return null;

  const handleClick = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("pages").select("*").eq("slug", slug).maybeSingle();
    setLoading(false);
    if (error || !data) {
      toast({ title: "Stránku se nepodařilo načíst", variant: "destructive" });
      return;
    }
    const page = data as unknown as PageRow;
    const blocks = (page.draft_blocks?.length ? page.draft_blocks : page.published_blocks) as Block[];
    start(page.id, page.slug, blocks ?? []);
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-[0_8px_30px_-5px_hsl(var(--primary)/0.6)] hover:bg-primary-glow transition-all hover:scale-105"
      aria-label="Upravit stránku"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
      <span className="text-sm font-bold">Upravit stránku</span>
    </button>
  );
}
