import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { playBeep, showNotification, ensureNotificationPermission } from "@/lib/notify";

export function useNotifications() {
  const { user, isAdmin, isEditor } = useAuth();
  const { t } = useTranslation();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const isStaff = isAdmin || isEditor;
  const myConvIds = useRef<Set<string>>(new Set());
  const prefs = useRef<{ sound: boolean; browser: boolean }>({ sound: true, browser: true });

  const loadConvs = async (uid: string) => {
    const { data: convs } = await supabase
      .from("conversations").select("id")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`);
    myConvIds.current = new Set((convs ?? []).map((c) => c.id));
  };

  const loadMessages = async (uid: string) => {
    const ids = Array.from(myConvIds.current);
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
      myConvIds.current = new Set();
      return;
    }
    ensureNotificationPermission();
    (async () => {
      const { data: prof } = await supabase.rpc("get_my_notification_prefs");
      const row = Array.isArray(prof) ? prof[0] : null;
      prefs.current = {
        sound: row?.notify_sound ?? true,
        browser: row?.notify_browser ?? true,
      };
      await loadConvs(user.id);
      await loadMessages(user.id);
      await loadTickets(user.id, isStaff);
    })();

    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const msg = payload.new as { conversation_id: string; sender_id: string; content: string };
          if (!myConvIds.current.has(msg.conversation_id)) {
            // could be a brand-new conversation — refresh
            await loadConvs(user.id);
            if (!myConvIds.current.has(msg.conversation_id)) return;
          }
          if (msg.sender_id === user.id) return;
          loadMessages(user.id);
          // Get sender name
          const { data: prof } = await supabase
            .from("profiles").select("display_name, username")
            .eq("user_id", msg.sender_id).maybeSingle();
          const name = prof?.display_name || prof?.username || t("common.player");
          if (prefs.current.sound) playBeep();
          if (prefs.current.browser) {
            showNotification(
              `${t("nav.messages")} — ${name}`,
              msg.content.slice(0, 140),
              () => { window.location.href = `/messages?with=${msg.sender_id}`; }
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => loadMessages(user.id)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => loadTickets(user.id, isStaff)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => loadConvs(user.id)
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isStaff]);

  return { unreadMessages, openTickets };
}

