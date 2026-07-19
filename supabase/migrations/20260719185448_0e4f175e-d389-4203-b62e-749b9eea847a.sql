
-- Bans table
CREATE TABLE public.vox_guild_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.vox_guilds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  reason text,
  banned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_guild_bans TO authenticated;
GRANT ALL ON public.vox_guild_bans TO service_role;

ALTER TABLE public.vox_guild_bans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vox_bans_select" ON public.vox_guild_bans FOR SELECT TO authenticated
  USING (public.vox_has_perm(guild_id, auth.uid(), 'ban_members'));
CREATE POLICY "vox_bans_insert" ON public.vox_guild_bans FOR INSERT TO authenticated
  WITH CHECK (public.vox_has_perm(guild_id, auth.uid(), 'ban_members') AND banned_by = auth.uid());
CREATE POLICY "vox_bans_delete" ON public.vox_guild_bans FOR DELETE TO authenticated
  USING (public.vox_has_perm(guild_id, auth.uid(), 'ban_members'));

-- Mute column
ALTER TABLE public.vox_guild_members ADD COLUMN IF NOT EXISTS muted_until timestamptz;

-- Prevent banned users from joining via invite
CREATE OR REPLACE FUNCTION public.vox_join_by_invite(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _guild uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _guild FROM public.vox_guilds WHERE invite_code = _code;
  IF _guild IS NULL THEN RAISE EXCEPTION 'Neplatný kód'; END IF;
  IF EXISTS (SELECT 1 FROM public.vox_guild_bans WHERE guild_id = _guild AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Byl jste zabanován z tohoto serveru';
  END IF;
  INSERT INTO public.vox_guild_members (guild_id, user_id, role) VALUES (_guild, auth.uid(), 'member')
    ON CONFLICT DO NOTHING;
  RETURN _guild;
END $function$;

-- Enforce mute on message insert via trigger (RLS INSERT policy can't easily reference member row)
CREATE OR REPLACE FUNCTION public.vox_enforce_mute_on_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _guild uuid; _muted timestamptz;
BEGIN
  _guild := public.vox_channel_guild(NEW.channel_id);
  SELECT muted_until INTO _muted FROM public.vox_guild_members WHERE guild_id = _guild AND user_id = NEW.author_id;
  IF _muted IS NOT NULL AND _muted > now() THEN
    RAISE EXCEPTION 'Jste umlčeni do %', _muted;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS vox_messages_mute_check ON public.vox_messages;
CREATE TRIGGER vox_messages_mute_check BEFORE INSERT ON public.vox_messages
  FOR EACH ROW EXECUTE FUNCTION public.vox_enforce_mute_on_message();

-- Moderation RPCs
CREATE OR REPLACE FUNCTION public.vox_kick_member(_guild uuid, _user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.vox_has_perm(_guild, auth.uid(), 'kick_members') THEN
    RAISE EXCEPTION 'Nemáte oprávnění vyhodit členy';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vox_guilds WHERE id = _guild AND owner_id = _user) THEN
    RAISE EXCEPTION 'Nelze vyhodit majitele serveru';
  END IF;
  DELETE FROM public.vox_guild_members WHERE guild_id = _guild AND user_id = _user;
END $$;

CREATE OR REPLACE FUNCTION public.vox_ban_member(_guild uuid, _user uuid, _reason text DEFAULT NULL)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.vox_has_perm(_guild, auth.uid(), 'ban_members') THEN
    RAISE EXCEPTION 'Nemáte oprávnění banovat členy';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vox_guilds WHERE id = _guild AND owner_id = _user) THEN
    RAISE EXCEPTION 'Nelze zabanovat majitele serveru';
  END IF;
  INSERT INTO public.vox_guild_bans (guild_id, user_id, reason, banned_by)
    VALUES (_guild, _user, _reason, auth.uid())
    ON CONFLICT (guild_id, user_id) DO UPDATE SET reason = EXCLUDED.reason, banned_by = auth.uid(), created_at = now();
  DELETE FROM public.vox_guild_members WHERE guild_id = _guild AND user_id = _user;
END $$;

CREATE OR REPLACE FUNCTION public.vox_unban_member(_guild uuid, _user uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.vox_has_perm(_guild, auth.uid(), 'ban_members') THEN
    RAISE EXCEPTION 'Nemáte oprávnění';
  END IF;
  DELETE FROM public.vox_guild_bans WHERE guild_id = _guild AND user_id = _user;
END $$;

CREATE OR REPLACE FUNCTION public.vox_mute_member(_guild uuid, _user uuid, _minutes integer)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.vox_has_perm(_guild, auth.uid(), 'manage_messages') THEN
    RAISE EXCEPTION 'Nemáte oprávnění umlčovat';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vox_guilds WHERE id = _guild AND owner_id = _user) THEN
    RAISE EXCEPTION 'Nelze umlčet majitele serveru';
  END IF;
  UPDATE public.vox_guild_members
    SET muted_until = CASE WHEN _minutes IS NULL OR _minutes <= 0 THEN NULL ELSE now() + make_interval(mins => _minutes) END
    WHERE guild_id = _guild AND user_id = _user;
END $$;
