
-- Ensure role tables are in realtime publication and all vox tables send full row payloads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='vox_roles') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.vox_roles';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='vox_member_roles') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.vox_member_roles';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='vox_guild_bans') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.vox_guild_bans';
  END IF;
END $$;

ALTER TABLE public.vox_guild_members REPLICA IDENTITY FULL;
ALTER TABLE public.vox_channels REPLICA IDENTITY FULL;
ALTER TABLE public.vox_messages REPLICA IDENTITY FULL;
ALTER TABLE public.vox_presence REPLICA IDENTITY FULL;
ALTER TABLE public.vox_voice_participants REPLICA IDENTITY FULL;
ALTER TABLE public.vox_roles REPLICA IDENTITY FULL;
ALTER TABLE public.vox_member_roles REPLICA IDENTITY FULL;
ALTER TABLE public.vox_guild_bans REPLICA IDENTITY FULL;
