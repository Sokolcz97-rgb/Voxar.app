import { cn } from "@/lib/utils";
import { usePresence } from "@/contexts/PresenceContext";

interface Props {
  userId?: string | null;
  className?: string;
  /** Render even when user is offline (as gray dot). Default false → hidden when offline. */
  showOffline?: boolean;
}

export const PresenceDot = ({ userId, className, showOffline = false }: Props) => {
  const { isOnline } = usePresence();
  const online = isOnline(userId);
  if (!online && !showOffline) return null;
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background",
        online ? "bg-primary shadow-[0_0_8px_hsl(var(--primary))]" : "bg-muted-foreground/40",
        className,
      )}
      aria-label={online ? "online" : "offline"}
    />
  );
};
