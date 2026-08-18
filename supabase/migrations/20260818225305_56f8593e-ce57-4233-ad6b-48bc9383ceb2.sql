ALTER TABLE public.vox_guilds ADD COLUMN IF NOT EXISTS cosmetic_id text;

CREATE OR REPLACE FUNCTION public.vox_set_guild_cosmetic(_guild uuid, _cosmetic text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_vox_member(_guild, auth.uid()) THEN
    RAISE EXCEPTION 'Nejste členem tohoto serveru';
  END IF;
  IF _cosmetic IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_cosmetics uc
      WHERE uc.user_id = auth.uid() AND uc.cosmetic_id = _cosmetic AND uc.quantity > 0
    ) THEN
      RAISE EXCEPTION 'Tento rámeček nevlastníte';
    END IF;
  END IF;
  UPDATE public.vox_guilds SET cosmetic_id = _cosmetic WHERE id = _guild;
END;
$$;