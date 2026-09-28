"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
const iniciais=["Infraestrutura","Software","IA","Marketing","Serviços","Energia","Telecom","Contabilidade","Impostos","Outros"];
export default function Page(){const [itens,setItens]=useState(iniciais);const [novo,setNovo]=useState("");const add=()=>{const v=novo.trim();if(v&&!itens.includes(v)){setItens([...itens,v]);setNovo("")}};return <div className="flex h-full flex-col gap-6 p-6"><header><h1 className="text-2xl font-semibold tracking-tight">Categorias</h1><p className="text-sm text-muted-foreground">Categorias financeiras próprias de cada organização. Alterações ficam somente no estado local.</p></header><Card className="p-4"><div className="flex flex-col gap-2 sm:flex-row"><Input value={novo} onChange={e=>setNovo(e.target.value)} placeholder="Nome da nova categoria"/><Button onClick={add}>Nova categoria</Button></div></Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{itens.map(x=><Card key={x} className="flex items-center justify-between gap-3 p-4"><span className="text-sm font-medium">{x}</span><Button size="sm" variant="ghost" onClick={()=>setItens(itens.filter(i=>i!==x))}>Remover</Button></Card>)}</div></div>}
