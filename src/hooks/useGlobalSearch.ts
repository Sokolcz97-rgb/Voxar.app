import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ThreadHit {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  category_slug?: string;
}
export interface PostHit {
  id: string;
  content: string;
  thread_id: string;
  thread_title?: string;
  thread_slug?: string;
  category_slug?: string;
}
export interface UserHit {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

export const useGlobalSearch = (query: string) => {
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<ThreadHit[]>([]);
  const [posts, setPosts] = useState<PostHit[]>([]);
  const [users, setUsers] = useState<UserHit[]>([]);
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setThreads([]);
      setPosts([]);
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const myId = ++reqId.current;
    const handle = setTimeout(async () => {
      const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
      const [thRes, poRes, usRes, catsRes] = await Promise.all([
        supabase
          .from("forum_threads")
          .select("id,title,slug,category_id")
          .ilike("title", like)
          .order("updated_at", { ascending: false })
          .limit(5),
        supabase
          .from("forum_posts")
          .select("id,content,thread_id")
          .ilike("content", like)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("profiles")
          .select("user_id,display_name,username")
          .or(`display_name.ilike.${like},username.ilike.${like}`)
          .limit(5),
        supabase.from("forum_categories").select("id,slug"),
      ]);

      if (myId !== reqId.current) return;

      const catMap: Record<string, string> = {};
      (catsRes.data ?? []).forEach((c: { id: string; slug: string }) => (catMap[c.id] = c.slug));

      setThreads(
        (thRes.data ?? []).map((th) => ({
          ...th,
          category_slug: catMap[th.category_id],
        })) as ThreadHit[],
      );

      const postRows = (poRes.data ?? []) as { id: string; content: string; thread_id: string }[];
      const threadIds = Array.from(new Set(postRows.map((p) => p.thread_id)));
      const threadLookup: Record<string, { title: string; slug: string; category_id: string }> = {};
      if (threadIds.length) {
        const { data } = await supabase
          .from("forum_threads")
          .select("id,title,slug,category_id")
          .in("id", threadIds);
        (data ?? []).forEach((th) => {
          threadLookup[th.id] = { title: th.title, slug: th.slug, category_id: th.category_id };
        });
      }
      if (myId !== reqId.current) return;

      setPosts(
        postRows.map((p) => {
          const th = threadLookup[p.thread_id];
          return {
            ...p,
            thread_title: th?.title,
            thread_slug: th?.slug,
            category_slug: th ? catMap[th.category_id] : undefined,
          };
        }),
      );

      setUsers((usRes.data as UserHit[]) ?? []);
      setLoading(false);
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  const reset = () => {
    setThreads([]);
    setPosts([]);
    setUsers([]);
    setLoading(false);
  };

  return { loading, threads, posts, users, reset };
};
