CREATE TABLE public.app_access_ips (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  user_id uuid,
  code_id uuid references public.download_access_codes(id) on delete set null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

CREATE UNIQUE INDEX app_access_ips_ip_key ON public.app_access_ips (ip);

GRANT ALL ON public.app_access_ips TO service_role;

ALTER TABLE public.app_access_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view access ips"
ON public.app_access_ips FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete access ips"
ON public.app_access_ips FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, DELETE ON public.app_access_ips TO authenticated;