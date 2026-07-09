
REVOKE EXECUTE ON FUNCTION public.assign_first_user_as_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_deal_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.snapshot_deal_price_on_change() FROM PUBLIC, anon, authenticated;
