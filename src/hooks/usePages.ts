import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Block } from "@/lib/pageBuilder/types";

export interface PageRow {
  id: string;
  slug: string;
  title: string;
  nav_label: string | null;
  nav_position: number;
  is_published: boolean;
  is_system: boolean;
  draft_blocks: Block[];
  published_blocks: Block[];
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export function useNavPages() {
  const [pages, setPages] = useState<Pick<PageRow, "slug" | "nav_label" | "nav_position">[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("pages")
        .select("slug,nav_label,nav_position")
        .eq("is_published", true)
        .not("nav_label", "is", null)
        .order("nav_label");
      if (active && data) setPages(data as any);
    };
    load();

    const ch = supabase
      .channel("pages-nav")
      .on("postgres_changes", { event: "*", schema: "public", table: "pages" }, () => load())
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, []);

  return pages;
}

export async function fetchPageBySlug(slug: string, includeDraft = false) {
  const { data, error } = await supabase
    .from("pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  const page = data as unknown as PageRow;
  if (!page.is_published && !includeDraft) return null;
  return page;
}
