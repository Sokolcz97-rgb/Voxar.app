import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { RichContent } from "@/components/RichContent";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { autoTranslate, LANG_LABEL, type Lang } from "@/lib/mockTranslate";
import { cn } from "@/lib/utils";

interface Props {
  content: string;
  className?: string;
}

/**
 * Renders message content in the reader's preferred language by default.
 * A cyan HUD globe marks auto-translated messages; clicking it swaps
 * inline back to the original text.
 */
export function TranslatedContent({ content, className }: Props) {
  const { i18n } = useTranslation();
  const target: Lang = i18n.resolvedLanguage === "en" ? "en" : "cs";
  const [showOriginal, setShowOriginal] = useState(false);

  const result = useMemo(() => autoTranslate(content, target), [content, target]);
  const shown = result.translated && !showOriginal ? result.text : content;

  return (
    <div className="relative">
      <RichContent content={shown} className={className} />
      {result.translated && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setShowOriginal((v) => !v)}
                aria-label={showOriginal ? "Zobrazit překlad" : "Zobrazit originál"}
                className={cn(
                  "mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em]",
                  "border border-primary/40 bg-primary/10 text-primary web-cut",
                  "hover:bg-primary/25 hover:shadow-[0_0_14px_-4px_hsl(var(--primary))] transition-all",
                  showOriginal && "border-primary bg-primary/25",
                )}
                style={{ ["--wc" as string]: "6px" }}
              >
                <Globe className="h-3 w-3 animate-pulse" />
                {showOriginal
                  ? `${LANG_LABEL[result.sourceLang ?? target]} · originál`
                  : `Auto ${LANG_LABEL[result.sourceLang ?? target]}→${LANG_LABEL[target]}`}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-[10px] uppercase tracking-widest text-primary mb-1">
                {showOriginal ? "Překlad" : "Originál"}
              </p>
              <p className="text-xs">
                {(showOriginal ? result.text : content).replace(/<[^>]+>/g, " ").trim()}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
