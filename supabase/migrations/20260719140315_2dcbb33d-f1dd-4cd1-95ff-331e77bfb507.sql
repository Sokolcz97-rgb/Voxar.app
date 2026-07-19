
-- 1) Create staff-only review table
CREATE TABLE IF NOT EXISTS public.bot_guilds_review (
  guild_row_id uuid PRIMARY KEY REFERENCES public.bot_guilds(id) ON DELETE CASCADE,
  notes text,
  reviewed_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_guilds_review TO authenticated;
GRANT ALL ON public.bot_guilds_review TO service_role;

ALTER TABLE public.bot_guilds_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read review notes"
  ON public.bot_guilds_review FOR SELECT
  TO authenticated
  USING (public.can('bot','manage') OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff insert review notes"
  ON public.bot_guilds_review FOR INSERT
  TO authenticated
  WITH CHECK (public.can('bot','manage') OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff update review notes"
  ON public.bot_guilds_review FOR UPDATE
  TO authenticated
  USING (public.can('bot','manage') OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.can('bot','manage') OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff delete review notes"
  ON public.bot_guilds_review FOR DELETE
  TO authenticated
  USING (public.can('bot','manage') OR public.has_role(auth.uid(), 'admin'::app_role));

-- 2) Backfill existing notes / reviewed_by from bot_guilds
INSERT INTO public.bot_guilds_review (guild_row_id, notes, reviewed_by, updated_at)
SELECT id, notes, reviewed_by, COALESCE(reviewed_at, now())
FROM public.bot_guilds
WHERE notes IS NOT NULL OR reviewed_by IS NOT NULL
ON CONFLICT (guild_row_id) DO NOTHING;

-- 3) Drop the sensitive columns from bot_guilds so owners can never read them
--    (reviewed_at stays — non-sensitive timestamp)
ALTER TABLE public.bot_guilds DROP COLUMN IF EXISTS notes;
ALTER TABLE public.bot_guilds DROP COLUMN IF EXISTS reviewed_by;

-- 4) Update guard trigger so it no longer references dropped columns
CREATE OR REPLACE FUNCTION public.bot_guilds_guard_owner_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_staff boolean;
BEGIN
  is_staff := public.can('bot','manage') OR public.has_role(auth.uid(), 'admin'::app_role);
  IF is_staff THEN
    RETURN NEW;
  END IF;

  IF NEW.status              IS DISTINCT FROM OLD.status
     OR NEW.reviewed_at      IS DISTINCT FROM OLD.reviewed_at
     OR NEW.source           IS DISTINCT FROM OLD.source
     OR NEW.member_count     IS DISTINCT FROM OLD.member_count
     OR NEW.owner_user_id    IS DISTINCT FROM OLD.owner_user_id
     OR NEW.owner_discord_id IS DISTINCT FROM OLD.owner_discord_id
     OR NEW.guild_id         IS DISTINCT FROM OLD.guild_id
     OR NEW.requested_at     IS DISTINCT FROM OLD.requested_at
     OR NEW.created_at       IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Owners cannot modify review or identity fields on bot_guilds';
  END IF;

  RETURN NEW;
END;
$function$;
