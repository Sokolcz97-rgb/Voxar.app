import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Loader2 } from "lucide-react";
import { fetchPageBySlug, type PageRow } from "@/hooks/usePages";
import { EditPageButton } from "@/components/pageBuilder/EditPageButton";
import { EditableBlocks } from "@/components/pageBuilder/EditableBlocks";
import { InlineEditorFrame } from "@/components/pageBuilder/InlineEditorChrome";
import { useInlineEditor } from "@/contexts/InlineEditorContext";
import { useAuth } from "@/contexts/AuthContext";
import NotFound from "./NotFound";

const RESERVED = new Set([
  "auth", "dashboard", "profile", "admin", "forum", "messages",
  "tickets", "leaderboard", "home",
]);

export default function DynamicPage() {
  const { slug = "" } = useParams();
  const { isEditor } = useAuth();
  const ed = useInlineEditor();
  const [page, setPage] = useState<PageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true); setNotFound(false);
    if (RESERVED.has(slug)) { setNotFound(true); setLoading(false); return; }
    fetchPageBySlug(slug, isEditor).then((p) => {
      if (!p) setNotFound(true);
      else { setPage(p); document.title = p.title; }
      setLoading(false);
    });
  }, [slug, isEditor]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>;
  }
  if (notFound || !page) return <NotFound />;

  const editingThis = ed.active && ed.slug === slug;
  const blocks = editingThis
    ? ed.blocks
    : (isEditor && page.draft_blocks?.length ? page.draft_blocks : page.published_blocks);

  return (
    <InlineEditorFrame>
      <div className="min-h-screen relative">
        <div className="fixed inset-0 -z-10 gradient-hero" />
        <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
        <Navbar />
        <main className="container max-w-4xl py-12 animate-fade-in">
          <EditableBlocks blocks={blocks} editable={editingThis} />
        </main>
        <EditPageButton slug={slug} />
      </div>
    </InlineEditorFrame>
  );
}
