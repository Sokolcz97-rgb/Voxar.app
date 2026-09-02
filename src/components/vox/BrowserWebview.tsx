import { useEffect, useRef } from "react";

/** Electron <webview> wrapper — real Chromium engine for VoxarioBrowser. */
export type WebviewHandle = {
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  loadURL: (url: string) => void;
};

type Props = {
  url: string;
  active: boolean;
  onRegister: (api: WebviewHandle | null) => void;
  onNavigate: (url: string) => void;
  onTitle: (title: string) => void;
  onNavState: (state: { canGoBack: boolean; canGoForward: boolean; loading: boolean }) => void;
};

export function BrowserWebview({ url, active, onRegister, onNavigate, onTitle, onNavState }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const lastUrl = useRef<string>(url);

  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;

    const emitNavState = () => {
      try {
        onNavState({
          canGoBack: !!el.canGoBack?.(),
          canGoForward: !!el.canGoForward?.(),
          loading: !!el.isLoading?.(),
        });
      } catch {
        /* webview not attached yet */
      }
    };

    const handleNav = (e: any) => {
      if (e?.url) {
        lastUrl.current = e.url;
        onNavigate(e.url);
      }
      emitNavState();
    };
    const handleTitle = (e: any) => e?.title && onTitle(e.title);

    el.addEventListener("did-navigate", handleNav);
    el.addEventListener("did-navigate-in-page", handleNav);
    el.addEventListener("page-title-updated", handleTitle);
    el.addEventListener("did-start-loading", emitNavState);
    el.addEventListener("did-stop-loading", emitNavState);
    el.addEventListener("dom-ready", emitNavState);

    onRegister({
      goBack: () => { try { el.goBack(); } catch { /* noop */ } },
      goForward: () => { try { el.goForward(); } catch { /* noop */ } },
      reload: () => { try { el.reload(); } catch { /* noop */ } },
      loadURL: (next: string) => {
        lastUrl.current = next;
        try { el.loadURL(next); } catch { el.setAttribute("src", next); }
      },
    });

    return () => {
      el.removeEventListener("did-navigate", handleNav);
      el.removeEventListener("did-navigate-in-page", handleNav);
      el.removeEventListener("page-title-updated", handleTitle);
      el.removeEventListener("did-start-loading", emitNavState);
      el.removeEventListener("did-stop-loading", emitNavState);
      el.removeEventListener("dom-ready", emitNavState);
      onRegister(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External URL changes (address bar / dock) push into the engine.
  useEffect(() => {
    const el = ref.current as any;
    if (!el || !url || url === lastUrl.current) return;
    lastUrl.current = url;
    try { el.loadURL(url); } catch { el.setAttribute("src", url); }
  }, [url]);

  const Tag = "webview" as unknown as React.ElementType;

  return (
    <Tag
      ref={ref as any}
      src={url}
      allowpopups="true"
      partition="persist:voxario"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: active ? "flex" : "none",
        background: "#0a0a0f",
      }}
    />
  );
}
