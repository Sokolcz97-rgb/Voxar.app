import { useState, useCallback, useRef } from "react";
import {
  Radar,
  Radio,
  Server,
  Settings,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  RotateCw,
  Globe,
  LogOut,
  Network,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrowserWebview, type WebviewHandle } from "@/components/vox/BrowserWebview";

export type BrowserTab = {
  id: string;
  title: string;
  url: string;
};

const INITIAL_TABS: BrowserTab[] = [
  { id: "t1", title: "Dashboard", url: "https://studiovoxario.com/dashboard" },
  { id: "t2", title: "LFG Radar", url: "https://studiovoxario.com/lfg" },
];

const DOCK_ITEMS = [
  { id: "lfg", label: "LFG Radar", icon: Radar },
  { id: "kick", label: "Kick Stream", icon: Radio },
  { id: "ptero", label: "Pterodactyl Server Manager", icon: Server },
  { id: "settings", label: "Settings", icon: Settings },
];

type BrowserTabButtonProps = {
  tab: BrowserTab;
  isActive: boolean;
  isDragging: boolean;
  onActivate: (id: string) => void;
  onClose: (event: React.MouseEvent, id: string) => void;
  onPointerDown: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void;
  onPointerMove: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void;
  onPointerUp: (event: React.PointerEvent<HTMLButtonElement>, id: string) => void;
};

function BrowserTabButton({
  tab,
  isActive,
  isDragging,
  onActivate,
  onClose,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: BrowserTabButtonProps) {
  return (
    <button
      type="button"
      data-browser-tab-id={tab.id}
      onClick={() => onActivate(tab.id)}
      onPointerDown={(event) => onPointerDown(event, tab.id)}
      onPointerMove={(event) => onPointerMove(event, tab.id)}
      onPointerUp={(event) => onPointerUp(event, tab.id)}
      onPointerCancel={(event) => onPointerUp(event, tab.id)}
      className={cn(
        "group relative flex items-center gap-2 min-w-[120px] max-w-[200px] h-9 px-3 text-xs font-medium",
        "transition-[background-color,color,box-shadow,opacity] bg-secondary/30 hover:bg-secondary/60",
        "cursor-grab active:cursor-grabbing touch-none select-none",
        isActive && "bg-secondary/80 text-foreground",
        isDragging && "bg-secondary/90 opacity-80 shadow-[0_8px_24px_hsl(var(--background)/0.65),0_0_14px_hsl(var(--primary)/0.35)] z-30"
      )}
    >
      <span className="truncate pointer-events-none">{tab.title}</span>
      <span
        role="button"
        tabIndex={0}
        data-tab-close
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => onClose(e, tab.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onClose(e as any, tab.id);
        }}
        className="ml-auto opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 hover:bg-destructive/20 hover:text-destructive transition-colors cursor-pointer"
      >
        <X className="w-3 h-3" />
      </span>
      {isActive && (
        <span className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gradient-to-r from-primary via-primary-glow to-primary shadow-[0_0_10px_hsl(var(--primary)/0.9)] pointer-events-none" />
      )}
    </button>
  );
}

function getDesktopBridge(): any {
  if (typeof window === "undefined") return null;
  return (window as any).studioVoxarioDesktop ?? null;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/)/i.test(trimmed)) return trimmed;
  if (/^[a-z0-9]+([\-.][a-z0-9]+)*\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

export default function VoxarioBrowser() {
  const [tabs, setTabs] = useState<BrowserTab[]>(INITIAL_TABS);
  const [activeTabId, setActiveTabId] = useState<string>(INITIAL_TABS[0].id);
  const [urlInput, setUrlInput] = useState<string>(INITIAL_TABS[0].url);
  const [activeDock, setActiveDock] = useState<string | null>(null);
  const [navState, setNavState] = useState({ canGoBack: false, canGoForward: false, loading: false });
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const engines = useRef<Record<string, WebviewHandle | null>>({});
  const tabDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const ignoreNextTabClickRef = useRef<string | null>(null);
  const desktop = getDesktopBridge();
  const hasEngine = typeof window !== "undefined" && !!(window as any).process?.versions?.electron
    || !!desktop?.isDesktop;

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const updateActiveTabUrl = useCallback(
    (url: string) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, url } : t))
      );
    },
    [activeTabId]
  );

  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const nextUrl = normalizeUrl(urlInput);
      updateActiveTabUrl(nextUrl);
      setUrlInput(nextUrl);
    },
    [urlInput, updateActiveTabUrl]
  );

  const activateTab = useCallback(
    (id: string) => {
      if (ignoreNextTabClickRef.current === id) {
        ignoreNextTabClickRef.current = null;
        return;
      }
      setActiveTabId(id);
      const tab = tabs.find((t) => t.id === id);
      if (tab) setUrlInput(tab.url);
    },
    [tabs]
  );

  const addTab = useCallback(() => {
    const newTab: BrowserTab = {
      id: generateId(),
      title: "New Tab",
      url: "https://studiovoxario.com",
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput(newTab.url);
  }, []);

  const closeTab = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setTabs((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((t) => t.id !== id);
        if (activeTabId === id) {
          const idx = prev.findIndex((t) => t.id === id);
          const fallback = prev[idx - 1] ?? prev[idx + 1] ?? next[0];
          setActiveTabId(fallback.id);
          setUrlInput(fallback.url);
        }
        return next;
      });
    },
    [activeTabId]
  );

  const handleTabPointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (target.closest("[data-tab-close]")) return;

      event.currentTarget.setPointerCapture?.(event.pointerId);
      tabDragRef.current = {
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
      };
    },
    []
  );

  const handleTabPointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
      const drag = tabDragRef.current;
      if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return;

      if (!drag.dragging) {
        const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
        if (distance < 5) return;
        drag.dragging = true;
        setDraggedTabId(id);
      }

      event.preventDefault();

      const hovered = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-browser-tab-id]");
      const targetId = hovered?.dataset.browserTabId;
      if (!targetId || targetId === id) return;

      setTabs((prev) => {
        const oldIndex = prev.findIndex((tab) => tab.id === id);
        const newIndex = prev.findIndex((tab) => tab.id === targetId);
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return prev;

        const next = [...prev];
        const [moved] = next.splice(oldIndex, 1);
        next.splice(newIndex, 0, moved);
        return next;
      });
    },
    []
  );

  const handleTabPointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, id: string) => {
      const drag = tabDragRef.current;
      if (!drag || drag.id !== id || drag.pointerId !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }

      if (drag.dragging) {
        ignoreNextTabClickRef.current = id;
        event.preventDefault();
      }

      tabDragRef.current = null;
      setDraggedTabId(null);
    },
    []
  );

  const navigateBack = useCallback(() => {
    engines.current[activeTabId]?.goBack();
  }, [activeTabId]);

  const navigateForward = useCallback(() => {
    engines.current[activeTabId]?.goForward();
  }, [activeTabId]);

  const reloadPage = useCallback(() => {
    const engine = engines.current[activeTabId];
    if (engine) engine.reload();
    else setUrlInput(activeTab?.url ?? "");
  }, [activeTabId, activeTab?.url]);

  const returnToLauncher = useCallback(() => {
    getDesktopBridge()?.returnToLauncher?.();
  }, []);

  const openVoxarApp = useCallback(() => {
    const bridge = getDesktopBridge();
    if (bridge?.openModule) bridge.openModule("app");
    else window.location.assign("/app");
  }, []);

  const handleDockClick = useCallback(
    (id: string) => {
      setActiveDock((prev) => (prev === id ? null : id));
      const urls: Record<string, string> = {
        lfg: "https://studiovoxario.com/lfg",
        kick: "https://kick.com",
        ptero: "https://pterodactyl.io",
        settings: "app://settings",
      };
      const nextUrl = urls[id] ?? "https://studiovoxario.com";
      updateActiveTabUrl(nextUrl);
      setUrlInput(nextUrl);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId ? { ...t, title: DOCK_ITEMS.find((d) => d.id === id)?.label ?? t.title, url: nextUrl } : t
        )
      );
    },
    [activeTabId, updateActiveTabUrl]
  );

  return (
    <div className="hud-root hud-shell h-screen w-screen overflow-hidden text-foreground flex">
      {/* Left GX Dock */}
      <aside className="shrink-0 w-16 h-full p-3 flex flex-col gap-3">
        <div className="holo-pod pod-left h-full flex flex-col items-center py-4 gap-3 overflow-hidden">
          <div className="hex-frame w-9 h-9 flex items-center justify-center bg-primary/10 mb-2">
            <Globe className="w-4 h-4 text-primary text-glow" />
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

          {DOCK_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeDock === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleDockClick(item.id)}
                title={item.label}
                className={cn(
                  "relative w-10 h-10 flex items-center justify-center transition-all duration-200",
                  "bg-secondary/40 hover:bg-primary/15 group",
                  isActive && "bg-primary/20 shadow-[inset_0_0_12px_hsl(var(--primary)/0.35)]"
                )}
              >
                <Icon
                  className={cn(
                    "w-[18px] h-[18px] transition-colors",
                    isActive ? "text-primary text-glow" : "text-muted-foreground group-hover:text-primary"
                  )}
                />
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-gradient-to-b from-primary to-primary-glow shadow-[0_0_8px_hsl(var(--primary)/0.9)]" />
                )}
              </button>
            );
          })}

          <div className="flex-1" />

          <button
            type="button"
            onClick={openVoxarApp}
            title="Voxar.app"
            className="relative w-10 h-10 flex items-center justify-center bg-secondary/40 hover:bg-gold/15 text-muted-foreground hover:text-gold transition-all duration-200"
          >
            <Network className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            onClick={returnToLauncher}
            title="Zpět do launcheru"
            className="relative w-10 h-10 flex items-center justify-center bg-secondary/40 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all duration-200"
          >
            <LogOut className="w-[18px] h-[18px]" />
          </button>

          <div className="font-display text-[9px] tracking-[0.3em] text-muted-foreground/60 uppercase rotate-180 [writing-mode:vertical-rl]">
            Voxario
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 min-w-0 h-full p-3 pl-0 flex flex-col gap-3">
        {/* Header pod */}
        <div className="holo-pod pod-center shrink-0 flex flex-col overflow-visible">
          {/* Tabs row */}
          <div className="flex items-center gap-1 px-2 pt-2 pb-1 border-b border-primary/10">
            <div className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar">
              {tabs.map((tab) => (
                <BrowserTabButton
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  isDragging={tab.id === draggedTabId}
                  onActivate={activateTab}
                  onClose={closeTab}
                  onPointerDown={handleTabPointerDown}
                  onPointerMove={handleTabPointerMove}
                  onPointerUp={handleTabPointerUp}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addTab}
              title="New tab"
              className="w-8 h-8 flex items-center justify-center bg-secondary/40 hover:bg-primary/15 text-muted-foreground hover:text-primary transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Address bar row */}
          <form
            onSubmit={handleUrlSubmit}
            className="flex items-center gap-2 px-3 py-2"
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={navigateBack}
                disabled={hasEngine && !navState.canGoBack}
                title="Back"
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={navigateForward}
                disabled={hasEngine && !navState.canGoForward}
                title="Forward"
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={reloadPage}
                title="Reload"
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                ref={urlInputRef}
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="Enter address or search..."
                className="w-full h-9 pl-10 pr-4 bg-background/60 border border-primary/20 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:shadow-[0_0_12px_hsl(var(--primary)/0.25)] transition-all"
              />
            </div>
          </form>
        </div>

        {/* Viewport */}
        <div className="holo-pod pod-center flex-1 min-h-0 overflow-hidden relative">
          {hasEngine ? (
            tabs.map((tab) => (
              <BrowserWebview
                key={tab.id}
                url={tab.url}
                active={tab.id === activeTabId}
                onRegister={(api) => { engines.current[tab.id] = api; }}
                onNavigate={(next) => {
                  setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, url: next } : t)));
                  if (tab.id === activeTabId) setUrlInput(next);
                }}
                onTitle={(title) =>
                  setTabs((prev) => prev.map((t) => (t.id === tab.id ? { ...t, title } : t)))
                }
                onNavState={(s) => { if (tab.id === activeTabId) setNavState(s); }}
              />
            ))
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center p-8 pointer-events-none select-none">
              <div className="hex-frame w-28 h-28 flex items-center justify-center bg-primary/5 animate-pulse">
                <Globe className="w-12 h-12 text-primary/60 text-glow" />
              </div>
              <div className="space-y-2">
                <h1 className="font-display text-xl tracking-[0.22em] uppercase text-glow">
                  VoxarioBrowser
                </h1>
                <p className="font-mono text-sm text-muted-foreground max-w-md">
                  Chromium engine běží pouze v desktopové aplikaci. Ve webové verzi je náhled vypnutý.
                </p>
              </div>
              <div className="font-mono text-xs text-muted-foreground/60 border border-primary/20 px-4 py-2 bg-background/40">
                Active URL: {activeTab?.url || "—"}
              </div>
            </div>
          )}

          {/* Decorative HUD grid lines inside viewport */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-primary to-transparent" />
            <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary to-transparent" />
          </div>
        </div>
      </main>
    </div>
  );
}
