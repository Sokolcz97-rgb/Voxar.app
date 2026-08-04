import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, X, Loader2, Sparkles, Square, Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Markdown } from "@/components/Markdown";
import { supabase } from "@/integrations/supabase/client";
import voxLogo from "@/assets/vox-logo.png.asset.json";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-helper`;
const STORAGE_KEY = "voxapp_ai_chat";

/**
 * Holographic HUD variant of the AI helper for the /app desktop shell.
 * Web (marketing) uses the classic `AIHelper` — keep visuals separate.
 */
export function AIHelperHolo() {
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

  return createPortal(
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-[9999] group flex items-center gap-2 pl-2.5 pr-3.5 py-2 bg-[hsl(222_40%_7%/0.92)] border border-primary/45 backdrop-blur-md shadow-[0_0_22px_hsl(var(--primary)/0.35)] hover:border-primary/80 hover:shadow-[0_0_32px_hsl(var(--primary)/0.55)] transition-all [clip-path:polygon(12px_0,100%_0,100%_calc(100%-12px),calc(100%-12px)_100%,0_100%,0_12px)]"
          aria-label={t("ai.open")}
        >
          <span className="hex-frame w-8 h-8 bg-primary/12 border border-primary/50 flex items-center justify-center shrink-0">
            <img src={voxLogo.url} alt="" className="w-5 h-5 object-contain" />
          </span>
          <span className="font-display text-[9px] tracking-[0.28em] uppercase text-primary/90 whitespace-nowrap">
            Studiovoxario AI
          </span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-[9999] w-[min(420px,calc(100vw-2.5rem))] max-h-[calc(100vh-2.5rem)] h-[min(560px,calc(100vh-2.5rem))] flex flex-col holo-context-menu overflow-hidden">
          <div className="relative flex items-center justify-between p-4 border-b border-primary/25 bg-gradient-to-r from-primary/12 via-primary/5 to-transparent">

            <div className="absolute top-0 left-0 w-10 h-px bg-primary/70" />
            <div className="absolute top-0 left-0 w-px h-10 bg-primary/70" />
            <div className="flex items-center gap-2.5">
              <div className="hex-frame w-9 h-9 bg-[hsl(222_40%_8%)] border border-primary/45 flex items-center justify-center shadow-[0_0_14px_hsl(var(--primary)/0.5)]">
                <img src={voxLogo.url} alt="" className="w-6 h-6 object-contain" />
              </div>
              <div>
                <div className="font-display font-bold text-[13px] tracking-[0.2em] text-glow uppercase">StudioVoxario AI</div>
                <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.28em] text-primary/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_hsl(160_84%_45%)] animate-pulse" />
                  {t("ai.online")}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={newChat} title={t("ai.newChatTitle")}
                className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] bg-primary/15 text-primary hover:bg-primary/30 px-2.5 py-1.5 border border-primary/40 transition-all">
                <Plus className="h-3 w-3" />{t("ai.newChat")}
              </button>
              {messages.length > 0 && (
                <button onClick={clearChat} title={t("ai.clear") || "Smazat"}
                  className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.2em] bg-destructive/15 text-destructive hover:bg-destructive/30 px-2.5 py-1.5 border border-destructive/40 transition-all">
                  <X className="h-3 w-3" />{t("ai.clear")}
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-primary p-1" aria-label={t("ai.close")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-10 px-4">
                <div className="inline-flex items-center justify-center w-14 h-14 hex-frame bg-primary/10 border border-primary/35 mb-3 shadow-[0_0_18px_hsl(var(--primary)/0.35)]">
                  <img src={voxLogo.url} alt="" className="w-8 h-8 object-contain" />
                </div>
                <p className="font-display font-bold text-sm mb-1 uppercase tracking-wider">{t("ai.greeting")}</p>
                <p className="text-xs text-muted-foreground">{t("ai.intro")}</p>
                <div className="mt-4 grid gap-2">
                  {[0, 1, 2].map((i) => {
                    const q = t(`ai.suggestions.${i}`);
                    return (
                      <button key={i} onClick={() => { setInput(q); setTimeout(send, 0); }}
                        className="text-xs text-left px-3 py-2 rounded-md border border-primary/25 hover:border-primary/60 hover:bg-primary/5 transition-all">
                        {q}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                <div className={`max-w-[85%] px-3.5 py-2 text-sm border backdrop-blur-sm ${
                  m.role === "user"
                    ? "bg-primary/18 text-foreground border-primary/45 shadow-[0_0_14px_hsl(var(--primary)/0.2)] [clip-path:polygon(10px_0,100%_0,100%_calc(100%-10px),calc(100%-10px)_100%,0_100%,0_10px)]"
                    : "bg-[hsl(222_35%_8%/0.8)] text-secondary-foreground border-primary/20 [clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,10px_100%,0_calc(100%-10px))]"
                }`}>
                  {m.role === "assistant"
                    ? <Markdown content={m.content || (loading && i === messages.length - 1 ? "…" : "")} />
                    : <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-secondary/60 border border-primary/20 rounded-md px-3.5 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-primary/25 p-3 flex gap-2 items-center bg-[hsl(222_35%_6%/0.6)]">
            <span className="font-display text-[9px] tracking-[0.28em] uppercase text-primary/70 shrink-0">TX &gt;</span>
            <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder={t("ai.askPlaceholder")} disabled={loading}
              className="text-sm font-mono bg-background/60 border-primary/25 focus-visible:ring-primary/40" />
            {loading ? (
              <Button onClick={stopGenerating} size="icon" variant="destructive" className="shrink-0" title={t("ai.stop") || "Zastavit"}>
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={send} disabled={!input.trim()} size="icon"
                className="bg-primary/25 border border-primary/50 text-primary hover:bg-primary/40 shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
