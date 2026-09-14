import { NavHub } from "@/components/shell/NavHub";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";

import { RuntimePanel } from "./_components/RuntimePanel";

export const dynamic = "force-dynamic";

/**
 * Hub da área de IA.
 *
 * Substitui as abas que só apareciam para quem JÁ estava dentro de `/app/ai/*`:
 * Conhecimento, Credenciais, Uso, Casos e Alertas eram invisíveis de qualquer
 * outro lugar do sistema. Aqui as dez telas aparecem juntas, na jornada de quem
 * opera um agente — montar, ensinar, acompanhar.
 */
export default async function AiHubPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <NavHub
        group="ia"
        isPlatformAdmin={user.is_platform_admin && !user.support}
        role={activeOrg?.role ?? null}
        interfaceSettings={activeOrg?.interface_settings}
        title="Agente de IA"
        subtitle="Tudo que define quem atende por você — e como acompanhar o que ele faz."
      />
      <RuntimePanel />
    </div>
  );
}
