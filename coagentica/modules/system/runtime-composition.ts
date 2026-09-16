import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { IntelligenceRequest } from "@/coagentica/intelligence/contracts";
import {
  runIntelligence,
  type IntelligenceRuntimeResult,
} from "@/coagentica/intelligence/runtime";
import { createNativeExecutor } from "@/coagentica/intelligence/adapters/native-executor";
import { createDirectPlanner } from "@/coagentica/intelligence/adapters/direct-planner";
import { createDeskcommModelGateway } from "@/coagentica/intelligence/adapters/deskcomm-model-gateway";
import { createTenantOperationalContextBridge } from "@/coagentica/intelligence/adapters/tenant-operational-context-bridge";
import { createDefaultIntelligencePolicyGate } from "@/coagentica/intelligence/adapters/default-policy-gate";
import { createDeskcommDecisionStore } from "./decision-store";
import {
  createDeskcommTenantStateSource,
  createSupabaseDeskcommTenantStateQueryPort,
} from "@/coagentica/integrations/deskcomm/tenant-state-source";
import { createSystemNativeCapabilities } from "./native-capabilities";

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value: unknown): string {
  const text = canonicalJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export interface CoagenticaSystemRuntime {
  run(request: IntelligenceRequest): Promise<IntelligenceRuntimeResult>;
  readonly capabilities: readonly string[];
}

export function createCoagenticaSystemRuntime(
  client: SupabaseClient<Database>
): CoagenticaSystemRuntime {
  const query = createSupabaseDeskcommTenantStateQueryPort(client);
  const source = createDeskcommTenantStateSource(query);
  const operationalContext = createTenantOperationalContextBridge(source);
  const policyGate = createDefaultIntelligencePolicyGate();
  const store = createDeskcommDecisionStore(client);
  const modelGateway = createDeskcommModelGateway();
  const planner = createDirectPlanner();
  const handlers = createSystemNativeCapabilities({ modelGateway });
  const executor = createNativeExecutor(handlers);

  return {
    capabilities: handlers.map((handler) => handler.capability),
    async run(request) {
      return runIntelligence(request, {
        policyGate,
        operationalContext,
        planner,
        executor,
        store,
        hashValue,
        now: () => new Date().toISOString(),
      });
    },
  };
}
