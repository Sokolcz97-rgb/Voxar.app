import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, X, Loader2, Sparkles, Square, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Markdown } from "@/components/Markdown";
import { supabase } from "@/integrations/supabase/client";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-helper`;
const STORAGE_KEY = "neonhub_ai_chat";

/**
 * Public marketing site AI helper — classic rounded chat bubble.
 * The holographic HUD variant used inside the /app shell lives in
 * `src/components/vox/AIHelperHolo.tsx`. Keep the two visually separate.
 */
export function AIHelper() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: t("ai.signInRequired"), description: t("ai.signInRequiredDesc"), variant: "destructive" });
        setLoading(false); return;
      }
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: next }),
        signal: controller.signal,
      });
      if (resp.status === 429) { toast({ title: t("ai.rateLimit"), description: t("ai.rateLimitDesc") }); setLoading(false); return; }
      if (resp.status === 402) { toast({ title: t("ai.noCredits"), description: t("ai.noCreditsDesc"), variant: "destructive" }); setLoading(false); return; }
      if (!resp.ok) throw new Error("Request failed");
      const data = await resp.json();
      const content = String(data?.content ?? "");
      setMessages((prev) => [...prev, { role: "assistant", content }]);
      if (data?.escalated) {
        toast({
          title: t("ai.escalated"),
          description: data.ticket_id
            ? t("ai.escalatedWithTicket", { id: String(data.ticket_id).slice(0, 8) })
            : t("ai.escalatedNoTicket"),
        });
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        console.error(e);
        toast({ title: t("common.error"), description: t("ai.errorDesc"), variant: "destructive" });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const stopGenerating = () => { abortRef.current?.abort(); abortRef.current = null; setLoading(false); };
  const newChat = () => {
    abortRef.current?.abort(); abortRef.current = null; setLoading(false);
    setMessages([]); setInput(""); sessionStorage.removeItem(STORAGE_KEY);
  };
  const clearChat = () => { setMessages([]); sessionStorage.removeItem(STORAGE_KEY); };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 group"
          aria-label={t("ai.open")}
        >
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/40 blur-2xl group-hover:bg-primary/60 transition-all animate-pulse" />
            <div className="relative rounded-full w-14 h-14 bg-gradient-to-br from-primary to-primary-glow text-primary-foreground flex items-center justify-center shadow-[var(--glow-primary)] group-hover:scale-110 transition-transform">
              <Bot className="h-6 w-6" />
              <Sparkles className="h-3 w-3 absolute top-2 right-2 text-accent" />
            </div>
          </div>
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(420px,calc(100vw-3rem))] h-[min(560px,calc(100vh-3rem))] flex flex-col glass border border-primary/30 rounded-2xl shadow-[var(--glow-primary)] animate-scale-in overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Bot className="h-5 w-5 text-primary" />
                <Sparkles className="h-2.5 w-2.5 text-accent absolute -top-1 -right-1" />
              </div>
              <div>
                <div className="font-display font-bold text-sm tracking-wider">StudioVoxario AI</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("ai.online")}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={newChat}
                title={t("ai.newChatTitle")}
                className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary-glow px-3 py-1.5 rounded-md shadow-[var(--glow-soft)] hover:shadow-[var(--glow-primary)] hover:scale-105 transition-all border border-primary/50"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("ai.newChat")}
              </button>
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  title={t("ai.clear") || "Smazat"}
                  className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest bg-destructive/90 text-destructive-foreground hover:bg-destructive px-3 py-1.5 rounded-md hover:scale-105 transition-all border border-destructive/60"
                >
                  <X className="h-3.5 w-3.5" />
                  {t("ai.clear")}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1" aria-label={t("ai.close")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-10 px-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border border-primary/30 mb-3">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <p className="font-display font-bold text-sm mb-1">{t("ai.greeting")}</p>
                <p className="text-xs text-muted-foreground">{t("ai.intro")}</p>
                <div className="mt-4 grid gap-2">
                  {[0, 1, 2].map((i) => {
                    const q = t(`ai.suggestions.${i}`);
                    return (
                      <button
                        key={i}
                        onClick={() => { setInput(q); setTimeout(send, 0); }}
                        className="text-xs text-left px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        {q}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-secondary text-secondary-foreground rounded-bl-sm border border-border"
                }`}>
                  {m.role === "assistant" ? (
                    <Markdown content={m.content || (loading && i === messages.length - 1 ? "…" : "")} />
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-secondary border border-border rounded-2xl rounded-bl-sm px-3.5 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={t("ai.askPlaceholder")}
              disabled={loading}
              className="text-sm"
            />
            {loading ? (
              <Button
                onClick={stopGenerating}
                size="icon"
                variant="destructive"
                className="shrink-0"
                title={t("ai.stop") || "Zastavit"}
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={send}
                disabled={!input.trim()}
                size="icon"
                className="bg-primary text-primary-foreground hover:bg-primary-glow shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
