import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Global "G then X" navigation shortcuts (Vim/GitHub-style).
 * Press G, then within 1.2s press a destination key.
 * Ignored when typing in inputs/textareas/contenteditable.
 */
export const useGlobalShortcuts = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();
  const armedRef = useRef<number | null>(null);

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        node.isContentEditable
      );
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(e.target)) return;

      const key = e.key.toLowerCase();

      // Arm with "g"
      if (armedRef.current === null && key === "g") {
        e.preventDefault();
        armedRef.current = window.setTimeout(() => {
          armedRef.current = null;
        }, 1200);
        return;
      }

      // Second key after "g"
      if (armedRef.current !== null) {
        clearTimeout(armedRef.current);
        armedRef.current = null;

        const map: Record<string, { path: string; label: string; auth?: boolean }> = {
          h: { path: "/", label: t("nav.home", "Home") },
          f: { path: "/forum", label: t("nav.forum") },
          d: { path: "/dashboard", label: t("nav.dashboard"), auth: true },
          m: { path: "/messages", label: t("nav.messages"), auth: true },
          t: { path: "/tickets", label: t("nav.tickets"), auth: true },
          p: { path: "/profile", label: t("nav.profile"), auth: true },
        };

        const target = map[key];
        if (target) {
          e.preventDefault();
          if (target.auth && !user) {
            navigate("/auth");
            return;
          }
          navigate(target.path);
          toast({ description: `→ ${target.label}` });
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (armedRef.current !== null) clearTimeout(armedRef.current);
    };
  }, [navigate, t, user]);
};
