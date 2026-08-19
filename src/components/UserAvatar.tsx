import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useUserCosmetic } from "@/contexts/CosmeticsContext";
import { getCosmetic } from "@/lib/cosmetics";
import { useCosmeticStyle } from "@/hooks/useCosmeticStyles";
import vipFrame from "@/assets/vip-supporter-frame.png.asset.json";



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

  if (cosmetic.id === "supporter_gold") {
    // The VIP emblem is scaled to 135% so the decorative border is visible but
    // does not overlap adjacent nicknames/text in tight user lists. The transparent
    // centre hole still reveals the avatar's face through it.
    return (
      <span className="relative inline-flex shrink-0 isolate">
        <span className="relative z-0 rounded-full overflow-hidden">{avatar}</span>
        <img
          src={vipFrame.url}
          alt=""
          aria-hidden
          draggable={false}
          className="pointer-events-none absolute z-10 max-w-none select-none"
          style={{
            width: "135%",
            height: "135%",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      </span>
    );
  }

  return <span className={cn("cosmetic-frame", cosmetic.className)}>{avatar}</span>;

}
