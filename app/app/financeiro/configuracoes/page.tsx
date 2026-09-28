import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireAuth } from "@/lib/auth/server";
import { Buildings, Gauge, Plugs, Tag } from "@/lib/ui/icons";

export const dynamic = "force-dynamic";

const itens = [
  { href: "/app/financeiro/configuracoes/fornecedores", label: "Fornecedores", description: "Cadastro manual e fornecedores vindos de integrações.", icon: Buildings },
  { href: "/app/financeiro/configuracoes/categorias", label: "Categorias", description: "Classificação dos lançamentos financeiros.", icon: Tag },
  { href: "/app/financeiro/configuracoes/centros-custo", label: "Centros de custo", description: "Estrutura para identificar onde cada custo acontece.", icon: Gauge },
  { href: "/app/financeiro/configuracoes/integracoes", label: "Integrações", description: "Fontes externas e quais dados financeiros consumir de cada uma.", icon: Plugs },
];

export default async function ConfiguracoesFinanceirasPage() {
  await requireAuth();
  return (
    <div className="flex h-full flex-col gap-8 p-6">
      <header><h1 className="text-2xl font-semibold tracking-tight">Configurações financeiras</h1><p className="text-sm text-muted-foreground">Estruture os cadastros usados pelo financeiro.</p></header>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {itens.map((item) => {
          const Icon = item.icon;
          return <Link href={item.href} key={item.href}><Card className="flex h-full gap-3 p-4 transition-colors hover:border-border-strong"><Icon size={20} className="mt-0.5 shrink-0 text-muted-foreground" /><div><h2 className="text-sm font-semibold">{item.label}</h2><p className="mt-1 text-xs text-muted-foreground">{item.description}</p></div></Card></Link>;
        })}
      </div>
    </div>
  );
}
