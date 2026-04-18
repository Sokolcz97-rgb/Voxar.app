import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useNotifications() {
  const { user, isAdmin, isEditor } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const isStaff = isAdmin || isEditor;

  const loadMessages = async (uid: string) => {
    // get my conversations
    const { data: convs } = await supabase
      .from("conversations").select("id")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`);
    const ids = (convs ?? []).map((c) => c.id);
    if (!ids.length) { setUnreadMessages(0); return; }
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", ids)
      .neq("sender_id", uid)
      .is("read_at", null);
    setUnreadMessages(count ?? 0);
  };

  const loadTickets = async (uid: string, staff: boolean) => {
    let q = supabase.from("tickets").select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"]);
    if (!staff) q = q.eq("user_id", uid);
    const { count } = await q;
    setOpenTickets(count ?? 0);
  };

  useEffect(() => {
    if (!user) {
      setUnreadMessages(0);
      setOpenTickets(0);
      return;
    }
    loadMessages(user.id);
    loadTickets(user.id, isStaff);

    const ch = supabase
      .channel(`notif-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        loadMessages(user.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        loadTickets(user.id, isStaff);
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user, isStaff]);

  return { unreadMessages, openTickets };
}
