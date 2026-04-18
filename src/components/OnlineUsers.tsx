import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import { Users } from "lucide-react";

type OnlineUser = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

const PRESENCE_CHANNEL = "presence:online-users";

export const OnlineUsers = ({ currentUserId }: { currentUserId: string }) => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<OnlineUser[]>([]);

  useEffect(() => {
    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: currentUserId } },
    });

    const refresh = async () => {
      const state = channel.presenceState<{ user_id: string }>();
      const ids = Array.from(
        new Set(
          Object.values(state)
            .flat()
            .map((p) => p.user_id)
            .filter(Boolean),
        ),
      );
      if (ids.length === 0) {
        setUsers([]);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("user_id,display_name,username,avatar_url")
        .in("user_id", ids);
      setUsers((data as OnlineUser[]) ?? []);
    };

    channel
      .on("presence", { event: "sync" }, refresh)
      .on("presence", { event: "join" }, refresh)
      .on("presence", { event: "leave" }, refresh)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: currentUserId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return (
    <Card className="glass border-border p-6 mb-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {t("dashboard.online")}
          <span className="text-sm font-normal text-muted-foreground">({users.length})</span>
        </h3>
      </div>

      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("dashboard.noOnline")}</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {users.map((u) => {
            const name = u.display_name || u.username || t("common.player");
            const isMe = u.user_id === currentUserId;
            const content = (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 hover:border-primary/50 transition-colors bg-card/40">
                <div className="relative">
                  <UserAvatar
                    src={u.avatar_url}
                    name={name}
                    size="sm"
                  />
                  <span
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background"
                    aria-hidden
                  />
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
