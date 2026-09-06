import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type VoxNotification = {
  id: string;
  user_id: string;
  guild_id: string | null;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};

const db = supabase as any;

export function useVoxNotifications(limit = 100) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<VoxNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: loadError } = await db
        .from("vox_notifications")
        .select("id,user_id,guild_id,type,title,body,data,is_read,created_at,read_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (loadError) throw loadError;
      setNotifications((data ?? []) as VoxNotification[]);
    } catch (err) {
      setError((err as Error).message || "Oznámení se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, [user, limit]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`vox_notifications_${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_notifications", filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, load]);

  const markRead = useCallback(async (id: string, read = true) => {
    if (!user) return;
    const { error: updateError } = await db
      .from("vox_notifications")
      .update({ is_read: read, read_at: read ? new Date().toISOString() : null })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updateError) throw updateError;
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, is_read: read, read_at: read ? new Date().toISOString() : null } : item));
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    const { error: updateError } = await db
      .from("vox_notifications")
      .update({ is_read: true, read_at: now })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (updateError) throw updateError;
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true, read_at: item.read_at || now })));
  }, [user]);

  const remove = useCallback(async (id: string) => {
    if (!user) return;
    const { error: deleteError } = await db.from("vox_notifications").delete().eq("id", id).eq("user_id", user.id);
    if (deleteError) throw deleteError;
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.is_read).length, [notifications]);

  return { notifications, unreadCount, loading, error, refresh: load, markRead, markAllRead, remove };
}
