import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  adaptRoleCheckToActorContext,
  adaptRoleCheckToTenantContext,
} from "@/coagentica/foundation/adapters/auth";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";
import { DecisionPersistenceError } from "@/coagentica/intelligence/runtime";
import { createCoagenticaSystemRuntime } from "@/coagentica/modules/system/runtime-composition";

export const dynamic = "force-dynamic";

const runtimeRequestSchema = z.object({
  capability: z.enum([
    "system.runtime.info",
    "tenant.context.summary",
    "tenant.capabilities.list",
  ]),
  input: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "coagentica_runtime",
  });
  if (!authz.ok) return authz.response;

  const runtime = createCoagenticaSystemRuntime(await createClient());
  return ok(
    {
      status: "ready",
      mode: "read_only",
      capabilities: runtime.capabilities,
      tenant_id: authz.org.orgId,
    },
    { requestId }
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("viewer", {
    requestId,
    resource: "coagentica_runtime",
  });
  if (!authz.ok) return authz.response;

  const parsed = runtimeRequestSchema.safeParse(
    await req.json().catch(() => null)
  );
  if (!parsed.success) {
    return fail("validation_failed", "Capability inválida.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const tenantContext = adaptRoleCheckToTenantContext(authz, {
    correlationId: requestId,
  });
  const actorContext = adaptRoleCheckToActorContext(authz, {
    correlationId: requestId,
  });
  if (tenantContext === null || actorContext === null) {
    return fail("forbidden_tenant", "Contexto do tenant indisponível.", 403, {
      requestId,
    });
  }

  const runtime = createCoagenticaSystemRuntime(await createClient());
  const intelligenceRequest = createIntelligenceRequest({
    requestId,
    tenantContext,
    actorContext,
    capability: parsed.data.capability,
    input: parsed.data.input,
    metadata: { surface: "api.v1.ai.runtime" },
  });

  try {
    const result = await runtime.run(intelligenceRequest);
    return ok(
      {
        decision: {
          id: result.decision.decisionId,
          decision: result.decision.decision,
          reason: result.decision.reason,
          capability: result.decision.capability,
          timestamp: result.decision.timestamp,
        },
        invocation:
          result.invocation === null
            ? null
            : {
                id: result.invocation.invocationId,
                capability: result.invocation.capability,
                status: result.invocation.status,
                output: result.invocation.output ?? null,
                error: result.invocation.error ?? null,
              },
      },
      { requestId }
    );
  } catch (error) {
    if (error instanceof DecisionPersistenceError) {
      const persistenceMessage =
        error.originalError instanceof Error
          ? error.originalError.message
          : String(error.originalError);
      console.error("[coagentica.runtime] decision persistence failed", {
        requestId,
        capability: parsed.data.capability,
        phase: error.phase,
        message: persistenceMessage,
      });
      return fail(
        "decision_persistence_failed",
        "A decisão não pôde ser registrada com segurança.",
        503,
        { requestId }
      );
    }
    return fail("internal_error", "Falha ao executar o runtime.", 500, {
      requestId,
    });
  }
}
