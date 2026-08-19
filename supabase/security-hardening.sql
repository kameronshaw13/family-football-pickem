-- Production hardening applied August 19, 2026.
-- Keep standings behind the server-side service-role API and prevent app roles
-- from invoking the SECURITY DEFINER DDL event-trigger helper directly.

alter view public.standings set (security_invoker = true);

revoke all privileges on table public.standings from anon, authenticated;
grant select on table public.standings to service_role;

revoke all privileges on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to postgres;
