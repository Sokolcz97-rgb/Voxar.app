ALTER TABLE public.forum_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.forum_categories(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS forum_categories_parent_id_idx ON public.forum_categories(parent_id);

CREATE OR REPLACE FUNCTION public.forum_categories_depth_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Kategorie nemůže být sama sobě nadřazená';
    END IF;
    IF EXISTS (SELECT 1 FROM public.forum_categories c WHERE c.id = NEW.parent_id AND c.parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Podporována je pouze jedna úroveň podkategorií';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS forum_categories_depth_guard ON public.forum_categories;
CREATE TRIGGER forum_categories_depth_guard
BEFORE INSERT OR UPDATE ON public.forum_categories
FOR EACH ROW EXECUTE FUNCTION public.forum_categories_depth_guard();