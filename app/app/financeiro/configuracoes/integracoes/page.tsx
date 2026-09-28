"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const providers = [
  { nome: "Hostinger", descricao: "Contratos, assinaturas, VPS, domínios e faturas", conta: "Conta principal", capacidades: ["Assinaturas", "VPS", "Hospedagens", "Domínios", "Faturas", "Histórico completo"] },
  { nome: "Meta Ads", descricao: "Contas de anúncio, campanhas, investimento e resultados", conta: "Conta Meta", capacidades: ["Contas de anúncio", "Campanhas", "Investimento", "Resultados", "Criativos"] },
  { nome: "Bling", descricao: "Fornecedores, pedidos, produtos e documentos financeiros", conta: "Conta Bling", capacidades: ["Fornecedores", "Pedidos", "Produtos", "Contas a receber", "Notas fiscais"] },
  { nome: "Pluggy", descricao: "Open Finance, contas, cartões, transações e faturas", conta: "Conexão bancária", capacidades: ["Contas bancárias", "Saldos", "Transações", "Cartões", "Faturas de cartão"] },
];

export default function Page() {
  const [aberto, setAberto] = useState<string | null>(null);
  const [habilitadas, setHabilitadas] = useState<Record<string, boolean>>({});
  return <div className="flex h-full flex-col gap-6 p-6">
    <header><h1 className="text-2xl font-semibold tracking-tight">Integrações financeiras</h1><p className="text-sm text-muted-foreground">Fontes externas de dados. O cadastro do fornecedor continua sendo uma entidade financeira separada.</p></header>
    <div className="grid gap-4 lg:grid-cols-2">{providers.map(p => <Card key={p.nome} className="p-5">
      <div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{p.nome}</h2><Badge variant="outline">Disponível</Badge></div><p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p></div><Button variant="outline" onClick={() => setAberto(aberto === p.nome ? null : p.nome)}>Configurar</Button></div>
      {aberto === p.nome && <div className="mt-5 border-t pt-5"><div className="grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-muted-foreground">Status da conexão</p><p className="font-medium">Mock / não conectada</p></div><div><p className="text-xs text-muted-foreground">Conta / conexão</p><p className="font-medium">{p.conta}</p></div><div><p className="text-xs text-muted-foreground">Última sincronização</p><p className="font-medium">Ainda não sincronizado</p></div></div><h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que consumir</h3><div className="divide-y rounded-lg border">{p.capacidades.map((c, i) => { const key=`${p.nome}:${c}`; const checked=habilitadas[key] ?? i < p.capacidades.length - 1; return <label key={c} className="flex items-center justify-between gap-4 p-3"><span className="text-sm">{c}</span><Switch checked={checked} onCheckedChange={v => setHabilitadas(s => ({...s,[key]:v}))}/></label>})}</div></div>}
    </Card>)}</div>
    <p className="text-xs text-muted-foreground">Configurações apenas em estado local nesta etapa. Nenhuma API ou banco é chamado.</p>
  </div>;
}
