"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
const base=[{nome:"Coagentica",tipo:"Interno"},{nome:"Ricardo Quiderole",tipo:"Cliente"},{nome:"UP Colchões",tipo:"Cliente"}];
export default function Page(){const[itens,setItens]=useState(base);const[nome,setNome]=useState("");const[tipo,setTipo]=useState("Interno");const add=()=>{if(nome.trim()){setItens([...itens,{nome:nome.trim(),tipo}]);setNome("")}};return <div className="flex h-full flex-col gap-6 p-6"><header><h1 className="text-2xl font-semibold tracking-tight">Centros de custo</h1><p className="text-sm text-muted-foreground">Organize custos e receitas por estrutura interna, cliente, projeto, departamento ou campanha.</p></header><Card className="p-4"><div className="grid gap-2 sm:grid-cols-[1fr_220px_auto]"><Input value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome do centro"/><Select value={tipo} onValueChange={setTipo}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{["Interno","Cliente","Projeto","Departamento","Campanha"].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select><Button onClick={add}>Novo centro</Button></div></Card><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{itens.map((x,i)=><Card key={`${x.nome}-${i}`} className="flex items-center justify-between p-4"><span className="text-sm font-medium">{x.nome}</span><Badge variant="outline">{x.tipo}</Badge></Card>)}</div></div>}
