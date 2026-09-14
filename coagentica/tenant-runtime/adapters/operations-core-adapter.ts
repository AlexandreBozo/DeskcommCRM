import type { TenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createTenantOperationsCore } from "../contracts/operations-core";
import type { TenantOperationsCore } from "../contracts/operations-core";

export function adaptTenantContextToOperationsCore(
  tenantContext: TenantContext,
  actorId: string
): TenantOperationsCore {
  return createTenantOperationsCore({
    tenantId: tenantContext.tenantId,
    organizationId: tenantContext.organizationId,
    actorContext: {
      actorId,
      actorType: "human",
      tenantId: tenantContext.tenantId,
      role: tenantContext.role,
      isPlatformAdmin: tenantContext.isPlatformAdmin,
      correlationId: tenantContext.correlationId,
    },
  });
}
