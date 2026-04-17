import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TStatus = "open" | "in_progress" | "resolved" | "closed";
export type TPriority = "low" | "medium" | "high" | "urgent";

const statusStyles: Record<TStatus, string> = {
  open: "bg-primary/15 text-primary border-primary/40",
  in_progress: "bg-accent/15 text-accent border-accent/40",
  resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  closed: "bg-muted text-muted-foreground border-border",
};

const priorityStyles: Record<TPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-primary/10 text-primary border-primary/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/40",
  urgent: "bg-destructive/15 text-destructive border-destructive/50",
};

export function StatusBadge({ status }: { status: TStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn("uppercase tracking-widest text-[10px]", statusStyles[status])}>
      {t(`tickets.status.${status}`)}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TPriority }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn("uppercase tracking-widest text-[10px]", priorityStyles[priority])}>
      {t(`tickets.priorities.${priority}`)}
    </Badge>
  );
}
