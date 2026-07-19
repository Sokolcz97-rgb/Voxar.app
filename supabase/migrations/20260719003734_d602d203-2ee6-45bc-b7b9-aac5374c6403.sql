
CREATE TABLE public.forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  slug text NOT NULL UNIQUE,
  is_published boolean NOT NULL DEFAULT false,
  allow_anonymous boolean NOT NULL DEFAULT true,
  accent_color text,
  cover_emoji text,
  success_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX forms_owner_idx ON public.forms(owner_id);

CREATE TABLE public.form_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  type text NOT NULL,
  label text NOT NULL,
  description text,
  required boolean NOT NULL DEFAULT false,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX form_fields_form_idx ON public.form_fields(form_id);

CREATE TABLE public.form_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  respondent_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX form_responses_form_idx ON public.form_responses(form_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO authenticated;
GRANT SELECT ON public.forms TO anon;
GRANT ALL ON public.forms TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO authenticated;
GRANT SELECT ON public.form_fields TO anon;
GRANT ALL ON public.form_fields TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_responses TO authenticated;
GRANT INSERT ON public.form_responses TO anon;
GRANT ALL ON public.form_responses TO service_role;

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_responses ENABLE ROW LEVEL SECURITY;

-- forms policies
CREATE POLICY "forms_owner_all" ON public.forms FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "forms_public_read_published" ON public.forms FOR SELECT
  USING (is_published = true);

-- form_fields policies
CREATE POLICY "form_fields_owner_all" ON public.form_fields FOR ALL
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.owner_id = auth.uid()));
CREATE POLICY "form_fields_public_read_published" ON public.form_fields FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.is_published = true));

-- form_responses policies
CREATE POLICY "form_responses_owner_read" ON public.form_responses FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.owner_id = auth.uid()));
CREATE POLICY "form_responses_owner_delete" ON public.form_responses FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.owner_id = auth.uid()));
CREATE POLICY "form_responses_insert_authenticated" ON public.form_responses FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.is_published = true)
    AND (respondent_id IS NULL OR respondent_id = auth.uid())
  );
CREATE POLICY "form_responses_insert_anon" ON public.form_responses FOR INSERT TO anon
  WITH CHECK (
    respondent_id IS NULL
    AND EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_id AND f.is_published = true AND f.allow_anonymous = true)
  );

CREATE TRIGGER forms_set_updated_at BEFORE UPDATE ON public.forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
