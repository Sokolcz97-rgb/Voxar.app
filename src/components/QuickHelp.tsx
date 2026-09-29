import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, Search, X, Wrench } from "lucide-react";
import { findQuickHelp, QUICK_HELP_ITEMS } from "@/lib/quickHelp";

export function QuickHelp({ variant = "web" }: { variant?: "web" | "holo" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useMemo(() => findQuickHelp(query, 6), [query]);

  const shell = variant === "holo"
    ? "bg-[hsl(222_40%_7%/0.82)] border-primary/45 backdrop-blur-xl shadow-[0_0_28px_hsl(var(--primary)/0.35)]"
    : "glass border-primary/30 shadow-[var(--glow-primary)]";

  return (
    <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2.5 border transition-all hover:border-primary/80 ${shell}`}
          aria-label="Otevřít rychlou pomoc"
        >
          <Wrench className="h-4 w-4 text-primary" />
          <span className="font-display text-[10px] tracking-[0.2em] uppercase text-primary">Rychlá pomoc</span>
        </button>
      ) : (
        <div className={`pointer-events-auto w-[min(390px,calc(100vw-3rem))] max-h-[min(560px,calc(100vh-3rem))] overflow-hidden border flex flex-col ${shell}`}>
          <div className="flex items-center justify-between gap-3 p-4 border-b border-border/60">
            <div>
              <div className="font-display font-bold text-sm tracking-wider">Voxario Rychlá pomoc</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Bez AI · bez tokenů · okamžitě</div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="p-1 text-muted-foreground hover:text-primary" aria-label="Zavřít">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Co hledáš? např. ticket, server, profil…"
                className="w-full h-10 pl-9 pr-3 bg-background/60 border border-border/70 text-sm outline-none focus:border-primary/60"
              />
            </div>
          </div>

          <div className="overflow-y-auto p-3 space-y-2">
            {results.length ? results.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setOpen(false)}
                className="block border border-border/60 hover:border-primary/50 bg-background/30 p-3 transition-colors"
              >
                <div className="font-medium text-sm">{item.title}</div>
                <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.description}</div>
              </Link>
            )) : (
              <div className="py-8 text-center">
                <HelpCircle className="mx-auto h-6 w-6 text-primary mb-2" />
                <p className="text-sm">Nic přesného jsem nenašel.</p>
                <p className="text-xs text-muted-foreground mt-1">Použij Fórum nebo Podporu.</p>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border/60 grid grid-cols-2 gap-2">
            <Link to="/forum" onClick={() => setOpen(false)} className="web-btn text-center py-2 text-xs">Fórum</Link>
            <Link to="/tickets" onClick={() => setOpen(false)} className="web-btn web-btn-primary text-center py-2 text-xs">Podpora</Link>
          </div>
        </div>
      )}
    </div>
  );
}

export const QUICK_HELP_COUNT = QUICK_HELP_ITEMS.length;
