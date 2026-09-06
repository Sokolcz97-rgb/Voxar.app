import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getVoxCommunityContext, subscribeVoxCommunityContext } from "@/lib/voxCommunityBridge";

export type VoxEventRsvpStatus = "going" | "interested" | "declined";

export type VoxCommunityEvent = {
  id: string;
  guild_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  channel_id: string | null;
  cover_url: string | null;
  created_by: string;
  status: "scheduled" | "cancelled";
  capacity: number | null;
  created_at: string;
  updated_at: string;
  rsvp: {
    going: number;
    interested: number;
    declined: number;
  };
  myRsvp: VoxEventRsvpStatus | null;
  attendees: Array<{
    user_id: string;
    status: VoxEventRsvpStatus;
    display_name: string | null;
    avatar_url: string | null;
  }>;
};

export type VoxCommunityEventInput = {
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  channel_id?: string | null;
  cover_url?: string | null;
  capacity?: number | null;
};

const db = supabase as any;

export function useCommunityEvents(guildId?: string | null) {
  const { user } = useAuth();
  const [resolvedGuildId, setResolvedGuildId] = useState<string | null>(() => guildId ?? getVoxCommunityContext().guildId);
  const [events, setEvents] = useState<VoxCommunityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (guildId !== undefined) {
      setResolvedGuildId(guildId ?? null);
      return;
    }
    setResolvedGuildId(getVoxCommunityContext().guildId);
    return subscribeVoxCommunityContext((context) => setResolvedGuildId(context.guildId));
  }, [guildId]);

  const load = useCallback(async () => {
    if (!resolvedGuildId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const lowerBound = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const { data: eventRows, error: eventError } = await db
        .from("vox_events")
        .select("id,guild_id,title,description,starts_at,ends_at,location,channel_id,cover_url,created_by,status,capacity,created_at,updated_at")
        .eq("guild_id", resolvedGuildId)
        .gte("starts_at", lowerBound)
        .order("starts_at", { ascending: true })
        .limit(100);

      if (eventError) throw eventError;
      const rawEvents = (eventRows ?? []) as any[];
      const ids = rawEvents.map((event) => event.id);

      let attendeeRows: any[] = [];
      if (ids.length) {
        const { data, error: attendeeError } = await db
          .from("vox_event_attendees")
          .select("event_id,user_id,status")
          .in("event_id", ids);
        if (attendeeError) throw attendeeError;
        attendeeRows = data ?? [];
      }

      const userIds = Array.from(new Set(attendeeRows.map((row) => row.user_id)));
      let profileRows: any[] = [];
      if (userIds.length) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id,display_name,avatar_url")
          .in("user_id", userIds as string[]);
        profileRows = data ?? [];
      }

      const profiles = Object.fromEntries(profileRows.map((profile) => [profile.user_id, profile]));
      const byEvent: Record<string, any[]> = {};
      attendeeRows.forEach((row) => (byEvent[row.event_id] ||= []).push(row));

      setEvents(rawEvents.map((event) => {
        const attendees = byEvent[event.id] ?? [];
        const rsvp = { going: 0, interested: 0, declined: 0 };
        attendees.forEach((row) => {
          if (row.status in rsvp) rsvp[row.status as VoxEventRsvpStatus] += 1;
        });
        return {
          ...event,
          rsvp,
          myRsvp: (attendees.find((row) => row.user_id === user?.id)?.status ?? null) as VoxEventRsvpStatus | null,
          attendees: attendees.map((row) => ({
            user_id: row.user_id,
            status: row.status as VoxEventRsvpStatus,
            display_name: profiles[row.user_id]?.display_name ?? null,
            avatar_url: profiles[row.user_id]?.avatar_url ?? null,
          })),
        } as VoxCommunityEvent;
      }));
    } catch (err) {
      setError((err as Error).message || "Události se nepodařilo načíst.");
    } finally {
      setLoading(false);
    }
  }, [resolvedGuildId, user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!resolvedGuildId) return;
    const eventChannel = supabase
      .channel(`vox_events_${resolvedGuildId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_events", filter: `guild_id=eq.${resolvedGuildId}` }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "vox_event_attendees" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(eventChannel); };
  }, [resolvedGuildId, load]);

  const createEvent = useCallback(async (input: VoxCommunityEventInput) => {
    if (!resolvedGuildId || !user) throw new Error("Vyber komunitu a přihlas se.");
    const { error: insertError } = await db.from("vox_events").insert({
      guild_id: resolvedGuildId,
      created_by: user.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      starts_at: input.starts_at,
      ends_at: input.ends_at || null,
      location: input.location?.trim() || null,
      channel_id: input.channel_id || null,
      cover_url: input.cover_url?.trim() || null,
      capacity: input.capacity || null,
      status: "scheduled",
    });
    if (insertError) throw insertError;
    await load();
  }, [resolvedGuildId, user, load]);

  const updateEvent = useCallback(async (eventId: string, input: Partial<VoxCommunityEventInput> & { status?: "scheduled" | "cancelled" }) => {
    const patch: Record<string, unknown> = { ...input };
    if (typeof patch.title === "string") patch.title = patch.title.trim();
    if (typeof patch.description === "string") patch.description = patch.description.trim() || null;
    if (typeof patch.location === "string") patch.location = patch.location.trim() || null;
    if (typeof patch.cover_url === "string") patch.cover_url = patch.cover_url.trim() || null;
    const { error: updateError } = await db.from("vox_events").update(patch).eq("id", eventId);
    if (updateError) throw updateError;
    await load();
  }, [load]);

  const deleteEvent = useCallback(async (eventId: string) => {
    const { error: deleteError } = await db.from("vox_events").delete().eq("id", eventId);
    if (deleteError) throw deleteError;
    await load();
  }, [load]);

  const setRsvp = useCallback(async (eventId: string, status: VoxEventRsvpStatus | null) => {
    if (!user) throw new Error("Pro účast se musíš přihlásit.");
    if (!status) {
      const { error: deleteError } = await db
        .from("vox_event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);
      if (deleteError) throw deleteError;
    } else {
      const { error: upsertError } = await db
        .from("vox_event_attendees")
        .upsert({ event_id: eventId, user_id: user.id, status }, { onConflict: "event_id,user_id" });
      if (upsertError) throw upsertError;
    }
    await load();
  }, [user, load]);

  const activeEvents = useMemo(() => events.filter((event) => event.status === "scheduled"), [events]);
  const upcomingEvent = activeEvents[0] ?? null;

  return {
    guildId: resolvedGuildId,
    events,
    activeEvents,
    upcomingEvent,
    loading,
    error,
    refresh: load,
    createEvent,
    updateEvent,
    deleteEvent,
    setRsvp,
  };
}
