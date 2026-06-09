import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  variant?: "default" | "outline" | "secondary" | "ghost" | "hero" | "destructive" | "link";
  size?: "default" | "sm" | "lg" | "xl" | "icon";

  className?: string;
  label?: string;
}

/**
 * Tlačítko „Přidat bota na svůj Discord".
 * Otevře oficiální Discord OAuth2 invite URL pro tohoto bota.
 * Po přidání bot v `guildCreate` automaticky zapíše guildu do `bot_guilds`
 * se stavem `pending` – funkční bude až po schválení adminem.
 */
export function InviteBotButton({
  variant = "default",
  size = "default",
  className,
  label = "Přidat bota na svůj Discord",
}: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.functions.invoke("bot-invite-info");
      if (cancelled) return;
      if (error || !data?.invite_url) {
        setLoading(false);
        return;
      }
      setUrl(data.invite_url as string);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onClick = () => {
    if (!url) {
      toast.error("Invite URL bota není k dispozici.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    toast.info("Po přidání bota musí být server ještě schválen adminem.", {
      duration: 6000,
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={loading || !url}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Bot className="h-4 w-4 mr-2" />
      )}
      {label}
    </Button>
  );
}
