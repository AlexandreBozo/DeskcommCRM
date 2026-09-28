-- Correção de privilégio: funções de provisionamento são chamadas exclusivamente
-- pelo backend com service_role após validar a sessão e o platform admin.
revoke execute on function public.fn_provision_tenant(uuid, uuid, jsonb, text) from public, anon, authenticated, coagentica_app, coagentica_message_sync;
revoke execute on function public.fn_accept_organization_invite(uuid, uuid, text, uuid, timestamptz) from public, anon, authenticated, coagentica_app, coagentica_message_sync;
grant execute on function public.fn_provision_tenant(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.fn_accept_organization_invite(uuid, uuid, text, uuid, timestamptz) to service_role;
