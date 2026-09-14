# Coagentica Native Intelligence Runtime v0.5

## Objetivo

A v0.5 estabelece o runtime nativo e puro de Intelligence da Coagentica. Ele coordena autorização, leitura de contexto operacional, execução de capability e persistência de decisões sem depender estruturalmente de Hermes, Deskcomm, Supabase, Tenant Runtime ou SDKs de IA.

## Fluxo canônico

```text
IntelligenceRequest
  -> PolicyGatePort.authorize()
     -> deny/defer: DecisionRecord -> DecisionStorePort
     -> allow:
        -> seleção operacional autorizada
        -> TenantOperationalContextPort (somente quando necessário)
        -> write-ahead DecisionRecord de autorização
        -> CapabilityExecutorPort.execute()
        -> DecisionRecord de outcome
        -> DecisionStorePort
```

## Invariantes

- policy gate roda antes de qualquer leitura operacional;
- `request.policyDecision` fornecido pelo caller nunca substitui o gate;
- deny/defer não carrega contexto e não executa capability;
- contexto só é carregado quando a policy autoriza uma seleção;
- contexto retornado é revalidado por `tenantId` e `organizationId`;
- `tenantId === organizationId` é o binding canônico desta fase;
- actor e request precisam pertencer ao mesmo tenant/organization;
- identidade malformada falha antes de qualquer side effect;
- autorização `allow` é persistida antes de chamar qualquer executor com side effect;
- falha de persistência da autorização impede execução;
- falha de persistência do outcome após execução gera `DecisionPersistenceError` contendo o `DecisionRecord` e a `CapabilityInvocation` para reconciliação;
- falha de policy/contexto vira `defer` fail-closed;
- falha do executor vira `escalate` fail-closed;
- o runtime não conhece adapters, Hermes, Supabase, Deskcomm, Tenant Runtime, Operations Kernel ou SDKs de IA;
- o barrel canônico `coagentica/intelligence/index.ts` não re-exporta adapters.

## Ports

- `PolicyGatePort`
- `TenantOperationalContextPort`
- `CapabilityExecutorPort`
- `DecisionStorePort`

Implementações concretas vivem fora do runtime e são injetadas por composition roots futuros.

## Hermes

Hermes permanece somente como adapter opcional. O runtime v0.5 não importa, referencia ou requer Hermes para funcionar.

## Persistência write-ahead

O caminho `allow` grava primeiro:

```text
<requestId>-authorization
```

Somente após essa gravação o executor é chamado. O resultado final usa:

```text
<requestId>-decision
```

Isso reduz o risco de side effects sem trilha de autorização.

## Escopo

A v0.5 ainda não conecta o runtime ao hot path da aplicação. Ela entrega a capacidade arquitetural nativa, testada e pronta para composição posterior.

Não inclui:
- chamada real de modelo de IA;
- provider/model gateway;
- agente autônomo;
- migrations;
- alterações no fluxo WhatsApp;
- remoção física do adapter Hermes.

## Validação

Checkpoint de construção:

- TypeScript typecheck: PASS
- ESLint: PASS
- suíte Coagentica: 34 arquivos de teste
- testes: 460/460 PASS
- revisão independente: 9/9 PASS
- BLOCKER: 0
- HIGH: 0
- MEDIUM: 0
