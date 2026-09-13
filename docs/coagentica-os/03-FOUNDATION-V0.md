# Coagentica Foundation v0

**Status:** em construção validada no workspace `coagentica-prod`
**Princípio central:** um `Operations Core` lógico por tenant, com `Intelligence Runtime` compartilhado e sem dependência estrutural de Hermes ou do Deskcomm.

## Objetivo

A Foundation transforma o Deskcomm em base operacional da Coagentica sem fazer do Deskcomm o núcleo da plataforma. O domínio canônico deve permanecer independente dos detalhes do CRM legado, dos providers de IA e de qualquer orquestrador externo.

A arquitetura é dividida em três camadas principais:

```text
Platform Foundation
├── tenancy
├── identity
├── permissions
└── audit

Tenant Operations Core
├── entities
├── events
├── policies
├── workflows
├── context
├── memory
├── knowledge
├── goals
└── capabilities

Shared Intelligence Runtime
├── context engine
├── planning
├── decision
├── capability routing
├── agent runtime
├── model gateway
└── learning
```

## Regra de tenancy

Existe um único motor de software, mas cada organização possui um `TenantOperationsCore` logicamente isolado.

O estado operacional, regras, workflows, eventos, contexto, conhecimento, memória e aprendizado de um tenant não podem vazar para outro tenant. O `tenantId`/`organizationId` faz parte dos contratos canônicos e das decisões relevantes.

Não é necessário criar um serviço ou container separado por cliente. O isolamento é lógico e obrigatório.

## Operations Core

`coagentica/operations-core` é a fonte canônica para contratos operacionais.

Ele não pode depender de `@/lib/*`, de componentes internos do Deskcomm, de WAHA, de providers de IA ou de Hermes.

Dependências de legado pertencem aos adapters:

```text
Deskcomm EventRow
    ↓ adapter
SourceEventRecord
    ↓
DomainEvent
    ↓
EventEnvelope
```

```text
Deskcomm FlowGraph
    ↓ adapter
WorkflowGraph
    ↓
WorkflowDefinition / WorkflowRun
```

Os diretórios antigos `business-engine` permanecem apenas como aliases temporários de compatibilidade e não são a fonte canônica.

## Intelligence Runtime

`coagentica/intelligence` define a fronteira compartilhada de inteligência.

O runtime opera sobre qualquer `TenantOperationsCore` por meio de contratos como:

- `IntelligenceRequest`
- `ContextEnvelope`
- `CapabilityInvocation`
- `DecisionRecord`
- `OrchestratorPort`

O runtime compartilhado não contém estado global mutável de tenant.

A seleção de modelo, provider, agentes e ferramentas deve acontecer atrás de interfaces da própria Coagentica.

## Hermes

Hermes não é dependência estrutural.

A integração existe somente em:

```text
coagentica/intelligence/adapters/hermes.ts
```

O adapter pode ser usado durante a transição para aproveitar capacidades já existentes, mas todos os contratos centrais devem funcionar sem ele.

Direção de evolução:

```text
Fase 1  Hermes como adapter opcional
Fase 2  capacidades úteis são extraídas para interfaces canônicas
Fase 3  implementações nativas passam a atender essas interfaces
Fase 4  Hermes vira fallback/compatibilidade
Fase 5  Coagentica opera integralmente sem Hermes
```

## Deskcomm

Deskcomm continua sendo uma implementação operacional importante, mas não define o domínio canônico.

É permitido importar tipos e APIs do Deskcomm dentro de adapters e integrações. Não é permitido importá-los dentro de `operations-core/contracts` ou do núcleo de `intelligence`.

## Compatibilidade

Durante a migração, os caminhos antigos podem reexportar contratos novos para evitar quebra imediata:

```text
business-engine -> operations-core
intelligence-core -> intelligence
```

Código novo deve importar apenas os caminhos canônicos.

## Invariantes automatizados

A suíte de arquitetura deve impedir regressões como:

1. `operations-core/contracts` importar `@/lib/*`.
2. `intelligence` depender de Hermes fora de `adapters/hermes.ts`.
3. contratos canônicos dependerem dos aliases legados.
4. estado global mutável armazenar dados de tenants.
5. adapters contaminarem a direção de dependência do core.

## Critério de conclusão da Foundation v0

A fase pode ser considerada fechada quando:

- contratos canônicos estiverem estáveis;
- adapters Deskcomm cobrirem event log e workflows existentes;
- tenancy e permissões estiverem explícitas;
- arquitetura passar typecheck, lint e testes de fronteira;
- o runtime existente continuar saudável;
- nenhuma dependência obrigatória de Hermes existir;
- os primeiros fluxos reais do Deskcomm forem traduzidos para `Operations Core` sem alterar o hot path de produção.

## Próxima fase

A v0.1 conecta fatos reais do Deskcomm à Foundation:

```text
event_log      -> DomainEvent / EventEnvelope
requireRole    -> PermissionDecision
automation     -> WorkflowDefinition / WorkflowRun
api_audit_log  -> AuditRecord
tenant context -> TenantOperationsCore
```

Depois disso começa a implementação nativa do Intelligence Runtime e a absorção progressiva das capacidades hoje presentes no Hermes.
