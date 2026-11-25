-- Trigger functions are never called directly; role helpers only by signed-in users (RLS needs them).
revoke execute on function public.handle_new_user(), public.guard_profile_role(), public.touch_updated_at() from public, anon, authenticated;
revoke execute on function public.current_role_name(), public.is_admin(), public.is_approved() from public, anon;
grant execute on function public.current_role_name(), public.is_admin(), public.is_approved() to authenticated;
