/** Pré-validação pura. Não cria contas, envia convites ou concede permissões. */
export interface ExistingIdentity {
  id: string;
  email: string;
  isActive: boolean;
  deletedAt: string | null;
}
export interface AuthIdentity { id: string; email?: string }
export function identityProvisioningPreflight(user: ExistingIdentity, authUsers: readonly AuthIdentity[]) {
  if (!user.isActive || user.deletedAt !== null) return { status: "blocked", reason: "inactive_user" } as const;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) {
    return { status: "blocked", reason: "invalid_id" } as const;
  }
  const email = user.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return { status: "blocked", reason: "invalid_email" } as const;
  const byId = authUsers.filter(a => a.id === user.id);
  const byEmail = authUsers.filter(a => a.email?.trim().toLowerCase() === email);
  if (byId.length > 1 || byEmail.length > 1 ||
    byId.some(a => a.email?.trim().toLowerCase() !== email) ||
    byEmail.some(a => a.id !== user.id)) {
    return { status: "blocked", reason: "identity_conflict" } as const;
  }
  if (byId.length === 1) return { status: "already_linked", userId: user.id } as const;
  // O SDK instalado aceita id explícito. Não reconcilia por e-mail nem muda IDs existentes.
  return { status: "ready_for_review", userId: user.id } as const;
}
