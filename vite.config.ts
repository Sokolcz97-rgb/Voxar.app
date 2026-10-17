import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Web (Lovable hosting) musí používat absolutní "/" – jinak se při přímém
  // otevření/obnovení vnořené adresy (např. /admin/badges, /forum/x/y) načítají
  // skripty z /admin/assets/… a stránka zůstane bílá.
  // Electron otevírá renderer přes file://, proto desktop build spouští
  // `npm run build:desktop`, který předá --base ./ (relativní cesty).
  base: "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
