"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fornecedores as fornecedoresMock } from "@/lib/financeiro/mock";

type Fornecedor = { id: string; nome: string; tipo: string; categoria: string; contratos: number; ativo: boolean };

export function FornecedoresClient() {
  const [itens, setItens] = useState<Fornecedor[]>(fornecedoresMock);
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("Serviços");
  const [tipoFornecedor, setTipoFornecedor] = useState("Empresa");
  const [status, setStatus] = useState("Ativo");

  function adicionar() {
    const valor = nome.trim();
    if (!valor) return;
    setItens((atuais) => [...atuais, {
      id: `local-${Date.now()}`,
      nome: valor,
      categoria,
      contratos: 0,
      ativo: status === "Ativo",
      tipo: tipoFornecedor,
    }]);
    setNome("");
    setCategoria("Serviços");
    setTipoFornecedor("Empresa");
    setStatus("Ativo");
    setAberto(false);
  }

  return <div className="flex flex-col gap-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Fornecedores</h1><p className="text-sm text-muted-foreground">Cadastros manuais e fornecedores identificados por integrações.</p></div>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogTrigger asChild><Button>+ Novo fornecedor</Button></DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Novo fornecedor</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <label className="grid gap-1 text-sm sm:col-span-2">Nome / Nome fantasia<Input value={nome} onChange={(e)=>setNome(e.target.value)} placeholder="Ex.: Hostinger" /></label>
            <label className="grid gap-1 text-sm">Razão social<Input placeholder="Opcional no mock" /></label>
            <label className="grid gap-1 text-sm">CPF / CNPJ<Input placeholder="Somente cadastro manual" /></label>
            <label className="grid gap-1 text-sm">Tipo de fornecedor<Select value={tipoFornecedor} onValueChange={setTipoFornecedor}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Empresa">Empresa</SelectItem><SelectItem value="Pessoa">Pessoa</SelectItem><SelectItem value="Plataforma / Serviço digital">Plataforma / Serviço digital</SelectItem></SelectContent></Select></label>
            <label className="grid gap-1 text-sm">Categoria<Select value={categoria} onValueChange={setCategoria}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Infraestrutura","Software","IA","Marketing","Serviços","Energia","Telecom","Contabilidade","Impostos","Outros"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></label>
            <label className="grid gap-1 text-sm">Contato principal<Input /></label>
            <label className="grid gap-1 text-sm">Telefone<Input /></label>
            <label className="grid gap-1 text-sm">E-mail<Input type="email" /></label>
            <label className="grid gap-1 text-sm">Site<Input /></label>
            <label className="grid gap-1 text-sm">Status<Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Ativo">Ativo</SelectItem><SelectItem value="Inativo">Inativo</SelectItem></SelectContent></Select></label>
            <label className="grid gap-1 text-sm sm:col-span-2">Observações<Input /></label>
          </div>
          <p className="text-xs text-muted-foreground">Dados mantidos somente nesta sessão. Nenhum endereço, API ou configuração técnica é cadastrada aqui.</p>
          <DialogFooter><Button variant="outline" onClick={()=>setAberto(false)}>Cancelar</Button><Button onClick={adicionar}>Adicionar fornecedor</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
    <Card className="overflow-hidden">
      <div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow><TableHead>Fornecedor</TableHead><TableHead>Origem</TableHead><TableHead>Categoria</TableHead><TableHead>Contratos</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{itens.map(f=><TableRow key={f.id}><TableCell className="font-medium">{f.id.startsWith("local-") ? f.nome : <Link className="hover:underline" href={`/app/financeiro/configuracoes/fornecedores/${f.id}`}>{f.nome}</Link>}</TableCell><TableCell><Badge variant="outline">{f.tipo}</Badge></TableCell><TableCell>{f.categoria}</TableCell><TableCell>{f.contratos}</TableCell><TableCell>{f.ativo?"Ativo":"Inativo"}</TableCell></TableRow>)}</TableBody></Table></div>
      <div className="grid gap-3 p-3 md:hidden">{itens.map(f=><div key={f.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium">{f.nome}</p><p className="text-xs text-muted-foreground">{f.categoria}</p></div><Badge variant="outline">{f.tipo}</Badge></div><p className="mt-3 text-xs text-muted-foreground">{f.contratos} contrato(s) · {f.ativo?"Ativo":"Inativo"}</p></div>)}</div>
    </Card>
    <p className="text-xs text-muted-foreground">Cadastro manual e integração permanecem separados. Endereço não faz parte do MVP; contratos e faturas ficam centralizados no fornecedor.</p>
  </div>;
}
