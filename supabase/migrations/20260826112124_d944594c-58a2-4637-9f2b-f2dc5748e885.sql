ALTER TABLE public.games ADD COLUMN IF NOT EXISTS color_tag text NOT NULL DEFAULT '#22d3ee';

CREATE TABLE public.user_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_games TO authenticated;
GRANT ALL ON public.user_games TO service_role;
ALTER TABLE public.user_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_games_select_auth" ON public.user_games FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_games_insert_own" ON public.user_games FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_games_update_own" ON public.user_games FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_games_delete_own" ON public.user_games FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_user_games_updated_at BEFORE UPDATE ON public.user_games FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lfg_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  note text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lfg_requests TO authenticated;
GRANT ALL ON public.lfg_requests TO service_role;
ALTER TABLE public.lfg_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lfg_select_auth" ON public.lfg_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "lfg_insert_own" ON public.lfg_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lfg_update_own" ON public.lfg_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lfg_delete_own_or_admin" ON public.lfg_requests FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_lfg_requests_updated_at BEFORE UPDATE ON public.lfg_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_lfg_requests_expires ON public.lfg_requests (expires_at DESC);
ALTER TABLE public.lfg_requests REPLICA IDENTITY FULL;