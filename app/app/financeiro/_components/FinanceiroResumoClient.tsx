"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { previsaoMes, resumoFinanceiro } from "@/lib/financeiro/mock";

const competencias = ["Agosto 2026", "Setembro 2026", "Outubro 2026"];

export function FinanceiroResumoClient() {
  const [indice, setIndice] = useState(1);
  return <>
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1><p className="text-sm text-muted-foreground">Visão operacional da competência, sem saldo bancário ou movimentações.</p></div>
      <div className="flex items-center gap-1 rounded-md border p-1"><Button variant="ghost" size="icon" aria-label="Competência anterior" disabled={indice === 0} onClick={() => setIndice((atual) => atual - 1)}><ChevronLeft className="h-4 w-4" /></Button><span aria-live="polite" className="min-w-32 text-center text-sm font-medium">{competencias[indice]}</span><Button variant="ghost" size="icon" aria-label="Próxima competência" disabled={indice === competencias.length - 1} onClick={() => setIndice((atual) => atual + 1)}><ChevronRight className="h-4 w-4" /></Button></div>
    </header>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{resumoFinanceiro.map((item) => <Card key={item.label} className="p-4"><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{item.valor}</p><p className="mt-1 text-xs text-muted-foreground">{item.detalhe}</p></Card>)}</section>
    <Card className="p-5"><h2 className="font-semibold">Previsão do mês</h2><p className="mb-4 text-sm text-muted-foreground">Compromissos conhecidos da competência selecionada.</p><div className="grid gap-3 sm:grid-cols-3">{[["Receitas previstas", previsaoMes.receitas], ["Despesas previstas", previsaoMes.despesas], ["Resultado previsto", previsaoMes.resultado]].map(([label, valor]) => <div key={label} className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p></div>)}</div></Card>
  </>;
}
