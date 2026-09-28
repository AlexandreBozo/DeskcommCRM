"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Contrato = { fornecedorId: string; nome: string; tipo: string; centro: string; valor: string; recorrencia: string; vencimento: number };
type Fatura = { fornecedorId: string; competencia: string; numero: string; valor: string; vencimento: string; status: string; origem: string };
type Fornecedor = { id: string; nome: string; tipo: string; categoria: string; ativo: boolean };
export function FornecedorDetalheClient({ fornecedor, contratosIniciais, faturasIniciais }: { fornecedor: Fornecedor; contratosIniciais: Contrato[]; faturasIniciais: Fatura[] }) {
  const [contratos, setContratos] = useState(contratosIniciais);
  const [faturas, setFaturas] = useState(faturasIniciais);
  const [dialogo, setDialogo] = useState<"contrato" | "fatura" | null>(null);
  const [nomeContrato, setNomeContrato] = useState("");
  const [valorContrato, setValorContrato] = useState("");
  const [numeroFatura, setNumeroFatura] = useState("");
  const [valorFatura, setValorFatura] = useState("");
  function adicionarContrato() { if (!nomeContrato.trim() || !valorContrato.trim()) return; setContratos((atuais) => [...atuais, { fornecedorId: fornecedor.id, nome: nomeContrato.trim(), tipo: "Serviço", centro: "Coagentica", valor: valorContrato.trim(), recorrencia: "Mensal", vencimento: 10 }]); setNomeContrato(""); setValorContrato(""); setDialogo(null); }
  function adicionarFatura() { if (!numeroFatura.trim() || !valorFatura.trim()) return; setFaturas((atuais) => [...atuais, { fornecedorId: fornecedor.id, competencia: "09/2026", numero: numeroFatura.trim(), valor: valorFatura.trim(), vencimento: "30/09/2026", status: "Pendente", origem: "Manual" }]); setNumeroFatura(""); setValorFatura(""); setDialogo(null); }
  return <>
    <Tabs defaultValue="dados"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="dados">Dados</TabsTrigger><TabsTrigger value="contratos">Contratos ({contratos.length})</TabsTrigger><TabsTrigger value="faturas">Faturas ({faturas.length})</TabsTrigger></TabsList>
      <TabsContent value="dados"><Card className="mt-4 p-5"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[["Nome / Nome fantasia", fornecedor.nome], ["Categoria", fornecedor.categoria], ["Tipo de fornecedor", fornecedor.tipo], ["Status", fornecedor.ativo ? "Ativo" : "Inativo"], ["Origem do cadastro", "Entidade financeira"], ["Observações", "Cadastro financeiro separado da configuração técnica de integração."]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>)}</div></Card></TabsContent>
      <TabsContent value="contratos"><div className="mt-4 flex justify-end"><Button onClick={() => setDialogo("contrato")}>+ Novo contrato</Button></div><div className="mt-3 grid gap-3">{contratos.map((contrato) => <Card key={contrato.nome} className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{contrato.nome}</p><p className="text-xs text-muted-foreground">{contrato.tipo} · {contrato.centro} · {contrato.recorrencia}</p></div><div className="text-left sm:text-right"><p className="font-medium tabular-nums">{contrato.valor}</p><p className="text-xs text-muted-foreground">vence dia {contrato.vencimento}</p></div></div></Card>)}</div></TabsContent>
      <TabsContent value="faturas"><div className="mt-4 flex justify-end"><Button onClick={() => setDialogo("fatura")}>+ Nova fatura</Button></div><div className="mt-3 grid gap-3">{faturas.map((fatura) => <Card key={fatura.numero} className="p-4"><div className="grid gap-3 sm:grid-cols-5"><div><p className="text-xs text-muted-foreground">Competência</p><p className="text-sm">{fatura.competencia}</p></div><div><p className="text-xs text-muted-foreground">Fatura</p><p className="text-sm">{fatura.numero}</p></div><div><p className="text-xs text-muted-foreground">Valor</p><p className="text-sm font-medium">{fatura.valor}</p></div><div><p className="text-xs text-muted-foreground">Vencimento</p><p className="text-sm">{fatura.vencimento}</p></div><div><p className="text-xs text-muted-foreground">Status / origem</p><p className="text-sm"><Badge variant="outline">{fatura.status}</Badge> <span className="text-muted-foreground">· {fatura.origem}</span></p></div></div></Card>)}</div></TabsContent>
    </Tabs>
    <Dialog open={dialogo !== null} onOpenChange={(open) => !open && setDialogo(null)}><DialogContent><DialogHeader><DialogTitle>{dialogo === "contrato" ? "Novo contrato" : "Nova fatura"}</DialogTitle></DialogHeader>{dialogo === "contrato" ? <div className="grid gap-4"><label className="grid gap-1 text-sm">Nome do contrato<Input value={nomeContrato} onChange={(event) => setNomeContrato(event.target.value)} /></label><label className="grid gap-1 text-sm">Valor recorrente<Input value={valorContrato} onChange={(event) => setValorContrato(event.target.value)} placeholder="Ex.: R$ 250,00" /></label><p className="text-xs text-muted-foreground">O contrato é mantido apenas nesta sessão e sem campos técnicos de integração.</p></div> : <div className="grid gap-4"><label className="grid gap-1 text-sm">Número da fatura<Input value={numeroFatura} onChange={(event) => setNumeroFatura(event.target.value)} /></label><label className="grid gap-1 text-sm">Valor<Input value={valorFatura} onChange={(event) => setValorFatura(event.target.value)} placeholder="Ex.: R$ 250,00" /></label><p className="text-xs text-muted-foreground">A fatura será criada como Manual e Pendente somente nesta sessão.</p></div>}<DialogFooter><Button variant="outline" onClick={() => setDialogo(null)}>Cancelar</Button><Button onClick={dialogo === "contrato" ? adicionarContrato : adicionarFatura}>{dialogo === "contrato" ? "Adicionar contrato" : "Adicionar fatura"}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
