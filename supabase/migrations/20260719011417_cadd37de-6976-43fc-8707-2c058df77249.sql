
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.vox_channel_type AS ENUM ('text','voice');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vox_member_role AS ENUM ('owner','mod','member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.vox_presence_status AS ENUM ('online','idle','dnd','offline');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ GUILDS ============
CREATE TABLE public.vox_guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_url text,
  owner_id uuid NOT NULL,
  invite_code text NOT NULL UNIQUE DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_guilds TO authenticated;
GRANT ALL ON public.vox_guilds TO service_role;
ALTER TABLE public.vox_guilds ENABLE ROW LEVEL SECURITY;

-- ============ MEMBERS ============
CREATE TABLE public.vox_guild_members (
  guild_id uuid NOT NULL REFERENCES public.vox_guilds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nickname text,
  role public.vox_member_role NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_guild_members TO authenticated;
GRANT ALL ON public.vox_guild_members TO service_role;
ALTER TABLE public.vox_guild_members ENABLE ROW LEVEL SECURITY;

-- security-definer helper to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_vox_member(_guild uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.vox_guild_members WHERE guild_id = _guild AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.vox_member_role(_guild uuid, _user uuid)
RETURNS public.vox_member_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.vox_guild_members WHERE guild_id = _guild AND user_id = _user;
$$;

-- ============ CHANNELS ============
CREATE TABLE public.vox_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.vox_guilds(id) ON DELETE CASCADE,
  name text NOT NULL,
  type public.vox_channel_type NOT NULL DEFAULT 'text',
  category text,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vox_channels_guild_idx ON public.vox_channels(guild_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_channels TO authenticated;
GRANT ALL ON public.vox_channels TO service_role;
ALTER TABLE public.vox_channels ENABLE ROW LEVEL SECURITY;

-- ============ MESSAGES ============
CREATE TABLE public.vox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.vox_channels(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX vox_messages_channel_created_idx ON public.vox_messages(channel_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_messages TO authenticated;
GRANT ALL ON public.vox_messages TO service_role;
ALTER TABLE public.vox_messages ENABLE ROW LEVEL SECURITY;

-- ============ VOICE PARTICIPANTS ============
CREATE TABLE public.vox_voice_participants (
  channel_id uuid NOT NULL REFERENCES public.vox_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  is_muted boolean NOT NULL DEFAULT false,
  is_deafened boolean NOT NULL DEFAULT false,
  PRIMARY KEY (channel_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_voice_participants TO authenticated;
GRANT ALL ON public.vox_voice_participants TO service_role;
ALTER TABLE public.vox_voice_participants ENABLE ROW LEVEL SECURITY;

-- ============ PRESENCE ============
CREATE TABLE public.vox_presence (
  user_id uuid PRIMARY KEY,
  status public.vox_presence_status NOT NULL DEFAULT 'online',
  custom_status text,
  last_seen timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_presence TO authenticated;
GRANT ALL ON public.vox_presence TO service_role;
ALTER TABLE public.vox_presence ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============

-- guilds: members see; owner edits/deletes; anyone auth creates own
CREATE POLICY "vox_guilds_select_members" ON public.vox_guilds FOR SELECT TO authenticated
  USING (public.is_vox_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY "vox_guilds_insert_self" ON public.vox_guilds FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "vox_guilds_update_owner" ON public.vox_guilds FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "vox_guilds_delete_owner" ON public.vox_guilds FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- members: members see co-members; user can insert self (join by code handled via edge or explicit); owner/mod manage
CREATE POLICY "vox_members_select" ON public.vox_guild_members FOR SELECT TO authenticated
  USING (public.is_vox_member(guild_id, auth.uid()));
CREATE POLICY "vox_members_insert_self" ON public.vox_guild_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "vox_members_update_admin" ON public.vox_guild_members FOR UPDATE TO authenticated
  USING (public.vox_member_role(guild_id, auth.uid()) IN ('owner','mod') OR user_id = auth.uid())
  WITH CHECK (public.vox_member_role(guild_id, auth.uid()) IN ('owner','mod') OR user_id = auth.uid());
CREATE POLICY "vox_members_delete_admin_or_self" ON public.vox_guild_members FOR DELETE TO authenticated
  USING (public.vox_member_role(guild_id, auth.uid()) IN ('owner','mod') OR user_id = auth.uid());

-- channels: members see; owner/mod manage
CREATE POLICY "vox_channels_select" ON public.vox_channels FOR SELECT TO authenticated
  USING (public.is_vox_member(guild_id, auth.uid()));
CREATE POLICY "vox_channels_write_admin" ON public.vox_channels FOR INSERT TO authenticated
  WITH CHECK (public.vox_member_role(guild_id, auth.uid()) IN ('owner','mod'));
CREATE POLICY "vox_channels_update_admin" ON public.vox_channels FOR UPDATE TO authenticated
  USING (public.vox_member_role(guild_id, auth.uid()) IN ('owner','mod'))
  WITH CHECK (public.vox_member_role(guild_id, auth.uid()) IN ('owner','mod'));
CREATE POLICY "vox_channels_delete_admin" ON public.vox_channels FOR DELETE TO authenticated
  USING (public.vox_member_role(guild_id, auth.uid()) IN ('owner','mod'));

-- messages helper
CREATE OR REPLACE FUNCTION public.vox_channel_guild(_channel uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT guild_id FROM public.vox_channels WHERE id = _channel;
$$;

CREATE POLICY "vox_messages_select" ON public.vox_messages FOR SELECT TO authenticated
  USING (public.is_vox_member(public.vox_channel_guild(channel_id), auth.uid()));
CREATE POLICY "vox_messages_insert" ON public.vox_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.is_vox_member(public.vox_channel_guild(channel_id), auth.uid()));
CREATE POLICY "vox_messages_update_author" ON public.vox_messages FOR UPDATE TO authenticated
  USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "vox_messages_delete_author_or_admin" ON public.vox_messages FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.vox_member_role(public.vox_channel_guild(channel_id), auth.uid()) IN ('owner','mod'));

-- voice participants
CREATE POLICY "vox_voice_select" ON public.vox_voice_participants FOR SELECT TO authenticated
  USING (public.is_vox_member(public.vox_channel_guild(channel_id), auth.uid()));
CREATE POLICY "vox_voice_insert_self" ON public.vox_voice_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_vox_member(public.vox_channel_guild(channel_id), auth.uid()));
CREATE POLICY "vox_voice_update_self" ON public.vox_voice_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "vox_voice_delete_self_or_admin" ON public.vox_voice_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.vox_member_role(public.vox_channel_guild(channel_id), auth.uid()) IN ('owner','mod'));

-- presence: authenticated users can read all; write only own
CREATE POLICY "vox_presence_select_all" ON public.vox_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "vox_presence_upsert_self_ins" ON public.vox_presence FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "vox_presence_upsert_self_upd" ON public.vox_presence FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ TRIGGERS ============
CREATE TRIGGER vox_guilds_updated BEFORE UPDATE ON public.vox_guilds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- auto-add owner as member + default channels
CREATE OR REPLACE FUNCTION public.vox_after_guild_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.vox_guild_members (guild_id, user_id, role) VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT DO NOTHING;
  INSERT INTO public.vox_channels (guild_id, name, type, category, position) VALUES
    (NEW.id, 'obecné', 'text', 'Textové kanály', 0),
    (NEW.id, 'General', 'voice', 'Hlasové kanály', 1);
  RETURN NEW;
END $$;
CREATE TRIGGER vox_guilds_after_insert AFTER INSERT ON public.vox_guilds
  FOR EACH ROW EXECUTE FUNCTION public.vox_after_guild_insert();

-- join by invite RPC (bypasses need for guild lookup before insert)
CREATE OR REPLACE FUNCTION public.vox_join_by_invite(_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _guild uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO _guild FROM public.vox_guilds WHERE invite_code = _code;
  IF _guild IS NULL THEN RAISE EXCEPTION 'Neplatný kód'; END IF;
  INSERT INTO public.vox_guild_members (guild_id, user_id, role) VALUES (_guild, auth.uid(), 'member')
    ON CONFLICT DO NOTHING;
  RETURN _guild;
END $$;
GRANT EXECUTE ON FUNCTION public.vox_join_by_invite(text) TO authenticated;

-- presence heartbeat RPC
CREATE OR REPLACE FUNCTION public.vox_heartbeat(_status public.vox_presence_status DEFAULT 'online', _custom text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO public.vox_presence (user_id, status, custom_status, last_seen)
    VALUES (auth.uid(), _status, _custom, now())
    ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status, custom_status = EXCLUDED.custom_status, last_seen = now();
END $$;
GRANT EXECUTE ON FUNCTION public.vox_heartbeat(public.vox_presence_status, text) TO authenticated;

-- ============ REALTIME ============
ALTER TABLE public.vox_messages REPLICA IDENTITY FULL;
ALTER TABLE public.vox_voice_participants REPLICA IDENTITY FULL;
ALTER TABLE public.vox_presence REPLICA IDENTITY FULL;
ALTER TABLE public.vox_channels REPLICA IDENTITY FULL;
ALTER TABLE public.vox_guild_members REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vox_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vox_voice_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vox_presence;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vox_channels;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vox_guild_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
