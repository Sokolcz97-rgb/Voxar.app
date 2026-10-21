-- Úklid dat podle Zásad ochrany osobních údajů a Obchodních podmínek (verze 2026-10-22).
create or replace function public.vox_legal_cleanup()
returns void language plpgsql security definer set search_path = public as $$
begin
  -- nezaplacené objednávky se po 7 dnech ruší (Obchodní podmínky, bod 5)
  update shop_purchases set status = 'cancelled'
   where status = 'pending'
     and ((not renewal and created_at < now() - interval '7 days') or (renewal and created_at < now() - interval '11 days'));
  -- crash reporty her: 180 dní
  delete from ashes_crash_reports where created_at < now() - interval '180 days';
  -- herní chat: 90 dní
  delete from ashes_chat where created_at < now() - interval '90 days';
  -- VoxarioProtect: výzvy 30 dní, incidenty 12 měsíců
  delete from vox_protect_challenges where created_at < now() - interval '30 days';
  delete from vox_protect_incidents where created_at < now() - interval '12 months';
  -- moderační log: 12 měsíců
  delete from moderation_log where created_at < now() - interval '12 months';
end $$;
revoke all on function public.vox_legal_cleanup() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('vox-legal-cleanup') where exists (select 1 from cron.job where jobname = 'vox-legal-cleanup');
  perform cron.schedule('vox-legal-cleanup', '43 3 * * *', 'select public.vox_legal_cleanup()');
end $$;

-- Záruka vrácení peněz u předplatného: u jedné položky jen jednou.
create or replace function public.shop_refund_used(p_user uuid, p_item uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from shop_purchases where user_id = p_user and item_id = p_item and refund_requested_at is not null)
$$;
revoke all on function public.shop_refund_used(uuid, uuid) from public, anon, authenticated;
