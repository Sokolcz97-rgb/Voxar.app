import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  badge?: { icon: LucideIcon; label: string; sublabel?: string };
  actions?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}

/**
 * Reusable premium page hero panel — glass + double blur gradients.
 * Used across user-facing pages for consistent "generation" feel.
 */
export function PageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  badge,
  actions,
  align = "left",
  className,
}: PageHeroProps) {
  const BadgeIcon = badge?.icon;
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/60 glass p-6 sm:p-8 md:p-10 mb-8",
        className,
      )}
    >
      {/* Decorative blurs */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
      {/* Subtle inner grid sheen */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div
        className={cn(
          "relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between",
          align === "center" && "md:flex-col md:items-center md:text-center",
        )}
      >
        <div className={cn("min-w-0", align === "center" && "mx-auto max-w-2xl")}>
          {eyebrow && (
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.32em] text-primary text-glow font-bold">
              {eyebrow}
            </p>
          )}
          <div className="flex items-start gap-3 mt-2">
            {Icon && (
              <div className="hidden sm:flex w-14 h-14 icon-cube-3d items-center justify-center shrink-0">
                <Icon className="h-6 w-6" />
              </div>
            )}
            <h1 className="font-display font-black text-3xl sm:text-4xl md:text-5xl leading-[1.05] tracking-tight">
              {typeof title === "string" ? (
                <span className="bg-gradient-to-r from-foreground via-foreground to-primary/80 bg-clip-text text-transparent">
                  {title}
                </span>
              ) : (
                title
              )}
            </h1>
          </div>
          {description && (
            <p className="text-muted-foreground mt-3 text-sm sm:text-base max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {(badge || actions) && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {badge && BadgeIcon && (
              <div className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5">
                <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center">
                  <BadgeIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="leading-tight">
                  {badge.sublabel && (
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      {badge.sublabel}
                    </div>
                  )}
                  <div className="font-display font-bold text-sm">{badge.label}</div>
                </div>
              </div>
            )}
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
