DROP POLICY IF EXISTS shop_settings_authenticated_read ON public.shop_settings;
CREATE POLICY "shop_settings_admin_read" ON public.shop_settings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));