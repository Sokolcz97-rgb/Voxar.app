
CREATE TABLE public.game_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  igdb_id bigint UNIQUE NOT NULL,
  name text NOT NULL,
  slug text,
  summary text,
  cover_url text,
  release_date timestamptz,
  release_human text,
  platforms text[] NOT NULL DEFAULT '{}',
  genres text[] NOT NULL DEFAULT '{}',
  hype integer DEFAULT 0,
  url text,
  is_released boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_game_releases_release_date ON public.game_releases(release_date);
CREATE INDEX idx_game_releases_genres ON public.game_releases USING gin(genres);
CREATE INDEX idx_game_releases_platforms ON public.game_releases USING gin(platforms);

ALTER TABLE public.game_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Game releases public view"
  ON public.game_releases FOR SELECT
  USING (true);

CREATE TRIGGER trg_game_releases_updated_at
  BEFORE UPDATE ON public.game_releases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
