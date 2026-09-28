-- =============================================================================
-- Migration Create coagentica_areas table
-- =============================================================================
-- Source of truth: Atualização dos Agentes Coagentica OS project

create table if not exists public.coagentica_areas (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  area_key text not null,
  name text not null,
  description text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique constraint for organization_id and area_key
create unique index if not exists coagentica_areas_organization_id_area_key_key
  on public.coagentica_areas (organization_id, area_key);

-- Candidate key used by tenant-safe composite foreign keys.
-- `id` is globally unique already, but PostgreSQL requires the referenced
-- composite columns themselves to be covered by a UNIQUE constraint/index.
create unique index if not exists coagentica_areas_organization_id_id_key
  on public.coagentica_areas (organization_id, id);

-- Indexes for common queries
create index if not exists coagentica_areas_organization_id_idx on public.coagentica_areas (organization_id);
create index if not exists coagentica_areas_organization_id_is_active_idx on public.coagentica_areas (organization_id, is_active) where is_active;

-- Enable Row Level Security
alter table public.coagentica_areas enable row level security;

-- Create policies for tenant isolation using the existing fn_user_org_ids function
drop policy if exists tenant_isolation_coagentica_areas_select on public.coagentica_areas;
create policy tenant_isolation_coagentica_areas_select on public.coagentica_areas
  for select
  using (organization_id in (select * from public.fn_user_org_ids()));

drop policy if exists tenant_isolation_coagentica_areas_insert on public.coagentica_areas;
create policy tenant_isolation_coagentica_areas_insert on public.coagentica_areas
  for insert
  with check (organization_id in (select * from public.fn_user_org_ids()));

drop policy if exists tenant_isolation_coagentica_areas_update on public.coagentica_areas;
create policy tenant_isolation_coagentica_areas_update on public.coagentica_areas
  for update
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));

drop policy if exists tenant_isolation_coagentica_areas_delete on public.coagentica_areas;
create policy tenant_isolation_coagentica_areas_delete on public.coagentica_areas
  for delete
  using (organization_id in (select * from public.fn_user_org_ids()));

-- Audit trigger
drop trigger if exists trg_coagentica_areas_audit on public.coagentica_areas;
create trigger trg_coagentica_areas_audit
  after insert or update or delete on public.coagentica_areas
  for each row execute function public.fn_audit_log_row();
