import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { Search, FileText, MessageSquare, User as UserIcon, Loader2, Clock, X } from "lucide-react";
import { Highlight } from "@/components/search/Highlight";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";

export const GlobalSearch = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "threads" | "posts" | "users">("all");

  // Detect prefixes: @ → users, # → threads. Strip prefix before searching.
  const trimmed = query.trim();
  const prefixFilter: "users" | "threads" | null =
    trimmed.startsWith("@") ? "users" : trimmed.startsWith("#") ? "threads" : null;
  const effectiveQuery = prefixFilter ? trimmed.slice(1) : query;
  const effectiveFilter = prefixFilter ?? filter;

  const { loading, threads, posts, users, reset } = useGlobalSearch(effectiveQuery);
  const { history, push: pushHistory, remove: removeHistory, clear: clearHistory } = useSearchHistory();

  const showThreads = (effectiveFilter === "all" || effectiveFilter === "threads") && threads.length > 0;
  const showPosts = (effectiveFilter === "all" || effectiveFilter === "posts") && posts.length > 0;
  const showUsers = (effectiveFilter === "all" || effectiveFilter === "users") && users.length > 0;

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
      setFilter("all");
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const go = (path: string) => {
    pushHistory(query);
    setOpen(false);
    navigate(path);
  };

  const empty =
    !loading && effectiveQuery.trim().length >= 2 && threads.length === 0 && posts.length === 0 && users.length === 0;

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
        {effectiveQuery.trim().length >= 2 && (
          <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50 overflow-x-auto">
            {([
              { id: "all", label: t("search.filterAll"), count: threads.length + posts.length + users.length },
              { id: "threads", label: t("search.threads"), count: threads.length },
              { id: "posts", label: t("search.posts"), count: posts.length },
              { id: "users", label: t("search.users"), count: users.length },
            ] as const).map((tab) => {
              const active = effectiveFilter === tab.id;
              const locked = !!prefixFilter;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={locked}
                  onClick={() => setFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  } ${locked && !active ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  {tab.label}
                  <span className="ml-1 opacity-60">{tab.count}</span>
                </button>
              );
            })}
            {prefixFilter && (
              <span className="ml-auto text-[10px] text-muted-foreground px-2">
                {t("search.prefixActive")}
              </span>
            )}
          </div>
        )}
        <CommandList>
          {effectiveQuery.trim().length < 2 && (
            <>
              {history.length > 0 && (
                <CommandGroup
                  heading={
                    <div className="flex items-center justify-between">
                      <span>{t("search.recent")}</span>
                      <button
                        type="button"
                        onClick={clearHistory}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        {t("search.clear")}
                      </button>
                    </div>
                  }
                >
                  {history.map((term) => (
                    <CommandItem
                      key={`hist-${term}`}
                      value={`history-${term}`}
                      onSelect={() => setQuery(term)}
                    >
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="truncate flex-1">{term}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeHistory(term);
                        }}
                        className="ml-2 opacity-60 hover:opacity-100"
                        aria-label={t("search.remove")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              <div className="py-6 text-center text-sm text-muted-foreground space-y-1">
                <div>{t("search.hint")}</div>
                <div className="text-xs opacity-80">{t("search.hintPrefix")}</div>
              </div>
            </>
          )}

          {loading && (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {empty && <CommandEmpty>{t("search.noResults")}</CommandEmpty>}

          {!loading && effectiveQuery.trim().length >= 2 && !showThreads && !showPosts && !showUsers && !empty && (
            <CommandEmpty>{t("search.noResultsInFilter")}</CommandEmpty>
          )}

          {showThreads && (
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
                  <span className="truncate"><Highlight text={th.title} query={effectiveQuery} /></span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {showPosts && (
            <>
              {showThreads && <CommandSeparator />}
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
                        {p.thread_title ? <Highlight text={p.thread_title} query={effectiveQuery} /> : "—"}
                      </div>
                      <div className="text-sm truncate"><Highlight text={p.content} query={effectiveQuery} /></div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {showUsers && (
            <>
              {(showThreads || showPosts) && <CommandSeparator />}
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
                      <span className="truncate"><Highlight text={name} query={effectiveQuery} /></span>
                      {u.username && (
                        <span className="ml-2 text-xs text-muted-foreground truncate">
                          @<Highlight text={u.username} query={effectiveQuery} />
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
