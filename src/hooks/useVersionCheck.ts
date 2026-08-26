import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Detekce nové nasazené verze aplikace bez externích API.
 * Periodicky stáhne `/index.html` (no-store) a porovná hash názvy buildnutých
 * assetů. Pokud se změní, je nasazená nová verze.
 */
const POLL_MS = 60_000;

function extractBuildSignature(html: string): string | null {
  const matches = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)).map((m) => m[1]);
  if (!matches.length) return null;
  return matches.sort().join("|");
}

async function fetchSignature(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return extractBuildSignature(await res.text());
  } catch {
    return null;
  }
}

export function useVersionCheck() {
  const [updateReady, setUpdateReady] = useState(false);
  const baseline = useRef<string | null>(null);

  const enabled =
    import.meta.env.PROD &&
    typeof window !== "undefined" &&
    !(window as unknown as { studioVoxarioDesktop?: unknown }).studioVoxarioDesktop;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      if (document.hidden) return;
      const sig = await fetchSignature();
      if (cancelled || !sig) return;
      if (baseline.current === null) {
        baseline.current = sig;
        return;
      }
      if (sig !== baseline.current) setUpdateReady(true);
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);

    // Service worker (pokud je registrovaný) – nová verze čeká na aktivaci.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        if (reg.waiting) setUpdateReady(true);
        reg.addEventListener("updatefound", () => setUpdateReady(true));
      }).catch(() => {});
    }

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled]);

  const applyUpdate = useCallback(async () => {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map((r) => r.unregister()));
      }
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("_v", String(Date.now()));
    window.location.replace(url.toString());
  }, []);

  return { updateReady, applyUpdate, dismiss: () => setUpdateReady(false) };
}
