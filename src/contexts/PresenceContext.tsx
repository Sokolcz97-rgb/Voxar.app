import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PRESENCE_CHANNEL = "presence:online-users";

interface PresenceContextValue {
  onlineIds: Set<string>;
  isOnline: (userId: string | null | undefined) => boolean;
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineIds: new Set(),
  isOnline: () => false,
});

export const PresenceProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setOnlineIds(new Set());
      return;
    }

    const channel = supabase.channel(PRESENCE_CHANNEL, {
      config: { presence: { key: user.id } },
    });

    const sync = () => {
      const state = channel.presenceState<{ user_id: string }>();
      const ids = new Set<string>();
      Object.values(state)
        .flat()
        .forEach((p) => p.user_id && ids.add(p.user_id));
      setOnlineIds(ids);
    };

    const heartbeat = () => {
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .then(() => {});
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
          heartbeat();
        }
      });

    // periodic heartbeat every 60s + on tab close
    const interval = window.setInterval(heartbeat, 60_000);
    const onBeforeUnload = () => heartbeat();
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("beforeunload", onBeforeUnload);
      heartbeat();
      supabase.removeChannel(channel);
    };
  }, [user]);

  const value = useMemo<PresenceContextValue>(
    () => ({
      onlineIds,
      isOnline: (id) => (id ? onlineIds.has(id) : false),
    }),
    [onlineIds],
  );

  return <PresenceContext.Provider value={value}>{children}</PresenceContext.Provider>;
};

export const usePresence = () => useContext(PresenceContext);
