-- 0232 — Goals canônicos da organização para o Tenant Runtime / Intelligence.
-- Fase v0.13: persistência read-only para o Runtime. Nenhuma escrita autônoma é habilitada.

create table if not exists public.org_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint org_goals_name_nonblank check (length(btrim(name)) > 0),
  constraint org_goals_status_check check (status in ('draft', 'active', 'completed', 'archived'))
);

create index if not exists idx_org_goals_org_status_created
  on public.org_goals (organization_id, status, created_at, id);

alter table public.org_goals enable row level security;

drop policy if exists org_goals_select_tenant on public.org_goals;
create policy org_goals_select_tenant on public.org_goals
  for select
  to authenticated
  using (
    organization_id in (select public.fn_user_org_ids())
    or public.fn_is_platform_admin()
  );

revoke all on public.org_goals from anon;
revoke insert, update, delete on public.org_goals from authenticated;
grant select on public.org_goals to authenticated;

comment on table public.org_goals is
  'Objetivos canônicos da organização consumidos pelo Coagentica Tenant Runtime. v0.13 expõe somente leitura ao runtime autenticado; escrita autônoma permanece desabilitada.';

comment on column public.org_goals.status is
  'Vocabulário fechado do TenantGoal: draft | active | completed | archived.';
