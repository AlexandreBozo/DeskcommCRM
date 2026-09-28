-- =============================================================================
-- Migration Add area_id to ai_agents
-- =============================================================================
-- Source of truth: Atualização dos Agentes Coagentica OS project

-- Add area_id column to ai_agents (nullable for backward compatibility)
alter table public.ai_agents
  add column if not exists area_id uuid;

-- Add foreign key constraint: (organization_id, area_id) references coagentica_areas(organization_id, id)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ai_agents_area_id_fkey'
      and conrelid = 'public.ai_agents'::regclass
  ) then
    alter table public.ai_agents
      add constraint ai_agents_area_id_fkey
      foreign key (organization_id, area_id)
      references public.coagentica_areas (organization_id, id)
      on delete restrict;
  end if;
end$$;

-- Create index for better performance
create index if not exists ai_agents_area_id_idx on public.ai_agents (area_id);
create index if not exists ai_agents_organization_id_area_id_idx on public.ai_agents (organization_id, area_id);

-- Update the audit trigger to include the new column (if needed, but the trigger already fires on update)
-- No need to change the trigger.

-- Note: We are not setting a default value for area_id, leaving it nullable for existing agents.
