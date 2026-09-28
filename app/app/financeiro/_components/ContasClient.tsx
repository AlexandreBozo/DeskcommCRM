"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FinanceiroTable } from "./FinanceiroTable";

type Linha = Record<string, string>;
export function ContasClient({ filtros, colunas, linhas, placeholder }: { filtros: string[]; colunas: Array<{ chave: string; label: string }>; linhas: Linha[]; placeholder: string }) {
  const [filtro, setFiltro] = useState(filtros[0]);
  const [busca, setBusca] = useState("");
  const visiveis = useMemo(() => linhas.filter((linha) => {
    const texto = Object.values(linha).join(" ").toLocaleLowerCase("pt-BR");
    const bateBusca = texto.includes(busca.toLocaleLowerCase("pt-BR"));
    const bateFiltro = filtro === filtros[0] || (filtro === "Atrasadas" && linha.status === "Atrasado") || (filtro === "Hoje" && linha.vencimento === "24/09/2026") || (filtro === "Próximos 7 dias" && linha.status !== "Pago") || (filtro === "Este mês" && linha.competencia === "09/2026") || linha.status === filtro;
    return bateBusca && bateFiltro;
  }), [busca, filtro, filtros, linhas]);
  return <>
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{filtros.map((item) => <Button key={item} size="sm" variant={filtro === item ? "default" : "outline"} onClick={() => setFiltro(item)}>{item}</Button>)}</div><Input className="lg:max-w-xs" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder={placeholder} aria-label={placeholder} /></div>
    {visiveis.length ? <FinanceiroTable colunas={colunas} linhas={visiveis} /> : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum item encontrado para os filtros selecionados.</div>}
  </>;
}
