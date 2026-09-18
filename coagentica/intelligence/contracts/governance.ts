import type { NativeActionDescriptor } from "./native-action";

export type GovernanceDecision = "allow" | "deny" | "approval_required";

export interface GovernanceAssessment {
  readonly decision: GovernanceDecision;
  readonly reason: string;
  readonly version: "v0.19";
  readonly action: NativeActionDescriptor;
  readonly approvalId?: string;
}

export interface HumanApproval {
  readonly approvalId: string;
  readonly requestId: string;
  readonly tenantId: string;
  readonly capability: string;
  readonly approvedBy: string;
  readonly approvedAt: string;
}

export function readHumanApproval(value: unknown): HumanApproval | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const fields = ["approvalId", "requestId", "tenantId", "capability", "approvedBy", "approvedAt"] as const;
  if (fields.some((field) => typeof item[field] !== "string" || (item[field] as string).trim() === "")) {
    return null;
  }
  return item as unknown as HumanApproval;
}
