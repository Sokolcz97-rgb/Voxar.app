import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Props {
  url?: string | null;
  name?: string | null;
  className?: string;
}

export function UserAvatar({ url, name, className }: Props) {
  const initials = (name || "?").slice(0, 2).toUpperCase();
  return (
    <Avatar className={cn("border border-border", className)}>
      {url && <AvatarImage src={url} alt={name ?? ""} />}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-display font-bold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
