begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
create table if not exists private.app_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
revoke all on schema private from public, anon, authenticated, service_role, coagentica_app, coagentica_message_sync;
revoke all on private.app_secrets from public, anon, authenticated, service_role, coagentica_app, coagentica_message_sync;

create or replace function private.fn_oauth_key()
returns text
language sql
security definer
set search_path = private, pg_temp
as $$
  select coalesce(
    nullif(current_setting('app.nuvemshop_oauth_key', true), ''),
    (select value from private.app_secrets where name = 'nuvemshop_oauth_key')
  );
$$;
revoke all on function private.fn_oauth_key() from public, anon, authenticated, service_role, coagentica_app, coagentica_message_sync;

create or replace function public.fn_encrypt_oauth(plaintext text)
returns bytea
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  key_value text := private.fn_oauth_key();
begin
  if key_value is null or length(key_value) < 32 then
    raise exception 'OAuth encryption key unavailable' using errcode = '55000';
  end if;
  return pgp_sym_encrypt(plaintext, key_value, 'cipher-algo=aes256');
end;
$$;

create or replace function public.fn_decrypt_oauth(ciphertext bytea)
returns text
language plpgsql
security definer
set search_path = public, private, extensions, pg_temp
as $$
declare
  key_value text := private.fn_oauth_key();
begin
  if key_value is null or length(key_value) < 32 then
    raise exception 'OAuth encryption key unavailable' using errcode = '55000';
  end if;
  return pgp_sym_decrypt(ciphertext, key_value);
end;
$$;

revoke all on function public.fn_encrypt_oauth(text) from public, anon, authenticated, coagentica_app, coagentica_message_sync;
revoke all on function public.fn_decrypt_oauth(bytea) from public, anon, authenticated, coagentica_app, coagentica_message_sync;
grant execute on function public.fn_encrypt_oauth(text) to service_role;
grant execute on function public.fn_decrypt_oauth(bytea) to service_role;

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.fn_set_updated_at() from public, anon, authenticated;
grant execute on function public.fn_set_updated_at() to service_role, coagentica_app;

create table if not exists public.google_ads_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connected_by uuid,
  account_email text,
  oauth_access_token_encrypted bytea not null,
  oauth_refresh_token_encrypted bytea not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  default_customer_id text,
  login_customer_id text,
  status text not null default 'healthy',
  last_error text,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint google_ads_connections_status_ck check (status in ('healthy', 'needs_reauth', 'error'))
);
create unique index if not exists google_ads_connections_org_uk on public.google_ads_connections (organization_id);
alter table public.google_ads_connections enable row level security;
revoke all on public.google_ads_connections from public, anon, authenticated, coagentica_app, coagentica_message_sync;
grant select, insert, update, delete on public.google_ads_connections to service_role;
drop trigger if exists trg_google_ads_connections_updated_at on public.google_ads_connections;
create trigger trg_google_ads_connections_updated_at before update on public.google_ads_connections
for each row execute function public.fn_set_updated_at();

create table if not exists public.google_ads_app_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  configured_by uuid,
  oauth_client_id text not null,
  oauth_client_secret_encrypted bytea not null,
  developer_token_encrypted bytea,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists google_ads_app_credentials_org_uk on public.google_ads_app_credentials (organization_id);
alter table public.google_ads_app_credentials enable row level security;
revoke all on public.google_ads_app_credentials from public, anon, authenticated, coagentica_app, coagentica_message_sync;
grant select, insert, update, delete on public.google_ads_app_credentials to service_role;
drop trigger if exists trg_google_ads_app_credentials_updated_at on public.google_ads_app_credentials;
create trigger trg_google_ads_app_credentials_updated_at before update on public.google_ads_app_credentials
for each row execute function public.fn_set_updated_at();

create table if not exists public.google_ads_oauth_nonces (
  nonce text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  used_at timestamptz not null default now()
);
alter table public.google_ads_oauth_nonces enable row level security;
revoke all on public.google_ads_oauth_nonces from public, anon, authenticated, coagentica_app, coagentica_message_sync;
grant select, insert, delete on public.google_ads_oauth_nonces to service_role;

create table if not exists public.ad_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null,
  external_account_id text not null,
  parent_external_account_id text,
  name text not null,
  currency text,
  time_zone text,
  status text,
  is_manager boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_accounts_platform_ck check (platform in ('meta_ads', 'google_ads'))
);
create unique index if not exists ad_accounts_org_platform_external_uk on public.ad_accounts (organization_id, platform, external_account_id);
create index if not exists ad_accounts_org_platform_idx on public.ad_accounts (organization_id, platform);
alter table public.ad_accounts enable row level security;
revoke all on public.ad_accounts from public, anon, authenticated, coagentica_message_sync;
grant select, insert, update, delete on public.ad_accounts to service_role, coagentica_app;
drop policy if exists tenant_isolation on public.ad_accounts;
create policy tenant_isolation on public.ad_accounts for all to coagentica_app
using (organization_id = public.current_organization_id() or public.has_active_support_session(organization_id))
with check (organization_id = public.current_organization_id());
drop trigger if exists trg_ad_accounts_updated_at on public.ad_accounts;
create trigger trg_ad_accounts_updated_at before update on public.ad_accounts
for each row execute function public.fn_set_updated_at();

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null,
  external_account_id text not null,
  external_campaign_id text not null,
  name text not null,
  status text,
  objective text,
  campaign_type text,
  start_date date,
  end_date date,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_campaigns_platform_ck check (platform in ('meta_ads', 'google_ads'))
);
create unique index if not exists ad_campaigns_org_platform_external_uk on public.ad_campaigns (organization_id, platform, external_account_id, external_campaign_id);
create index if not exists ad_campaigns_org_platform_account_idx on public.ad_campaigns (organization_id, platform, external_account_id);
alter table public.ad_campaigns enable row level security;
revoke all on public.ad_campaigns from public, anon, authenticated, coagentica_message_sync;
grant select, insert, update, delete on public.ad_campaigns to service_role, coagentica_app;
drop policy if exists tenant_isolation on public.ad_campaigns;
create policy tenant_isolation on public.ad_campaigns for all to coagentica_app
using (organization_id = public.current_organization_id() or public.has_active_support_session(organization_id))
with check (organization_id = public.current_organization_id());
drop trigger if exists trg_ad_campaigns_updated_at on public.ad_campaigns;
create trigger trg_ad_campaigns_updated_at before update on public.ad_campaigns
for each row execute function public.fn_set_updated_at();

create table if not exists public.ad_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null,
  external_account_id text not null,
  external_campaign_id text not null,
  metric_date date not null,
  currency text,
  cost_micros bigint,
  impressions bigint,
  clicks bigint,
  reach bigint,
  interactions bigint,
  conversions numeric(20, 6),
  all_conversions numeric(20, 6),
  conversion_value numeric(20, 6),
  all_conversion_value numeric(20, 6),
  view_through_conversions numeric(20, 6),
  raw jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ad_metrics_daily_platform_ck check (platform in ('meta_ads', 'google_ads'))
);
create unique index if not exists ad_metrics_daily_org_platform_campaign_day_uk on public.ad_metrics_daily (organization_id, platform, external_account_id, external_campaign_id, metric_date);
create index if not exists ad_metrics_daily_org_platform_date_idx on public.ad_metrics_daily (organization_id, platform, metric_date desc);
create index if not exists ad_metrics_daily_org_account_date_idx on public.ad_metrics_daily (organization_id, external_account_id, metric_date desc);
alter table public.ad_metrics_daily enable row level security;
revoke all on public.ad_metrics_daily from public, anon, authenticated, coagentica_message_sync;
grant select, insert, update, delete on public.ad_metrics_daily to service_role, coagentica_app;
drop policy if exists tenant_isolation on public.ad_metrics_daily;
create policy tenant_isolation on public.ad_metrics_daily for all to coagentica_app
using (organization_id = public.current_organization_id() or public.has_active_support_session(organization_id))
with check (organization_id = public.current_organization_id());
drop trigger if exists trg_ad_metrics_daily_updated_at on public.ad_metrics_daily;
create trigger trg_ad_metrics_daily_updated_at before update on public.ad_metrics_daily
for each row execute function public.fn_set_updated_at();

create table if not exists public.ad_sync_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null,
  external_account_id text,
  status text not null,
  date_from date,
  date_to date,
  accounts_seen integer not null default 0,
  campaigns_seen integer not null default 0,
  metric_rows_written integer not null default 0,
  error_code text,
  error_detail text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ad_sync_runs_platform_ck check (platform in ('meta_ads', 'google_ads')),
  constraint ad_sync_runs_status_ck check (status in ('running', 'succeeded', 'failed'))
);
create index if not exists ad_sync_runs_org_platform_started_idx on public.ad_sync_runs (organization_id, platform, started_at desc);
alter table public.ad_sync_runs enable row level security;
revoke all on public.ad_sync_runs from public, anon, authenticated, coagentica_message_sync;
grant select, insert, update, delete on public.ad_sync_runs to service_role, coagentica_app;
drop policy if exists tenant_isolation on public.ad_sync_runs;
create policy tenant_isolation on public.ad_sync_runs for all to coagentica_app
using (organization_id = public.current_organization_id() or public.has_active_support_session(organization_id))
with check (organization_id = public.current_organization_id());

comment on table public.google_ads_app_credentials is 'Credenciais OAuth Google Ads por organização; segredos somente em bytea cifrado.';
comment on table public.google_ads_connections is 'Conexão OAuth Google Ads por organização; access e refresh tokens somente em bytea cifrado.';
comment on table public.ad_metrics_daily is 'Histórico diário normalizado de mídia paga; métricas derivadas são calculadas na leitura.';
comment on table public.ad_sync_runs is 'Registro operacional das sincronizações de mídia paga.';

insert into public.schema_migrations (version, applied_at)
values ('029_google_ads_operational_foundation.sql', now())
on conflict (version) do nothing;

notify pgrst, 'reload schema';
commit;
