begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

drop trigger if exists activities_owner_member_same_organization on public.activities;
create trigger activities_owner_member_same_organization before insert or update of organization_id, owner_member_id on public.activities for each row execute function public.enforce_same_organization('owner_member_id', 'public.organization_members');
drop trigger if exists approval_requests_approver_member_same_organization on public.approval_requests;
create trigger approval_requests_approver_member_same_organization before insert or update of organization_id, approver_member_id on public.approval_requests for each row execute function public.enforce_same_organization('approver_member_id', 'public.organization_members');
drop trigger if exists audit_logs_actor_agent_same_organization on public.audit_logs;
create trigger audit_logs_actor_agent_same_organization before insert or update of organization_id, actor_agent_id on public.audit_logs for each row execute function public.enforce_same_organization('actor_agent_id', 'public.agents');
drop trigger if exists audit_logs_support_access_session_same_organization on public.audit_logs;
create trigger audit_logs_support_access_session_same_organization before insert or update of organization_id, support_access_session_id on public.audit_logs for each row execute function public.enforce_same_organization('support_access_session_id', 'public.support_access_sessions');
drop trigger if exists coleta_execucoes_contrato_same_organization on public.coleta_execucoes;
create trigger coleta_execucoes_contrato_same_organization before insert or update of organization_id, contrato_id on public.coleta_execucoes for each row execute function public.enforce_same_organization('contrato_id', 'public.fornecedor_contratos');
drop trigger if exists coleta_execucoes_fatura_same_organization on public.coleta_execucoes;
create trigger coleta_execucoes_fatura_same_organization before insert or update of organization_id, fatura_id on public.coleta_execucoes for each row execute function public.enforce_same_organization('fatura_id', 'public.faturas');
drop trigger if exists companies_owner_member_same_organization on public.companies;
create trigger companies_owner_member_same_organization before insert or update of organization_id, owner_member_id on public.companies for each row execute function public.enforce_same_organization('owner_member_id', 'public.organization_members');
drop trigger if exists contacts_owner_member_same_organization on public.contacts;
create trigger contacts_owner_member_same_organization before insert or update of organization_id, owner_member_id on public.contacts for each row execute function public.enforce_same_organization('owner_member_id', 'public.organization_members');
drop trigger if exists customer_metric_contacts_source_same_organization on public.customer_metric_contacts;
create trigger customer_metric_contacts_source_same_organization before insert or update of organization_id, source_id on public.customer_metric_contacts for each row execute function public.enforce_same_organization('source_id', 'public.customer_metric_sources');
drop trigger if exists customer_metric_fact_items_fact_same_organization on public.customer_metric_fact_items;
create trigger customer_metric_fact_items_fact_same_organization before insert or update of organization_id, fact_id on public.customer_metric_fact_items for each row execute function public.enforce_same_organization('fact_id', 'public.customer_metric_facts');
drop trigger if exists customer_metric_facts_source_same_organization on public.customer_metric_facts;
create trigger customer_metric_facts_source_same_organization before insert or update of organization_id, source_id on public.customer_metric_facts for each row execute function public.enforce_same_organization('source_id', 'public.customer_metric_sources');
drop trigger if exists customer_metric_snapshots_source_same_organization on public.customer_metric_snapshots;
create trigger customer_metric_snapshots_source_same_organization before insert or update of organization_id, source_id on public.customer_metric_snapshots for each row execute function public.enforce_same_organization('source_id', 'public.customer_metric_sources');
drop trigger if exists customer_metric_sync_cursors_source_same_organization on public.customer_metric_sync_cursors;
create trigger customer_metric_sync_cursors_source_same_organization before insert or update of organization_id, source_id on public.customer_metric_sync_cursors for each row execute function public.enforce_same_organization('source_id', 'public.customer_metric_sources');
drop trigger if exists departments_parent_department_same_organization on public.departments;
create trigger departments_parent_department_same_organization before insert or update of organization_id, parent_department_id on public.departments for each row execute function public.enforce_same_organization('parent_department_id', 'public.departments');
drop trigger if exists faturas_contrato_same_organization on public.faturas;
create trigger faturas_contrato_same_organization before insert or update of organization_id, contrato_id on public.faturas for each row execute function public.enforce_same_organization('contrato_id', 'public.fornecedor_contratos');
drop trigger if exists fornecedor_contratos_fornecedor_same_organization on public.fornecedor_contratos;
create trigger fornecedor_contratos_fornecedor_same_organization before insert or update of organization_id, fornecedor_id on public.fornecedor_contratos for each row execute function public.enforce_same_organization('fornecedor_id', 'public.fornecedores');
drop trigger if exists leads_owner_member_same_organization on public.leads;
create trigger leads_owner_member_same_organization before insert or update of organization_id, owner_member_id on public.leads for each row execute function public.enforce_same_organization('owner_member_id', 'public.organization_members');
drop trigger if exists opportunities_owner_member_same_organization on public.opportunities;
create trigger opportunities_owner_member_same_organization before insert or update of organization_id, owner_member_id on public.opportunities for each row execute function public.enforce_same_organization('owner_member_id', 'public.organization_members');
drop trigger if exists organization_invitations_department_same_organization on public.organization_invitations;
create trigger organization_invitations_department_same_organization before insert or update of organization_id, department_id on public.organization_invitations for each row execute function public.enforce_same_organization('department_id', 'public.departments');
drop trigger if exists organization_members_department_same_organization on public.organization_members;
create trigger organization_members_department_same_organization before insert or update of organization_id, department_id on public.organization_members for each row execute function public.enforce_same_organization('department_id', 'public.departments');
drop trigger if exists product_metric_snapshots_source_same_organization on public.product_metric_snapshots;
create trigger product_metric_snapshots_source_same_organization before insert or update of organization_id, source_id on public.product_metric_snapshots for each row execute function public.enforce_same_organization('source_id', 'public.customer_metric_sources');
drop trigger if exists projects_owner_member_same_organization on public.projects;
create trigger projects_owner_member_same_organization before insert or update of organization_id, owner_member_id on public.projects for each row execute function public.enforce_same_organization('owner_member_id', 'public.organization_members');
drop trigger if exists tasks_assignee_member_same_organization on public.tasks;
create trigger tasks_assignee_member_same_organization before insert or update of organization_id, assignee_member_id on public.tasks for each row execute function public.enforce_same_organization('assignee_member_id', 'public.organization_members');
drop trigger if exists tickets_assignee_member_same_organization on public.tickets;
create trigger tickets_assignee_member_same_organization before insert or update of organization_id, assignee_member_id on public.tickets for each row execute function public.enforce_same_organization('assignee_member_id', 'public.organization_members');

create or replace function public.enforce_member_role_organization()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  member_organization_id uuid;
  role_organization_id uuid;
begin
  select organization_id into member_organization_id
  from public.organization_members
  where id = new.member_id;

  select organization_id into role_organization_id
  from public.roles
  where id = new.role_id;

  if role_organization_id is not null and member_organization_id is distinct from role_organization_id then
    raise exception 'cross-tenant member role blocked'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_member_role_organization() from public, anon, authenticated;
drop trigger if exists member_roles_same_organization on public.member_roles;
create trigger member_roles_same_organization
before insert or update of member_id, role_id on public.member_roles
for each row execute function public.enforce_member_role_organization();

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_contacts'::regclass and conname = 'message_contacts_organization_id_fkey') then
    alter table public.message_contacts add constraint message_contacts_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_conversations'::regclass and conname = 'message_conversations_organization_id_fkey') then
    alter table public.message_conversations add constraint message_conversations_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_records'::regclass and conname = 'message_records_organization_id_fkey') then
    alter table public.message_records add constraint message_records_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_sync_checkpoints'::regclass and conname = 'message_sync_checkpoints_organization_id_fkey') then
    alter table public.message_sync_checkpoints add constraint message_sync_checkpoints_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_contacts'::regclass and conname = 'message_contacts_source_fkey') then
    alter table public.message_contacts add constraint message_contacts_source_fkey foreign key (organization_id, source_key) references public.message_sources(organization_id, source_key);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_conversations'::regclass and conname = 'message_conversations_source_fkey') then
    alter table public.message_conversations add constraint message_conversations_source_fkey foreign key (organization_id, source_key) references public.message_sources(organization_id, source_key);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_conversations'::regclass and conname = 'message_conversations_contact_fkey') then
    alter table public.message_conversations add constraint message_conversations_contact_fkey foreign key (organization_id, source_key, contact_id) references public.message_contacts(organization_id, source_key, source_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_records'::regclass and conname = 'message_records_source_fkey') then
    alter table public.message_records add constraint message_records_source_fkey foreign key (organization_id, source_key) references public.message_sources(organization_id, source_key);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_records'::regclass and conname = 'message_records_conversation_fkey') then
    alter table public.message_records add constraint message_records_conversation_fkey foreign key (organization_id, source_key, conversation_id) references public.message_conversations(organization_id, source_key, source_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_records'::regclass and conname = 'message_records_contact_fkey') then
    alter table public.message_records add constraint message_records_contact_fkey foreign key (organization_id, source_key, contact_id) references public.message_contacts(organization_id, source_key, source_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.message_sync_checkpoints'::regclass and conname = 'message_sync_checkpoints_source_fkey') then
    alter table public.message_sync_checkpoints add constraint message_sync_checkpoints_source_fkey foreign key (organization_id, source_key) references public.message_sources(organization_id, source_key);
  end if;
end;
$$;

insert into public.roles (organization_id, code, name, description, is_system)
select o.id, standard.code, standard.name, standard.description, true
from public.organizations o
cross join (values
  ('org_admin', 'Administrador da organização', 'Gerencia configurações e acessos da organização.'),
  ('manager', 'Gerente', 'Gerencia a operação da organização.'),
  ('agent', 'Agente', 'Opera o atendimento da organização.'),
  ('viewer', 'Visualizador', 'Acesso somente leitura à organização.')
) as standard(code, name, description)
where o.status = 'active'::organization_status
  and o.deleted_at is null
on conflict (organization_id, code) do nothing;

insert into public.schema_migrations (version, applied_at)
values ('028_tenant_isolation_hardening.sql', now())
on conflict (version) do nothing;

commit;
