# Coagentica Intelligence v0.4 — Operational Context Bridge

Status: VALIDADO PARA PROMOÇÃO

## Objetivo

A v0.4 cria a fronteira read-only entre o Tenant Operations Core e o Intelligence Runtime sem transformar nenhuma das duas camadas em dependência estrutural da outra.

Fluxo canônico:

```text
Deskcomm / Supabase
        ↓
Tenant State Source
        ↓
Tenant State Assembler
        ↓
Tenant Operations Core
        ↓
TenantOperationalContextPort
        ↓
Operational Context Bridge
        ↓
Intelligence Runtime
```

O Intelligence Runtime não importa Tenant Runtime, Operations Kernel, Deskcomm, Supabase, Hermes ou SDKs de IA.

## Contrato

O port canônico vive em:

```text
coagentica/intelligence/ports/tenant-operational-context-port.ts
```

Ele expõe apenas uma visão estrutural e read-only do contexto operacional.

A implementação concreta vive em:

```text
coagentica/intelligence/adapters/tenant-operational-context-bridge.ts
```

O adapter é a única camada autorizada a conhecer simultaneamente o port de Intelligence e o Tenant State Assembler.

## Segurança por padrão

A seleção é deny-by-default.

Sem `selection`, nenhuma fatia operacional sensível é exposta:

- entities
- relationships
- knowledgeSources
- memoryEntries
- goals
- capabilities

Cada fatia precisa ser solicitada explicitamente. Quando aplicável, a consulta também pode restringir por IDs:

- `entityIds`
- `relationshipEntityIds`
- `knowledgeSourceIds`
- `memoryEntryIds`
- `goalIds`
- `capabilityIds`

## Limites

O bridge aplica limites padrão e hard caps para evitar contexto excessivo.

Limites inválidos, negativos ou não finitos são rejeitados. Valores acima do hard cap são clampados.

O retorno informa truncamento por fatia.

## Isolamento de tenant

A v0.4 usa defesa em profundidade.

1. `TenantContext.tenantId` e `organizationId` precisam ser válidos e iguais no modelo atual.
2. O Tenant State Assembler já valida o snapshot.
3. O Operational Context Bridge revalida novamente:
   - snapshot
   - entities
   - relationships
   - knowledgeSources
   - memoryEntries
   - goals
   - capabilities

Qualquer item pertencente a outro tenant causa falha fechada.

## Falhas

Falha da fonte operacional é propagada. O bridge não devolve contexto vazio silenciosamente.

A Intelligence não deve tomar decisão cega quando o estado operacional solicitado não puder ser carregado.

## Hermes

Hermes não participa deste contrato.

Ele continua apenas como adapter opcional do Intelligence Runtime e não é necessário para:

- carregar Tenant State
- projetar Operational Context
- validar tenant
- selecionar contexto
- aplicar limites

## Estado de validação

No workspace `coagentica-prod`:

```text
Typecheck                 OK
ESLint                    OK
Test files                30/30
Tests                     384/384
Architecture boundaries   117
Independent review        PASS
BLOCKER                    0
HIGH                       0
MEDIUM                     0
```

## Limites desta fase

A v0.4 não:

- altera schema
- cria migration
- altera hot path da aplicação
- chama modelo de IA
- executa workflow
- grava memória
- grava decisões
- depende de Hermes
- substitui o runtime atual

O próximo estágio deve ser um composition root controlado que injete o `TenantOperationalContextPort` no Intelligence Runtime e aplique política/autorização antes de solicitar qualquer fatia operacional.
