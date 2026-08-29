import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? "cs";

  const change = (lng: "cs" | "en") => {
    i18n.changeLanguage(lng);
    document.documentElement.lang = lng;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-1.5 font-mono uppercase tracking-wider text-sm">
          <Languages className="h-4 w-4" />
          {current.toUpperCase()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-md min-w-[8rem]">
        <DropdownMenuItem onClick={() => change("cs")} className={current === "cs" ? "text-primary" : ""}>
          🇨🇿 Čeština
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => change("en")} className={current === "en" ? "text-primary" : ""}>
          🇬🇧 English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
