-- Connection type enum
DO $$ BEGIN
  CREATE TYPE public.server_connection_type AS ENUM ('ip_port', 'invite_code');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Games catalog
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon_url text,
  connection_type public.server_connection_type NOT NULL DEFAULT 'ip_port',
  steam_appid integer,
  position integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Games viewable by everyone"
  ON public.games FOR SELECT USING (true);

CREATE POLICY "Editors manage games insert"
  ON public.games FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors manage games update"
  ON public.games FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Admins delete games"
  ON public.games FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Servers
CREATE TABLE public.servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  ip text,
  port integer,
  invite_code text,
  website_url text,
  discord_url text,
  is_online boolean NOT NULL DEFAULT false,
  players_online integer,
  players_max integer,
  last_pinged_at timestamptz,
  is_approved boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_servers_game ON public.servers(game_id);
CREATE INDEX idx_servers_owner ON public.servers(owner_id);

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Public sees only approved servers; staff and owners see their own
CREATE POLICY "Approved servers viewable by everyone"
  ON public.servers FOR SELECT
  USING (
    is_approved = true
    OR auth.uid() = owner_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'editor'::app_role)
  );

-- Admin/editor/content_creator can insert; their own servers are auto-approved by trigger
CREATE POLICY "Allowed roles insert servers"
  ON public.servers FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND NOT has_role(auth.uid(), 'banned'::app_role)
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'editor'::app_role)
      OR has_role(auth.uid(), 'content_creator'::app_role)
    )
  );

CREATE POLICY "Owner or staff update servers"
  ON public.servers FOR UPDATE TO authenticated
  USING (
    auth.uid() = owner_id
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'editor'::app_role)
  );

CREATE POLICY "Owner or admin delete servers"
  ON public.servers FOR DELETE TO authenticated
  USING (
    auth.uid() = owner_id
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Auto-approve servers from trusted roles
CREATE OR REPLACE FUNCTION public.auto_approve_server()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(NEW.owner_id, 'admin'::app_role)
     OR has_role(NEW.owner_id, 'editor'::app_role)
     OR has_role(NEW.owner_id, 'content_creator'::app_role) THEN
    NEW.is_approved := true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_approve_server_trigger
  BEFORE INSERT ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.auto_approve_server();

CREATE TRIGGER update_servers_updated_at
  BEFORE UPDATE ON public.servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial games: Windrose (invite) + Hytale (ip_port)
INSERT INTO public.games (slug, name, description, connection_type, position) VALUES
  ('windrose', 'Windrose', 'Připojení přes invite kód', 'invite_code', 10),
  ('hytale', 'Hytale', 'Sandbox RPG od Hypixel Studios', 'ip_port', 20)
ON CONFLICT (slug) DO NOTHING;