import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Linha = Record<string, string>;

export function FinanceiroTable({ colunas, linhas }: { colunas: Array<{ chave: string; label: string }>; linhas: Linha[] }) {
  return (
    <>
    <div className="grid gap-3 md:hidden">
      {linhas.map((linha, index) => <Card key={`${linha.descricao ?? "linha"}-mobile-${index}`} className="p-4"><div className="grid gap-2">{colunas.map(coluna => <div key={coluna.chave} className="flex items-start justify-between gap-4"><span className="text-xs text-muted-foreground">{coluna.label}</span><span className={coluna.chave === "valor" ? "text-right text-sm font-medium tabular-nums" : "text-right text-sm"}>{coluna.chave === "status" ? <Badge variant="outline">{linha[coluna.chave]}</Badge> : linha[coluna.chave]}</span></div>)}</div></Card>)}
    </div>
    <Card className="hidden overflow-hidden md:block">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {colunas.map((coluna) => <TableHead key={coluna.chave}>{coluna.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha, index) => (
              <TableRow key={`${linha.descricao ?? "linha"}-${index}`}>
                {colunas.map((coluna) => (
                  <TableCell key={coluna.chave} className={coluna.chave === "valor" ? "font-medium tabular-nums" : ""}>
                    {coluna.chave === "status" ? <Badge variant="outline">{linha[coluna.chave]}</Badge> : linha[coluna.chave]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
    </>
  );
}
