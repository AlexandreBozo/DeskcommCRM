# Coagentica OS — Tenant Operations Core v0.2

**Status:** validado no workspace `coagentica-prod`, pronto para promoção controlada.
**Princípio central:** o Operations Kernel é compartilhado e stateless; cada tenant possui seu próprio Tenant Operations Core lógico; Intelligence Runtime permanece compartilhado e independente; Hermes é apenas adapter opcional.

## Arquitetura

```text
Coagentica Platform
├── Foundation
│   ├── tenancy
│   ├── identity
│   ├── permissions
│   └── audit
├── Operations Kernel
│   ├── Entity
│   ├── Event
│   ├── Policy
│   └── Workflow
├── Tenant Runtime
│   └── Tenant Operations Core
│       ├── Entities
│       ├── Relationships
│       ├── Knowledge
│       ├── Memory
│       ├── Goals
│       ├── Capabilities
│       ├── Events
│       ├── Workflows
│       ├── Policies
│       └── Audit
├── Intelligence Runtime
└── Integrations
    └── Deskcomm adapters
```

## 1. Operations Kernel

`coagentica/operations-kernel` contém contratos compartilhados e não mantém estado específico de cliente.

A v0.2 adiciona:

- `EntityRef`
- `EntitySnapshot<T>`
- `RelationshipRef`
- validação de vínculo por tenant
- snapshots imutáveis/versionados

O Kernel não pode depender de:

- `tenant-runtime`
- Deskcomm / `@/lib/*`
- Hermes
- `business-engine` legado

## 2. Tenant Operations Core

`coagentica/tenant-runtime` representa o estado lógico isolado de cada organização.

O contrato `TenantStateSnapshot` contém:

```ts
interface TenantStateSnapshot {
  readonly tenantId: string;
  readonly entities: readonly EntitySnapshot[];
  readonly relationships: readonly RelationshipRef[];
  readonly knowledgeSources: readonly TenantKnowledgeSource[];
  readonly memoryEntries: readonly TenantMemoryEntry[];
  readonly goals: readonly TenantGoal[];
  readonly capabilities: readonly TenantCapability[];
  readonly version: number;
  readonly snapshotAt: string;
}
```

Regras obrigatórias:

- todo item do snapshot deve pertencer ao mesmo `tenantId`;
- `withTenantState()` rejeita snapshot de outro tenant;
- `withTenantState()` rejeita versão anterior à atual;
- estado cross-tenant é detectado por `validateTenantStateSnapshot()`;
- `organizationId` e `tenantId` representam o mesmo boundary de organização na Foundation atual.

## 3. Mapeamento Deskcomm → Coagentica

Os adapters vivem exclusivamente em `coagentica/integrations/deskcomm`.

| Deskcomm | Coagentica |
|---|---|
| `organizations` | `EntitySnapshot` do tipo `organization` |
| `contacts` | `EntitySnapshot` do tipo `contact` |
| `org_memory_entries` | `TenantMemoryEntry` + relacionamento com organização |
| `ai_knowledge_sources` | `TenantKnowledgeSource` + relacionamento com organização |
| `skill_pointers` + `skill_versions` | `TenantCapability` ativa + relacionamento |
| Goal | sem adapter/persistência nesta versão |

Mapeamentos propositalmente proibidos:

```text
contact -> memory         ✘
organization -> goal      ✘
organization -> knowledge ✘
```

Esses conceitos só podem ser produzidos a partir de uma fonte operacional que realmente represente aquele fato.

### Skills globais

Skills platform-scoped podem ser projetadas em um tenant somente quando o caller fornece `targetTenantId` explicitamente depois de autorização/policy. O adapter é puro e recusa projeção implícita ou ambígua.

## 4. Knowledge, Memory, Goals e Capabilities

### Knowledge
Fonte atual: `ai_knowledge_sources`.

### Memory
Fonte atual: `org_memory_entries`.

### Goals
Existe como contrato do domínio, mas não existe tabela/adapter sintético. Persistência será criada apenas quando houver uma fonte operacional legítima.

### Capabilities
A capability de skill é derivada da combinação entre o pointer ativo e a versão correspondente. Skill global não recebe tenant automaticamente.

## 5. Intelligence Runtime

`coagentica/intelligence` continua independente do Operations Kernel e Tenant Runtime.

A v0.2 reforça:

- `PolicyConstraint` estrutural próprio no Intelligence Runtime;
- nenhuma importação direta de `operations-kernel`;
- Hermes apenas em `intelligence/adapters/hermes.ts`;
- o adapter Hermes não fabrica mais tenant/contexto vazio: recebe um `OrchestratorPort` com contexto real do caller.

## 6. Ports de leitura

`tenant-runtime/ports/state-source.ts` define portas de leitura para:

- entities e relationships
- knowledge
- memory
- goals
- capabilities
- snapshots

Implementações concretas devem viver em integrações/adapters, não nos contratos do Tenant Runtime.

## 7. Fronteiras automatizadas

Os testes arquiteturais bloqueiam:

```text
foundation/contracts          -> @/lib            ✘
operations-kernel             -> @/lib            ✘
operations-kernel             -> tenant-runtime   ✘
operations-kernel             -> business-engine  ✘
intelligence                  -> @/lib            ✘
intelligence                  -> operations-kernel ✘
intelligence                  -> tenant-runtime    ✘
Hermes fora de adapters                           ✘
Deskcomm dentro dos contratos                     ✘
```

## 8. Validação

Checkpoint validado no `coagentica-prod`:

```text
TypeScript typecheck: PASS
ESLint:               PASS
Test files:           24/24
Tests:                293/293
Architecture review:  0 blocker / 0 high
```

Não há migration nesta versão.

## 9. Regra operacional de produção

Build, typecheck, lint e testes devem executar no workspace `coagentica-prod`, nunca na VPS de produção.

A VPS recebe somente arquivos já validados e é verificada por:

- checksum/hash;
- health check;
- estado dos containers;
- Git diff/checkpoint.

Essa regra foi adotada depois da saturação do host de 1 vCPU durante execução de toolchain de desenvolvimento.

## Critério de aceite v0.2

A v0.2 é aceita quando:

1. o código validado no `coagentica-prod` é idêntico por checksum ao promovido;
2. o runtime continua healthy;
3. nenhum contrato canônico importa Deskcomm/Hermes indevidamente;
4. o Tenant Operations Core rejeita contaminação cross-tenant;
5. o checkpoint é commitado isoladamente no repositório canônico.
