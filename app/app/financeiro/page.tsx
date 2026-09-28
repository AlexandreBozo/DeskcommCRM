import { NavHub } from "@/components/shell/NavHub";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { FinanceiroResumoClient } from "./_components/FinanceiroResumoClient";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  return <div className="flex h-full flex-col gap-8 p-6"><FinanceiroResumoClient /><NavHub group="financeiro" isPlatformAdmin={user.is_platform_admin && !user.support} role={activeOrg?.role ?? null} interfaceSettings={activeOrg?.interface_settings} title="Operação financeira" subtitle="Acesse as rotinas e configurações do financeiro." locale={user.idioma} /></div>;
}
