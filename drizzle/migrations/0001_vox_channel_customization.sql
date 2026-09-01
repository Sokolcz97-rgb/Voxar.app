ALTER TABLE public.vox_channels
  ADD COLUMN IF NOT EXISTS emoji text,
  ADD COLUMN IF NOT EXISTS topic text;

CREATE TABLE IF NOT EXISTS public.vox_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.vox_guilds(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_categories TO authenticated;
GRANT ALL ON public.vox_categories TO service_role;

ALTER TABLE public.vox_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY vox_categories_select ON public.vox_categories
  FOR SELECT TO authenticated
  USING (is_vox_member(guild_id, auth.uid()));

CREATE POLICY vox_categories_insert ON public.vox_categories
  FOR INSERT TO authenticated
  WITH CHECK (vox_has_perm(guild_id, auth.uid(), 'manage_channels'));

CREATE POLICY vox_categories_update ON public.vox_categories
  FOR UPDATE TO authenticated
  USING (vox_has_perm(guild_id, auth.uid(), 'manage_channels'))
  WITH CHECK (vox_has_perm(guild_id, auth.uid(), 'manage_channels'));

CREATE POLICY vox_categories_delete ON public.vox_categories
  FOR DELETE TO authenticated
  USING (vox_has_perm(guild_id, auth.uid(), 'manage_channels'));