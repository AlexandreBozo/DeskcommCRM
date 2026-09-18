export type ActionSideEffect =
  | "none"
  | "local_write"
  | "external_write"
  | "financial";

export interface NativeActionDescriptor {
  readonly sideEffect: ActionSideEffect;
  readonly idempotency: "none" | "required";
  readonly requiresApproval: boolean;
}

export const READ_ONLY_ACTION: NativeActionDescriptor = {
  sideEffect: "none",
  idempotency: "none",
  requiresApproval: false,
};

export function createNativeActionDescriptor(
  params: Partial<NativeActionDescriptor> = {}
): NativeActionDescriptor {
  const sideEffect = params.sideEffect ?? "none";
  const mutating = sideEffect !== "none";
  return {
    sideEffect,
    idempotency: params.idempotency ?? (mutating ? "required" : "none"),
    requiresApproval:
      params.requiresApproval ??
      (sideEffect === "external_write" || sideEffect === "financial"),
  };
}
