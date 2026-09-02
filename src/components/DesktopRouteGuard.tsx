import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Když aplikace běží uvnitř Electron shellu (window.studioVoxarioDesktop),
 * musí uživatel vždy vidět /app layout. Cokoli jiného (/, /auth, /dashboard, …)
 * je marketingový web a pro desktop je to špatně – čistě přes React Router
 * (žádný window.location = žádný hard reload, žádná ztráta AuthContext state)
 * uživatele okamžitě přesměrujeme na /app.
 *
 * Řeší problém "po prvním přihlášení vidím web, správný layout až po restartu".
 */
export function DesktopRouteGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const isDesktop =
      typeof window !== "undefined" &&
      (window as any).studioVoxarioDesktop?.isDesktop === true;
    if (!isDesktop) return;

    // Modul „StudioVoxario HUB" se v desktopu spouští s ?hub=1 — v tom režimu
    // je celý web povolený (uživatel se vrací do launcheru přes rozcestník).
    try {
      if (new URLSearchParams(window.location.search).get("hub") === "1") {
        sessionStorage.setItem("sv_desktop_hub", "1");
      }
      if (sessionStorage.getItem("sv_desktop_hub") === "1") return;
    } catch {
      /* sessionStorage nedostupný */
    }

    const path = location.pathname;
    // Cesty, které v desktop aplikaci dávají smysl.
    const allowed =
      path === "/app" ||
      path.startsWith("/app/") ||
      path.startsWith("/browser") ||
      path.startsWith("/launcher") ||
      path.startsWith("/discord-oauth-complete") ||
      path.startsWith("/f/"); // veřejné formuláře přes deep link
    if (!allowed) {
      navigate("/app", { replace: true });
    }
  }, [location.pathname, navigate]);


  return null;
}
