import { useEffect, useState } from "react";
import { Pencil, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PageEditor } from "./PageEditor";
import type { Block } from "@/lib/pageBuilder/types";
import type { PageRow } from "@/hooks/usePages";
import { toast } from "@/hooks/use-toast";

export function EditPageButton({ slug }: { slug: string }) {
  const { isEditor } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState<PageRow | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase.from("pages").select("*").eq("slug", slug).maybeSingle().then(({ data, error }) => {
      setLoading(false);
      if (error || !data) {
        toast({ title: "Stránku se nepodařilo načíst", variant: "destructive" });
        setOpen(false);
        return;
      }
      setPage(data as unknown as PageRow);
    });
  }, [open, slug]);

  if (!isEditor) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-[0_8px_30px_-5px_hsl(var(--primary)/0.6)] hover:bg-primary-glow transition-all hover:scale-105"
        aria-label="Upravit stránku"
      >
        <Pencil className="h-4 w-4" />
        <span className="text-sm font-bold">Upravit stránku</span>
      </button>
      {open && loading && (
        <div className="fixed inset-0 z-[100] bg-background/80 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      {open && !loading && page && (
        <PageEditor
          pageId={page.id}
          initialBlocks={(page.draft_blocks?.length ? page.draft_blocks : page.published_blocks) as Block[]}
          onClose={() => { setOpen(false); setPage(null); }}
        />
      )}
    </>
  );
}
