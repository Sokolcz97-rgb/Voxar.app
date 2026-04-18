
CREATE TABLE public.pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  nav_label TEXT,
  nav_position INTEGER NOT NULL DEFAULT 100,
  is_published BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  draft_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_pages_slug ON public.pages(slug);
CREATE INDEX idx_pages_published ON public.pages(is_published) WHERE is_published = true;

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published pages viewable by everyone"
ON public.pages FOR SELECT
USING (is_published = true OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors can insert pages"
ON public.pages FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors can update pages"
ON public.pages FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Editors can delete non-system pages"
ON public.pages FOR DELETE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role))
  AND is_system = false
);

CREATE TRIGGER update_pages_updated_at
BEFORE UPDATE ON public.pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed homepage as system page
INSERT INTO public.pages (slug, title, nav_label, nav_position, is_published, is_system, draft_blocks, published_blocks, published_at)
VALUES (
  'home',
  'NEONHUB — Herní komunita',
  NULL,
  0,
  true,
  true,
  '[]'::jsonb,
  '[]'::jsonb,
  now()
);
