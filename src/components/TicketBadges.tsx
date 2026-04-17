import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TStatus = "open" | "in_progress" | "resolved" | "closed";
export type TPriority = "low" | "medium" | "high" | "urgent";

export const statusLabel: Record<TStatus, string> = {
  open: "Otevřený",
  in_progress: "Řeší se",
  resolved: "Vyřešený",
  closed: "Uzavřený",
};

export const priorityLabel: Record<TPriority, string> = {
  low: "Nízká",
  medium: "Střední",
  high: "Vysoká",
  urgent: "Urgentní",
};

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
  return (
    <Badge variant="outline" className={cn("uppercase tracking-widest text-[10px]", statusStyles[status])}>
      {statusLabel[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TPriority }) {
  return (
    <Badge variant="outline" className={cn("uppercase tracking-widest text-[10px]", priorityStyles[priority])}>
      {priorityLabel[priority]}
    </Badge>
  );
}
