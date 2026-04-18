import { useState, useCallback } from "react";

const HISTORY_KEY = "neonhub:search-history";
const HISTORY_MAX = 5;

const load = (): string[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
};

const save = (items: string[]) => {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_MAX)));
  } catch {
    /* ignore */
  }
};

export const useSearchHistory = () => {
  const [history, setHistory] = useState<string[]>(() => load());

  const push = useCallback((q: string) => {
    const term = q.trim();
    if (term.length < 2) return;
    setHistory((prev) => {
      const next = [term, ...prev.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, HISTORY_MAX);
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((q: string) => {
    setHistory((prev) => {
      const next = prev.filter((x) => x !== q);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setHistory([]);
    save([]);
  }, []);

  return { history, push, remove, clear };
};
