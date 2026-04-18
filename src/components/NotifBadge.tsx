import { cn } from "@/lib/utils";

interface Props {
  count: number;
  className?: string;
}

export function NotifBadge({ count, className }: Props) {
  if (!count) return null;
  return (
    <span
      className={cn(
        "absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full",
        "bg-destructive text-destructive-foreground text-[10px] font-bold",
        "flex items-center justify-center border border-background",
        "shadow-[0_0_8px_hsl(var(--destructive)/0.6)]",
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
