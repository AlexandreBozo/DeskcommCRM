-- 0234 · Credenciais OAuth do Google Ads configuráveis pela própria organização.
--
-- O login do Google Ads não deve depender de editar .env na VPS. Assim como a
-- conexão de leitura do Meta Ads é administrada pela UI, cada organização pode
-- cadastrar o OAuth Client ID/Secret usado para iniciar o consentimento.
--
-- O Client ID não é segredo. Client Secret e Developer Token legado ficam
-- cifrados com a mesma infraestrutura de secrets já usada pelo produto.
--
-- Developer Token tornou-se opcional na API Google Ads em 2026-09; a coluna
-- permanece apenas para compatibilidade com projetos antigos.

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

create unique index if not exists google_ads_app_credentials_org_uk
  on public.google_ads_app_credentials (organization_id);

alter table public.google_ads_app_credentials enable row level security;
revoke all on public.google_ads_app_credentials from anon, authenticated;
grant select, insert, update, delete on public.google_ads_app_credentials to service_role;

drop trigger if exists trg_google_ads_app_credentials_updated_at
  on public.google_ads_app_credentials;
create trigger trg_google_ads_app_credentials_updated_at
  before update on public.google_ads_app_credentials
  for each row execute function public.fn_set_updated_at();

comment on table public.google_ads_app_credentials is
  'OAuth app credentials do Google Ads por organização. Client Secret e Developer Token legado ficam cifrados; OAuth tokens do usuário continuam em google_ads_connections.';
