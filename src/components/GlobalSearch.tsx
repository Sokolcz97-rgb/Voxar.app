import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Search, FileText, MessageSquare, User as UserIcon, Loader2 } from "lucide-react";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const Highlight = ({ text, query }: { text: string; query: string }) => {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
  const parts = text.split(re);
  const lower = q.toLowerCase();
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lower ? (
          <mark key={i} className="bg-primary/30 text-primary-foreground rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
};

interface ThreadHit {
  id: string;
  title: string;
  slug: string;
  category_id: string;
  category_slug?: string;
}
interface PostHit {
  id: string;
  content: string;
  thread_id: string;
  thread_title?: string;
  thread_slug?: string;
  category_slug?: string;
}
interface UserHit {
  user_id: string;
  display_name: string | null;
  username: string | null;
}

export const GlobalSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [threads, setThreads] = useState<ThreadHit[]>([]);
  const [posts, setPosts] = useState<PostHit[]>([]);
  const [users, setUsers] = useState<UserHit[]>([]);
  const reqId = useRef(0);

  // ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setThreads([]);
      setPosts([]);
      setUsers([]);
    }
  }, [open]);

  // debounced search
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

      const threadHits = (thRes.data ?? []).map((th) => ({
        ...th,
        category_slug: catMap[th.category_id],
      })) as ThreadHit[];
      setThreads(threadHits);

      const postRows = (poRes.data ?? []) as { id: string; content: string; thread_id: string }[];
      const threadIds = Array.from(new Set(postRows.map((p) => p.thread_id)));
      let threadLookup: Record<string, { title: string; slug: string; category_id: string }> = {};
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

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const empty = !loading && query.trim().length >= 2 && threads.length === 0 && posts.length === 0 && users.length === 0;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground"
        aria-label={t("search.label")}
      >
        <Search className="h-4 w-4 sm:mr-2" />
        <span className="hidden sm:inline">{t("search.placeholder")}</span>
        <kbd className="hidden md:inline-flex ml-2 pointer-events-none h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t("search.inputPlaceholder")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.trim().length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              {t("search.hint")}
            </div>
          )}

          {loading && (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {empty && <CommandEmpty>{t("search.noResults")}</CommandEmpty>}

          {threads.length > 0 && (
            <CommandGroup heading={t("search.threads")}>
              {threads.map((th) => (
                <CommandItem
                  key={`th-${th.id}`}
                  value={`thread-${th.id}-${th.title}`}
                  onSelect={() =>
                    go(th.category_slug ? `/forum/${th.category_slug}/${th.slug}` : "/forum")
                  }
                >
                  <FileText className="h-4 w-4 mr-2 text-primary" />
                  <span className="truncate"><Highlight text={th.title} query={query} /></span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {posts.length > 0 && (
            <>
              {threads.length > 0 && <CommandSeparator />}
              <CommandGroup heading={t("search.posts")}>
                {posts.map((p) => (
                  <CommandItem
                    key={`po-${p.id}`}
                    value={`post-${p.id}-${p.content.slice(0, 30)}`}
                    onSelect={() =>
                      go(
                        p.category_slug && p.thread_slug
                          ? `/forum/${p.category_slug}/${p.thread_slug}`
                          : "/forum",
                      )
                    }
                  >
                    <MessageSquare className="h-4 w-4 mr-2 text-accent shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-muted-foreground truncate">
                        {p.thread_title ? <Highlight text={p.thread_title} query={query} /> : "—"}
                      </div>
                      <div className="text-sm truncate"><Highlight text={p.content} query={query} /></div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {users.length > 0 && (
            <>
              {(threads.length > 0 || posts.length > 0) && <CommandSeparator />}
              <CommandGroup heading={t("search.users")}>
                {users.map((u) => {
                  const name = u.display_name || u.username || "—";
                  return (
                    <CommandItem
                      key={`us-${u.user_id}`}
                      value={`user-${u.user_id}-${name}`}
                      onSelect={() => go(`/profile/${u.user_id}`)}
                    >
                      <UserIcon className="h-4 w-4 mr-2 text-primary" />
                      <span className="truncate"><Highlight text={name} query={query} /></span>
                      {u.username && (
                        <span className="ml-2 text-xs text-muted-foreground truncate">
                          @<Highlight text={u.username} query={query} />
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
