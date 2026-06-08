
-- Restrict reading the in-progress draft_blocks column to editors only.
REVOKE SELECT (draft_blocks) ON public.pages FROM anon;
REVOKE SELECT (draft_blocks) ON public.pages FROM authenticated;

-- Editors fetch draft content through a security-definer RPC that checks permission.
CREATE OR REPLACE FUNCTION public.get_page_draft_blocks(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _blocks jsonb;
BEGIN
  IF NOT public.can('pages', 'view_drafts') THEN
    RAISE EXCEPTION 'Not authorized to view drafts';
  END IF;
  SELECT draft_blocks INTO _blocks FROM public.pages WHERE slug = _slug;
  RETURN _blocks;
END;
$$;

REVOKE ALL ON FUNCTION public.get_page_draft_blocks(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_page_draft_blocks(text) TO authenticated;
