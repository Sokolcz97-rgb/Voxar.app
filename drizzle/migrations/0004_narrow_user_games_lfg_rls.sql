-- V32: zuzeni RLS (security nalezy: user_games_select_auth, lfg_select_auth USING(true)).
-- user_games nadale slouzi pouze vlastnikovi; pro LFG matching pridava security-definer RPC.
-- lfg_requests: vlastnik + aktivni (nevypršene) vyzvy, ktere musi byt videt na nástěnce.

-- 1) user_games: read jen vlastnik
DROP POLICY IF EXISTS "user_games_select_auth" ON public.user_games;
CREATE POLICY "user_games_select_own" ON public.user_games
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- cross-user matching pro LFG: z kandidatu vrat ty, kdo hraji danou hru
CREATE OR REPLACE FUNCTION public.lfg_players_with_game(_game_id uuid, _candidate_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id
  FROM public.user_games
  WHERE game_id = _game_id
    AND user_id = ANY (_candidate_ids)
$$;

REVOKE ALL ON FUNCTION public.lfg_players_with_game(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lfg_players_with_game(uuid, uuid[]) TO authenticated;

-- 2) lfg_requests: vlastnik + aktivni vyzvy
DROP POLICY IF EXISTS "lfg_select_auth" ON public.lfg_requests;
CREATE POLICY "lfg_select_own_or_active" ON public.lfg_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR expires_at > now());

-- GRANTy (Data API je defaultně nedává)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_games TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lfg_requests TO authenticated;
GRANT ALL ON public.user_games TO service_role;
GRANT ALL ON public.lfg_requests TO service_role;
