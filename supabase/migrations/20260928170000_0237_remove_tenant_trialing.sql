-- Remove o estado comercial trialing do ciclo de vida operacional dos tenants.
-- Novas organizações nascem ativas e registros/recibos existentes são normalizados.

begin;

create or replace function public.fn_provision_tenant(
  p_actor uuid,
  p_key uuid,
  p_request jsonb,
  p_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  receipt public.tenant_provisioning_receipts%rowtype;
  org public.organizations%rowtype;
  member_id uuid;
  admin_role_id uuid;
  result jsonb;
  name_value text := nullif(btrim(coalesce(p_request->>'name', '')), '');
  slug_value text := nullif(btrim(coalesce(p_request->>'slug', '')), '');
  metadata_value jsonb := coalesce(p_request->'metadata', '{}'::jsonb);
begin
  if not exists (
    select 1 from public.platform_admins
    where user_id = p_actor and revoked_at is null
  ) then
    raise exception 'platform_admin_required' using errcode = '42501';
  end if;
  if name_value is null or char_length(name_value) < 2 or char_length(name_value) > 120 then
    raise exception 'invalid_tenant_name' using errcode = '22023';
  end if;
  if slug_value is null or slug_value !~ '^[a-z0-9-]{2,40}$' then
    raise exception 'invalid_tenant_slug' using errcode = '22023';
  end if;
  if jsonb_typeof(metadata_value) <> 'object' then
    raise exception 'invalid_tenant_metadata' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_actor::text || ':' || p_key::text, 0));
  select * into receipt
  from public.tenant_provisioning_receipts
  where actor_id = p_actor and idempotency_key = p_key;
  if found then
    if receipt.request_hash <> p_hash then
      raise exception 'idempotency_conflict' using errcode = '22023';
    end if;
    return receipt.response_body || jsonb_build_object('created', false);
  end if;

  insert into public.organizations(name, slug, status, metadata, created_by, updated_by)
  values (name_value, slug_value, 'active', metadata_value, p_actor, p_actor)
  returning * into org;

  insert into public.roles(organization_id, code, name, description, is_system, created_by, updated_by)
  values
    (org.id, 'org_admin', 'Administrador da organização', 'Gerencia configurações e acessos da organização.', true, p_actor, p_actor),
    (org.id, 'manager', 'Gerente', 'Gerencia a operação da organização.', true, p_actor, p_actor),
    (org.id, 'agent', 'Agente', 'Opera o atendimento da organização.', true, p_actor, p_actor),
        (org.id, 'viewer', 'Visualizador', 'Acesso somente leitura à organização.', true, p_actor, p_actor);

  select id into admin_role_id
  from public.roles
  where organization_id = org.id and code = 'org_admin' and deleted_at is null;

  insert into public.organization_members(
    organization_id, user_id, status, invited_by, joined_at
  ) values (
    org.id, p_actor, 'active', p_actor, now()
  ) returning id into member_id;

  insert into public.member_roles(member_id, role_id, created_by)
  values (member_id, admin_role_id, p_actor);

  result := jsonb_build_object(
    'id', org.id,
    'name', org.name,
    'slug', org.slug,
    'status', org.status,
    'created_at', org.created_at
  );
  insert into public.tenant_provisioning_receipts(
    actor_id, idempotency_key, request_hash, organization_id, response_body
  ) values (p_actor, p_key, p_hash, org.id, result);

  return result || jsonb_build_object('created', true);
end;
$$;

revoke all on function public.fn_provision_tenant(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.fn_provision_tenant(uuid, uuid, jsonb, text) to service_role;

create or replace function public.fn_accept_organization_invite(
  p_user uuid,
  p_org uuid,
  p_role text,
  p_invited_by uuid,
  p_issued_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  membership public.organization_members%rowtype;
  role_id uuid;
begin
  if p_role not in ('org_admin', 'manager', 'agent', 'viewer') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organizations
    where id = p_org and status = 'active' and deleted_at is null
  ) then
    raise exception 'organization_unavailable' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_org::text, 0));
  select * into membership from public.organization_members
  where organization_id = p_org and user_id = p_user for update;

  if found and membership.status = 'removed' and p_issued_at <= membership.updated_at then
    raise exception 'invite_revoked' using errcode = '42501';
  end if;
  if found then
    update public.organization_members
    set status = 'active', invited_by = coalesce(p_invited_by, invited_by),
        joined_at = coalesce(joined_at, now()), deleted_at = null, updated_at = now()
    where id = membership.id
    returning * into membership;
  else
    insert into public.organization_members(organization_id, user_id, status, invited_by, joined_at)
    values (p_org, p_user, 'active', p_invited_by, now())
    returning * into membership;
  end if;

  select id into role_id from public.roles
  where organization_id = p_org and code = p_role and deleted_at is null;
  if role_id is null then
    raise exception 'organization_role_missing' using errcode = '23514';
  end if;
  delete from public.member_roles where member_id = membership.id;
  insert into public.member_roles(member_id, role_id, created_by)
  values (membership.id, role_id, p_invited_by);

  return jsonb_build_object('id', membership.id, 'organization_id', p_org, 'role', p_role);
end;
$$;

revoke all on function public.fn_accept_organization_invite(uuid, uuid, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.fn_accept_organization_invite(uuid, uuid, text, uuid, timestamptz) to service_role;

update public.organizations
set status = 'active', updated_at = now()
where status = 'trialing' and deleted_at is null;

update public.tenant_provisioning_receipts
set response_body = jsonb_set(response_body, '{status}', '"active"'::jsonb, true)
where response_body->>'status' = 'trialing';

commit;
