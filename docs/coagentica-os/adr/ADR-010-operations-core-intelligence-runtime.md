# ADR-010 — Operations Core por tenant e Intelligence Runtime compartilhado

**Status:** Aceito
**Data:** 2026-09-13

## Contexto

A Coagentica precisa suportar empresas com processos, conhecimento, regras e inteligência operacional diferentes sem manter implementações específicas por cliente.

O projeto também possui capacidades valiosas no Hermes e no Deskcomm. Tornar qualquer um deles dependência estrutural criaria acoplamento permanente e obrigaria a plataforma a evoluir por remendos e adapters sucessivos.

## Decisão

A Coagentica adota:

1. um `Operations Core` lógico e isolado por tenant;
2. um `Intelligence Runtime` compartilhado entre tenants;
3. contratos canônicos independentes do Deskcomm, Hermes e providers;
4. Hermes como adapter opcional de compatibilidade/transição;
5. Deskcomm como implementação operacional acessada por adapters, não como domínio canônico.

O motor é compartilhado. Estado, memória, regras, contexto, conhecimento e aprendizado operacional pertencem ao tenant.

## Direção de dependência

Permitido:

```text
Deskcomm / Hermes / integrações
          ↓
        adapters
          ↓
contratos canônicos da Coagentica
```

Proibido:

```text
Operations Core -> Deskcomm
Intelligence Core -> Hermes
Operations Core -> provider de IA
```

## Consequências

### Positivas

- possibilidade de substituir Deskcomm ou Hermes sem reescrever o núcleo;
- isolamento claro entre tenants;
- evolução de IA independente dos módulos de CRM/ERP;
- uma única arquitetura para odontologia, varejo, serviços e futuros segmentos;
- absorção gradual das capacidades do Hermes sem big-bang rewrite.

### Custos

- adapters explícitos durante a transição;
- disciplina de contratos e testes de fronteira;
- necessidade de diferenciar estado operacional do tenant e runtime compartilhado;
- duplicidade temporária de aliases legados durante migração.

## Guardrails

A CI deve falhar se:

- `operations-core/contracts` importar módulos de `@/lib`;
- `intelligence` importar Hermes fora do adapter autorizado;
- novos módulos dependerem diretamente de aliases `business-engine` ou `intelligence-core`;
- for introduzido estado global mutável contendo estado de tenant.

## Resultado esperado

A Coagentica deve conseguir executar um tenant completo sem Hermes. Hermes pode continuar conectado e útil, mas sua ausência não pode impedir o funcionamento estrutural da plataforma.
