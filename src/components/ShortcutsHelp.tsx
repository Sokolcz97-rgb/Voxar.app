import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

const Kbd = ({ children }: { children: React.ReactNode }) => (
  <kbd className="pointer-events-none inline-flex h-6 min-w-[1.5rem] select-none items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-foreground">
    {children}
  </kbd>
);

const Row = ({ keys, label }: { keys: React.ReactNode; label: string }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-sm text-muted-foreground">{label}</span>
    <div className="flex items-center gap-1">{keys}</div>
  </div>
);

export const ShortcutsHelp = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("shortcuts:open", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("shortcuts:open", onOpenEvent);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            {t("shortcuts.title")}
          </DialogTitle>
          <DialogDescription>{t("shortcuts.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {t("shortcuts.global")}
            </div>
            <Row
              keys={
                <>
                  <Kbd>⌘</Kbd>
                  <span className="text-muted-foreground">/</span>
                  <Kbd>Ctrl</Kbd>
                  <span className="text-muted-foreground">+</span>
                  <Kbd>K</Kbd>
                </>
              }
              label={t("shortcuts.openSearch")}
            />
            <Row keys={<Kbd>?</Kbd>} label={t("shortcuts.openHelp")} />
            <Row keys={<Kbd>Esc</Kbd>} label={t("shortcuts.closeDialog")} />
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {t("shortcuts.navigate")}
            </div>
            {[
              { k: "H", label: t("shortcuts.goHome") },
              { k: "F", label: t("shortcuts.goForum") },
              { k: "D", label: t("shortcuts.goDashboard") },
              { k: "M", label: t("shortcuts.goMessages") },
              { k: "T", label: t("shortcuts.goTickets") },
              { k: "P", label: t("shortcuts.goProfile") },
            ].map(({ k, label }) => (
              <Row
                key={k}
                keys={
                  <>
                    <Kbd>G</Kbd>
                    <span className="text-muted-foreground">→</span>
                    <Kbd>{k}</Kbd>
                  </>
                }
                label={label}
              />
            ))}
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              {t("shortcuts.searchPrefixes")}
            </div>
            <Row keys={<Kbd>@</Kbd>} label={t("shortcuts.prefixUsers")} />
            <Row keys={<Kbd>#</Kbd>} label={t("shortcuts.prefixThreads")} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
