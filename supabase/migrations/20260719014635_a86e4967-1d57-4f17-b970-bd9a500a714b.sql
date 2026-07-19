
-- 1) bot_guilds: prevent non-admin owners from forging review fields
CREATE OR REPLACE FUNCTION public.bot_guilds_guard_owner_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  is_staff := public.can('bot','manage') OR public.has_role(auth.uid(), 'admin'::app_role);
  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Non-staff (owner editing own pending claim) may not change review/meta fields.
  IF NEW.status         IS DISTINCT FROM OLD.status
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.notes       IS DISTINCT FROM OLD.notes
     OR NEW.source      IS DISTINCT FROM OLD.source
     OR NEW.member_count IS DISTINCT FROM OLD.member_count
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.owner_discord_id IS DISTINCT FROM OLD.owner_discord_id
     OR NEW.guild_id    IS DISTINCT FROM OLD.guild_id
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.created_at  IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Owners cannot modify review or identity fields on bot_guilds';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_guilds_guard_owner_columns ON public.bot_guilds;
CREATE TRIGGER bot_guilds_guard_owner_columns
  BEFORE UPDATE ON public.bot_guilds
  FOR EACH ROW EXECUTE FUNCTION public.bot_guilds_guard_owner_columns();


-- 2) tickets: restrict which columns a plain ticket owner may change
CREATE OR REPLACE FUNCTION public.tickets_guard_owner_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_staff boolean;
BEGIN
  is_staff := public.can('tickets','manage')
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR (OLD.guild_id IS NOT NULL AND public.is_guild_manager(auth.uid(), OLD.guild_id));
  IF is_staff THEN
    RETURN NEW;
  END IF;

  -- Plain owner: allow only subject / description / category changes.
  IF NEW.status       IS DISTINCT FROM OLD.status
     OR NEW.priority  IS DISTINCT FROM OLD.priority
     OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to
     OR NEW.user_id   IS DISTINCT FROM OLD.user_id
     OR NEW.guild_id  IS DISTINCT FROM OLD.guild_id
     OR NEW.discord_channel_id IS DISTINCT FROM OLD.discord_channel_id
     OR NEW.discord_message_id IS DISTINCT FROM OLD.discord_message_id
     OR NEW.source    IS DISTINCT FROM OLD.source
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only staff can change ticket status, priority, assignment or routing fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_guard_owner_columns ON public.tickets;
CREATE TRIGGER tickets_guard_owner_columns
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_guard_owner_columns();


-- 3) vox_presence: scope visibility to self + users sharing a vox guild
DROP POLICY IF EXISTS vox_presence_select_all ON public.vox_presence;

CREATE POLICY vox_presence_select_shared
  ON public.vox_presence
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.vox_guild_members me
      JOIN public.vox_guild_members them ON them.guild_id = me.guild_id
      WHERE me.user_id = auth.uid()
        AND them.user_id = vox_presence.user_id
    )
  );
