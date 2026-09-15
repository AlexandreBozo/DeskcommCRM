-- 0231 _ api_audit_log é trilha de auditoria append-only, não mutação operacional.
-- A 0220 aplicou policies restritivas de suporte a toda tabela RLS com organization_id,
-- incluindo api_audit_log. Isso impede o próprio audit de requisições read-only quando
-- fn_support_write_allowed() recusa write operacional. A auditoria deve continuar
-- registrándoole tentante/ator explicitamente e não deve ganhar UPDATE/DELETE.

-- A tabela continua append-only por permissões/RS: não hã policy permissiva de UPDATE/DELETE.
drop policy if exists support_write_insert on public.api_audit_log;
drop policy if exists support_write_update on public.api_audit_log;
drop policy if exists support_write_delete on public.api_audit_log;

-- Controle de regressão: o insert de membro autenticado segue presente.
do $f$
begin
  if not exists (
    select 1 from pg_policy p
    join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='api_audit_log'
      and p.polname='audit_log_insert_tenant_member'
  ) then
    raise exception 'audit_log_insert_tenant_member ausente';
  end if;
end $f$;
