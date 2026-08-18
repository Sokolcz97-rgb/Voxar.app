import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import { Users } from "lucide-react";
import { usePresence } from "@/contexts/PresenceContext";
import { PresenceDot } from "@/components/PresenceDot";

type Profile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export const OnlineUsers = ({ currentUserId }: { currentUserId: string }) => {
  const { t } = useTranslation();
  const { onlineIds } = usePresence();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    const ids = Array.from(onlineIds);
    if (ids.length === 0) {
      setProfiles([]);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("user_id,display_name,username,avatar_url")
      .in("user_id", ids)
      .then(({ data }) => {
        if (!cancelled) setProfiles((data as Profile[]) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [onlineIds]);

  return (
    <Card className="glass border-border p-6 mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {t("dashboard.online")}
          <span className="text-sm font-normal text-muted-foreground">({profiles.length})</span>
        </h3>
      </div>

      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("dashboard.noOnline")}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {profiles.map((u) => {
            const name = u.display_name || u.username || t("common.player");
            const isMe = u.user_id === currentUserId;
            const content = (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 hover:border-primary/50 transition-colors bg-card/40">
                <div className="relative">
                  <UserAvatar url={u.avatar_url} name={name} userId={u.user_id} className="h-8 w-8" />
                  <PresenceDot userId={u.user_id} className="absolute -bottom-0.5 -right-0.5" />
                </div>
                <span className="text-sm font-medium">
                  {name}
                  {isMe && <span className="text-muted-foreground ml-1">({t("dashboard.you")})</span>}
                </span>
              </div>
            );
            return (
              <li key={u.user_id}>
                {isMe ? content : <Link to={`/profile/${u.user_id}`}>{content}</Link>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
};
