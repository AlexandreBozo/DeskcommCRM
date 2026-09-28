import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { requireAuth } from "@/lib/auth/server";
import { contratos, faturas, fornecedores } from "@/lib/financeiro/mock";
import { FornecedorDetalheClient } from "./FornecedorDetalheClient";
export const dynamic = "force-dynamic";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { await requireAuth(); const { id } = await params; const fornecedor = fornecedores.find((item) => item.id === id); if (!fornecedor) notFound(); return <div className="flex h-full flex-col gap-6 p-6"><header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><Link href="/app/financeiro/configuracoes/fornecedores" className="text-xs text-muted-foreground hover:underline">← Fornecedores</Link><h1 className="mt-2 text-2xl font-semibold tracking-tight">{fornecedor.nome}</h1><p className="text-sm text-muted-foreground">{fornecedor.categoria} · {fornecedor.tipo}</p></div><Badge variant="outline">{fornecedor.ativo ? "Ativo" : "Inativo"}</Badge></header><FornecedorDetalheClient fornecedor={fornecedor} contratosIniciais={contratos.filter((item) => item.fornecedorId === fornecedor.id)} faturasIniciais={faturas.filter((item) => item.fornecedorId === fornecedor.id)} /></div>; }
