DROP FUNCTION IF EXISTS public.get_public_shop_config();
CREATE FUNCTION public.get_public_shop_config()
RETURNS TABLE(id uuid, donate_min integer, donate_max integer, refund_notice text, paypal_me text, iban text, account_number text, bank_recipient text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT id, donate_min, donate_max, refund_notice, paypal_me, iban, account_number, bank_recipient FROM public.shop_settings LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.get_public_shop_config() TO anon, authenticated;