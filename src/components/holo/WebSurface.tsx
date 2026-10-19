import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/** Trasy, které mají vlastní celoobrazovkové rozhraní (ne veřejný web). */
const APP_SURFACES = [/^\/app(\/|$)/, /^\/hra(\/|$)/];

export function isWebSurface(pathname: string) {
  return !APP_SURFACES.some((pattern) => pattern.test(pathname));
}

/**
 * Přepíná holografický vzhled webu (src/styles/holo.css) podle trasy a
 * vykresluje společné pozadí: hvězdné pole, mlhovinu, horizont planety a
 * perspektivní mřížku. Komunita /app má vlastní skin a pozadí.
 */
export function WebSurface() {
  const { pathname } = useLocation();
  const web = isWebSurface(pathname);

  useEffect(() => {
    const root = document.documentElement;
    if (web) root.dataset.surface = "web";
    else delete root.dataset.surface;
  }, [web]);

  if (!web) return null;
  return (
    <div className="holo-backdrop" aria-hidden="true">
      <div className="stars" />
      <div className="horizon" />
      <div className="grid" />
      <div className="scan" />
    </div>
  );
}
