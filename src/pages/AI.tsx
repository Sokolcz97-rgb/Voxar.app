import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import {
  generateWithVoxarioBrowserAI,
  interruptVoxarioBrowserAI,
  supportsVoxarioBrowserAI,
} from "@/lib/voxarioBrowserRuntime";
import {
  Bot,
  Cpu,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";

type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  created_at: string;
};

type AiRuntimeMode = "auto" | "local" | "engine" | "compat";
type ResolvedAiRuntimeMode = Exclude<AiRuntimeMode, "auto">;

const db = supabase as any;
const ENGINE_URL = (import.meta.env.VITE_VOXARIO_AI_API_URL as string | undefined)?.replace(/\/$/, "");
const FALLBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-helper`;
const RUNTIME_STORAGE_KEY = "voxario-ai-runtime";

const isRuntimeMode = (value: string | null): value is AiRuntimeMode =>
  value === "auto" || value === "local" || value === "engine" || value === "compat";

const AI = () => {
  const { user, session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [localProgress, setLocalProgress] = useState("");
  const [runtimeMode, setRuntimeMode] = useState<AiRuntimeMode>(() => {
    if (typeof window === "undefined") return "auto";
    const saved = window.localStorage.getItem(RUNTIME_STORAGE_KEY);
    return isRuntimeMode(saved) ? saved : "auto";
  });
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const webGpuAvailable = useMemo(() => supportsVoxarioBrowserAI(), []);

  const resolvedMode: ResolvedAiRuntimeMode = useMemo(() => {
    if (runtimeMode === "local") {
      if (webGpuAvailable) return "local";
      return ENGINE_URL ? "engine" : "compat";
    }
    if (runtimeMode === "engine") return ENGINE_URL ? "engine" : "compat";
    if (runtimeMode === "compat") return "compat";
    return ENGINE_URL ? "engine" : "compat";
  }, [runtimeMode, webGpuAvailable]);

  const runtimeLabel = useMemo(() => {
    if (resolvedMode === "local") return "Voxario Local · WebGPU";
    if (resolvedMode === "engine") return "Voxario AI Engine";
    return "StudioVoxario AI · kompatibilní režim";
  }, [resolvedMode]);

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, search]);

  const loadConversations = async () => {
    if (!user) return;
    const { data, error } = await db
      .from("ai_conversations")
      .select("id,title,model,created_at,updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error(error);
      toast({ title: "Nepodařilo se načíst chaty", variant: "destructive" });
      return;
    }
    setConversations(data ?? []);
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await db
      .from("ai_messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      toast({ title: "Nepodařilo se načíst zprávy", variant: "destructive" });
      return;
    }
    setMessages(data ?? []);
  };

  useEffect(() => {
    if (!user) return;
    void loadConversations();
  }, [user?.id]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    void loadMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, localProgress]);

  const changeRuntimeMode = (mode: AiRuntimeMode) => {
    if (mode === "local" && !webGpuAvailable) {
      toast({
        title: "WebGPU není dostupné",
        description: "Voxario Local potřebuje prohlížeč a grafiku s podporou WebGPU.",
        variant: "destructive",
      });
      return;
    }
    if (mode === "engine" && !ENGINE_URL) {
      toast({
        title: "Voxario AI Engine zatím není nasazený",
        description: "Nejdřív musíme nastavit produkční URL enginu.",
      });
      return;
    }
    setRuntimeMode(mode);
    setLocalProgress("");
    window.localStorage.setItem(RUNTIME_STORAGE_KEY, mode);
  };

  const createConversation = async (seed?: string) => {
    if (!user) return null;
    const title = seed?.trim() ? seed.trim().slice(0, 64) : "Nový chat";
    const model = resolvedMode === "local" ? "voxario-local" : resolvedMode === "engine" ? "voxario-engine" : "voxario-compat";
    const { data, error } = await db
      .from("ai_conversations")
      .insert({ user_id: user.id, title, model })
      .select("id,title,model,created_at,updated_at")
      .single();
    if (error || !data) {
      console.error(error);
      toast({ title: "Chat se nepodařilo vytvořit", variant: "destructive" });
      return null;
    }
    setConversations((prev) => [data, ...prev]);
    setActiveId(data.id);
    setMessages([]);
    return data as Conversation;
  };

  const newChat = async () => {
    abortRef.current?.abort();
    void interruptVoxarioBrowserAI();
    setLoading(false);
    setLocalProgress("");
    setInput("");
    setActiveId(null);
    setMessages([]);
  };

  const renameConversation = async (conversation: Conversation) => {
    const next = window.prompt("Nový název chatu", conversation.title)?.trim();
    if (!next || next === conversation.title) return;
    const { error } = await db
      .from("ai_conversations")
      .update({ title: next.slice(0, 100), updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
    if (error) return toast({ title: "Přejmenování se nezdařilo", variant: "destructive" });
    await loadConversations();
  };

  const deleteConversation = async (conversation: Conversation) => {
    if (!window.confirm(`Smazat chat „${conversation.title}“?`)) return;
    const { error } = await db.from("ai_conversations").delete().eq("id", conversation.id);
    if (error) return toast({ title: "Smazání se nezdařilo", variant: "destructive" });
    if (activeId === conversation.id) {
      setActiveId(null);
      setMessages([]);
    }
    await loadConversations();
  };

  const callAI = async (conversationId: string, content: string, nextMessages: ChatMessage[]) => {
    const controller = new AbortController();
    abortRef.current = controller;

    if (resolvedMode === "local") {
      return generateWithVoxarioBrowserAI(
        nextMessages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
        (progress) => {
          const percent =
            typeof progress.progress === "number" && progress.progress >= 0 && progress.progress < 1
              ? ` ${Math.round(progress.progress * 100)} %`
              : "";
          setLocalProgress(`${progress.text}${percent}`);
        },
      );
    }

    if (resolvedMode === "engine" && ENGINE_URL) {
      const response = await fetch(`${ENGINE_URL}/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ conversation_id: conversationId, message: content }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Voxario AI Engine returned ${response.status}`);
      const data = await response.json();
      return String(data?.message ?? "");
    }

    const response = await fetch(FALLBACK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        messages: nextMessages
          .filter((message) => message.role === "user" || message.role === "assistant")
          .map((message) => ({ role: message.role, content: message.content })),
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`StudioVoxario AI returned ${response.status}`);
    const data = await response.json();
    return String(data?.content ?? "");
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !user) return;
    setLoading(true);
    setLocalProgress(resolvedMode === "local" ? "Připravuji Voxario Local…" : "");
    setInput("");

    try {
      let conversationId = activeId;
      let isNew = false;
      if (!conversationId) {
        const created = await createConversation(text);
        if (!created) return;
        conversationId = created.id;
        isNew = true;
      }

      const optimistic: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      const nextMessages = [...messages, optimistic];
      setMessages(nextMessages);

      const { data: storedUser, error: userError } = await db
        .from("ai_messages")
        .insert({ conversation_id: conversationId, user_id: user.id, role: "user", content: text })
        .select("id,role,content,created_at")
        .single();
      if (userError) throw userError;

      const prepared = [...messages, storedUser as ChatMessage];
      setMessages(prepared);
      const answer = await callAI(conversationId, text, prepared);

      const { data: storedAssistant, error: assistantError } = await db
        .from("ai_messages")
        .insert({ conversation_id: conversationId, user_id: user.id, role: "assistant", content: answer })
        .select("id,role,content,created_at")
        .single();
      if (assistantError) throw assistantError;

      setMessages((prev) => [...prev, storedAssistant as ChatMessage]);
      await db
        .from("ai_conversations")
        .update({ updated_at: new Date().toISOString(), ...(isNew ? { title: text.slice(0, 64) } : {}) })
        .eq("id", conversationId);
      await loadConversations();
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error(error);
        toast({
          title: "Voxario AI neodpovědělo",
          description:
            resolvedMode === "local"
              ? "Lokální model se nepodařilo načíst nebo spustit. Zkontroluj podporu WebGPU a volnou grafickou paměť."
              : "Zkus to prosím znovu. Připojení k AI enginu může být ještě nedostupné.",
          variant: "destructive",
        });
      }
    } finally {
      abortRef.current = null;
      setLocalProgress("");
      setLoading(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    void interruptVoxarioBrowserAI();
    setLocalProgress("");
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-20" />
      <Navbar />

      <main className="container py-4 sm:py-6">
        <div className="web-panel overflow-hidden min-h-[calc(100vh-7.5rem)] flex">
          <aside className={`${sidebarOpen ? "flex" : "hidden lg:flex"} w-full lg:w-72 shrink-0 border-r border-border/60 flex-col bg-background/30`}>
            <div className="p-3 border-b border-border/60">
              <Button onClick={newChat} className="web-btn web-btn-primary w-full justify-start gap-2" variant="ghost">
                <Plus className="h-4 w-4" /> Nový chat
              </Button>
              <div className="mt-3 relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Hledat v chatech"
                  className="w-full h-10 pl-9 pr-3 bg-background/50 border border-border/70 text-sm outline-none focus:border-primary/60"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredConversations.length === 0 && (
                <div className="px-3 py-6 text-center text-xs text-muted-foreground">Zatím tu nemáš žádné uložené chaty.</div>
              )}
              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`group flex items-center gap-2 border px-2 py-2 transition-colors ${activeId === conversation.id ? "border-primary/50 bg-primary/10" : "border-transparent hover:border-border hover:bg-background/40"}`}
                >
                  <button onClick={() => { setActiveId(conversation.id); setSidebarOpen(false); }} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-sm truncate">{conversation.title}</span>
                    </div>
                  </button>
                  <button onClick={() => renameConversation(conversation)} className="p-1 text-muted-foreground hover:text-primary opacity-60 group-hover:opacity-100" aria-label="Přejmenovat">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => deleteConversation(conversation)} className="p-1 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100" aria-label="Smazat">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <section className={`${sidebarOpen ? "hidden lg:flex" : "flex"} flex-1 min-w-0 flex-col`}>
            <header className="min-h-14 px-3 sm:px-5 py-2 border-b border-border/60 flex items-center gap-3 bg-background/20">
              <button onClick={() => setSidebarOpen((value) => !value)} className="lg:hidden p-2 border border-border/60 text-muted-foreground hover:text-primary" aria-label="Chaty">
                <MessageSquare className="h-4 w-4" />
              </button>
              <div className="relative">
                <Bot className="h-5 w-5 text-primary" />
                <Sparkles className="h-2.5 w-2.5 absolute -top-1 -right-1 text-gold" />
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold tracking-wide truncate">Voxario AI</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">{runtimeLabel}</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {resolvedMode === "local" && <Cpu className="h-4 w-4 text-primary hidden sm:block" />}
                <select
                  value={runtimeMode}
                  onChange={(event) => changeRuntimeMode(event.target.value as AiRuntimeMode)}
                  disabled={loading}
                  aria-label="AI runtime"
                  className="h-9 max-w-[11rem] bg-background/60 border border-border/70 px-2 text-xs outline-none focus:border-primary/60"
                >
                  <option value="auto">Automaticky</option>
                  <option value="local" disabled={!webGpuAvailable}>Voxario Local</option>
                  <option value="engine" disabled={!ENGINE_URL}>Voxario Engine</option>
                  <option value="compat">Kompatibilní</option>
                </select>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {messages.length === 0 ? (
                <div className="min-h-[55vh] flex items-center justify-center">
                  <div className="max-w-xl text-center">
                    <div className="mx-auto mb-5 h-16 w-16 web-panel web-panel-accent flex items-center justify-center">
                      {resolvedMode === "local" ? <Cpu className="h-7 w-7 text-primary" /> : <Bot className="h-7 w-7 text-primary" />}
                    </div>
                    <h1 className="font-display font-black text-2xl sm:text-3xl web-title-metal">Voxario AI</h1>
                    <p className="mt-3 text-sm sm:text-base text-muted-foreground web-copy">
                      Tvůj AI prostor přímo ve StudioVoxario. Chaty se ukládají k tvému účtu a jsou dostupné po dalším přihlášení.
                    </p>
                    {resolvedMode === "local" && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Lokální režim počítá odpovědi přímo na tvém zařízení. Při prvním použití se stáhne bootstrap model do cache prohlížeče; žádné AI tokeny se neúčtují.
                      </p>
                    )}
                    <div className="grid sm:grid-cols-3 gap-2 mt-6">
                      {["Pomoz mi s kódem", "Poradíš mi se serverem?", "Vysvětli mi něco krok za krokem"].map((text) => (
                        <button key={text} onClick={() => setInput(text)} className="web-panel p-3 text-xs text-left hover:border-primary/50 transition-colors">
                          {text}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto space-y-5">
                  {messages.filter((message) => message.role === "user" || message.role === "assistant").map((message) => (
                    <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[92%] sm:max-w-[82%] px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-primary text-primary-foreground web-cut" : "web-panel"}`}>
                        {message.role === "assistant" ? <Markdown content={message.content} /> : <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="web-panel px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>{resolvedMode === "local" && localProgress ? localProgress : "Voxario přemýšlí…"}</span>
                      </div>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <div className="border-t border-border/60 p-3 sm:p-4 bg-background/30">
              <div className="max-w-3xl mx-auto">
                <div className="web-panel p-2 flex items-end gap-2">
                  <textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void send();
                      }
                    }}
                    rows={1}
                    placeholder="Napiš zprávu Voxario AI…"
                    className="flex-1 resize-none min-h-11 max-h-40 bg-transparent border-0 outline-none px-2 py-2.5 text-sm"
                  />
                  {loading ? (
                    <Button onClick={stop} size="icon" variant="destructive" className="shrink-0" aria-label="Zastavit">
                      <Square className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={() => void send()} disabled={!input.trim()} size="icon" className="shrink-0 web-cut" aria-label="Odeslat">
                      <Send className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-center text-muted-foreground mt-2">AI může dělat chyby. Důležité informace si ověř.</p>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default AI;
