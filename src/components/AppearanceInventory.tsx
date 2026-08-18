import { useAuth } from "@/contexts/AuthContext";
import { useCosmetics } from "@/contexts/CosmeticsContext";
import { getCosmetic } from "@/lib/cosmetics";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/UserAvatar";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function AppearanceInventory({ avatarUrl, name }: { avatarUrl?: string | null; name?: string | null }) {
  const { user } = useAuth();
  const { myItems, loadingMine, setEquipped } = useCosmetics();

  const toggle = async (cosmeticId: string, equipped: boolean) => {
    await setEquipped(cosmeticId, equipped);
    toast({ title: equipped ? "Rámeček nasazen" : "Rámeček sundán" });
  };

  return (
    <div>
      <h3 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" /> Vzhledy
      </h3>
      <p className="text-xs text-muted-foreground mb-5">
        Kosmetické rámečky avataru. Vlastníš je natrvalo — můžeš je nasadit i sundat kdykoliv.
      </p>

      {loadingMine ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : myItems.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Zatím nevlastníš žádné rámečky. Získáš je jako odměnu od administrátora.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {myItems.map((item) => {
            const def = getCosmetic(item.cosmetic_id);
            if (!def) return null;
            return (
              <Card key={item.id} className="glass border-border p-5 flex gap-4 items-center">
                <UserAvatar
                  url={avatarUrl}
                  name={name}
                  cosmeticId={def.id}
                  className="h-16 w-16"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold">{def.name}</span>
                    <Badge variant="secondary">x{item.quantity}</Badge>
                    {item.equipped && <Badge className="bg-primary/20 text-primary">Nasazeno</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{def.description}</p>
                  <Button
                    size="sm"
                    variant={item.equipped ? "outline" : "default"}
                    className="mt-3"
                    disabled={!user}
                    onClick={() => toggle(def.id, !item.equipped)}
                  >
                    {item.equipped ? "Sundat" : "Nasadit"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
