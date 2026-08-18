import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useUserCosmetic } from "@/contexts/CosmeticsContext";
import { getCosmetic } from "@/lib/cosmetics";

interface Props {
  url?: string | null;
  name?: string | null;
  className?: string;
  /** When provided, an equipped cosmetic border is rendered automatically. */
  userId?: string | null;
  /** Force a cosmetic (e.g. previews in the inventory) */
  cosmeticId?: string | null;
}

export function UserAvatar({ url, name, className, userId, cosmeticId }: Props) {
  const equipped = useUserCosmetic(userId);
  const cosmetic = getCosmetic(cosmeticId ?? equipped);
  const initials = (name || "?").slice(0, 2).toUpperCase();

  const avatar = (
    <Avatar className={cn(!cosmetic && "border border-border", className)}>
      {url && <AvatarImage src={url} alt={name ?? ""} />}
      <AvatarFallback className="bg-primary/10 text-primary text-xs font-display font-bold">
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (!cosmetic) return avatar;

  return <span className={cn("cosmetic-frame", cosmetic.className)}>{avatar}</span>;
}
