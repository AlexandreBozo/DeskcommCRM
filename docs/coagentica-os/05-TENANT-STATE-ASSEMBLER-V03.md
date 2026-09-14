# Coagentica OS — Tenant State Assembler v0.3

**Status:** validado no workspace `coagentica-prod`, aprovado para promoção controlada.

## Objetivo

A v0.3 transforma os contratos da v0.2 em um caminho read-only real para hidratar o Operations Core de cada tenant sem acoplar o Tenant Runtime ao Deskcomm, Supabase, Hermes ou a qualquer SDK de IA.

```text
Deskcomm / Supabase
        ↓
 integration query-port
        ↓
TenantStateSourcePort
        ↓
Tenant State Assembler
        ↓
TenantStateSnapshot validado
        ↓
Tenant Operations Core
```

## Arquitetura

### Tenant Runtime

O `tenant-runtime` continua puro. Ele conhece apenas contratos do Operations Kernel e seus próprios ports.

Novos elementos:

- `TenantStateSourceData`
- `TenantStateSourcePort`
- `assembleTenantState()`

O assembler:
- exige `tenantId` explícito;
- rejeita envelope de outro tenant;
- cria `TenantStateSnapshot`;
- valida todos os itens tenant-bound;
- não consulta banco;
- não chama IA;
- não conhece Hermes.

### Integração Deskcomm

`coagentica/integrations/deskcomm/tenant-state-source.ts` contém a implementação concreta.

Fontes read-only usadas:

- `organizations`
- `contacts`
- `org_memory_entries`
- `ai_knowledge_sources`
- `skill_pointers`
- `skill_versions`

As queries com service-role usam filtros explícitos por tenant. O sistema não depende de RLS para isolamento quando usa o client administrativo.

## Regras de isolamento

- `organizations.id = tenantId`
- `contacts.organization_id = tenantId`
- `org_memory_entries.organization_id = tenantId`
- `ai_knowledge_sources.organization_id = tenantId`
- `skill_pointers.organization_id = tenantId` ou `NULL` para skills globais
- `skill_versions` tenant-scoped são rejeitadas se pertencerem a outro tenant
- qualquer row cross-tenant detectada após a query aborta a hidratação

Skills globais só entram no snapshot por projeção explícita para um `targetTenantId`. Skill tenant-scoped sobrescreve skill global de mesmo nome.

## Estado montado

O snapshot resultante contém:

```text
TenantStateSnapshot
├── entities
├── relationships
├── knowledgeSources
├── memoryEntries
├── goals
└── capabilities
```

`coals` permanece vazio nesta fase porque ainda não existe fonte persistente canônica. A plataforma não inventa objetivos a partir de outras tabelas.

## Fronteiras obrigatórias

- `tenant-runtime` não importa `@/lib`
- `tenant-runtime` não importa `@supabase/*`
- `tenant-runtime` não importa `integrations/deskcomm`
- `tenant-runtime` não referencia Hermes
- `tenant-runtime` não importa SDKs de IA
- Supabase e schema Deskcomm ficam em `coagentica/integrations/deskcomm`
- Intelligence Runtime permanece fora do caminho de hidratação do Operations Core

## Validação

Checkpoint no workspace `coagentica-prod`:

- TypeScript typecheck: PASS
- ESLint: PASS
- 28 arquivos de teste: PASS
- 357 testes: PASS
- 102 testes de fronteira arquitetural: PASS
- revisão independente: PASS
- BLOCKER: 0
- HIGH: 0

O revisor confirmou isolamento com service-role, direção correta de dependências, projeção explícita de skills globais e ausência de IA/Hermes dentro do Tenant Runtime.

## Restrições desta fase

- nenhuma migration;
- nenhuma persistência nova;
- nenhum endpoint público novo;
- nenhum hot path alterado;
- nenhuma execução de IA no Operations Core;
- nenhum build/typecheck na VPS de produção.

A v.3 prepara a próxima etapa: expor o snapshot operacional read-only como capability interna para o Intelligence Runtime, mantendo o Operations Core como fonte de fatos e não como segundo orquestrador.
