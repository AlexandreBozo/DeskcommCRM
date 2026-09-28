"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useT } from "@/hooks/i18n/useT";
import { rotuloDoIndicador } from "@/lib/plataformas-de-anuncio/meta/tabela-de-campanhas";
import type { LinhaDeCampanha } from "@/lib/plataformas-de-anuncio/types";

/**
 * As 14 colunas.
 *
 * ─── A regra que atravessa o arquivo inteiro: ausência vira "—" ─────────────
 *
 * Nenhum `?? 0` aqui. Campanha que não veiculou volta da plataforma sem `cpm`,
 * sem `ctr` e sem `cpc`, e campanha sem vídeo volta sem as métricas de vídeo —
 * quatro das sete campanhas da conta sondada estavam no primeiro caso. Escrever
 * "0,00%" onde não houve medição é uma afirmação falsa com aparência de dado, e
 * quem lê não tem como distinguir de um zero real. "—" é a verdade e não custa
 * nada.
 */

/**
 * `effective_status` → português.
 *
 * O vocabulário é da plataforma e vale a pena traduzir por inteiro: os valores
 * compostos (`CAMPAIGN_PAUSED`, `ADSET_PAUSED`) são justamente os que explicam
 * por que uma campanha "ativa" não está entregando, que é a pergunta que traz
 * alguém a esta tela.
 */
const ESTADO_LEGIVEL: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  DELETED: "Excluída",
  ARCHIVED: "Arquivada",
  IN_PROCESS: "Em processamento",
  WITH_ISSUES: "Com problemas",
  CAMPAIGN_PAUSED: "Campanha pausada",
  ADSET_PAUSED: "Conjunto pausado",
  DISAPPROVED: "Reprovada",
  PENDING_REVIEW: "Em análise",
  PREAPPROVED: "Pré-aprovada",
  PENDING_BILLING_INFO: "Aguardando dados de cobrança",
};

/** Verde só para quem está realmente entregando; âmbar para o que pede atenção. */
const TOM_DO_ESTADO: Record<string, string> = {
  ACTIVE: "text-emerald-600 dark:text-emerald-400",
  WITH_ISSUES: "text-amber-600 dark:text-amber-400",
  DISAPPROVED: "text-red-600 dark:text-red-400",
  PENDING_BILLING_INFO: "text-amber-600 dark:text-amber-400",
  PENDING_REVIEW: "text-amber-600 dark:text-amber-400",
};

const TRACO = "—";

const COLUNAS_CONFIGURAVEIS = [
  { id: "status", rotulo: "Status" },
  { id: "veiculacao", rotulo: "Veiculação" },
  { id: "resultado", rotulo: "Resultado" },
  { id: "custoResultado", rotulo: "Custo por Resultado" },
  { id: "gasto", rotulo: "Valor Gasto" },
  { id: "impressoes", rotulo: "Impressões" },
  { id: "alcance", rotulo: "Alcance" },
  { id: "cpm", rotulo: "CPM" },
  { id: "ctr", rotulo: "CTR" },
  { id: "frequencia", rotulo: "Frequência" },
  { id: "cpc", rotulo: "CPC" },
  { id: "hookRate", rotulo: "Hook Rate" },
  { id: "thruPlays", rotulo: "ThruPlays" },
] as const;

type ColunaConfiguravel = (typeof COLUNAS_CONFIGURAVEIS)[number]["id"];
const TODAS_AS_COLUNAS = COLUNAS_CONFIGURAVEIS.map((coluna) => coluna.id);
const COLUNAS_ESSENCIAIS: ColunaConfiguravel[] = [
  "status",
  "veiculacao",
  "resultado",
  "custoResultado",
  "gasto",
  "impressoes",
  "alcance",
  "ctr",
  "cpc",
];
const CHAVE_COLUNAS = "coagentica.meta-ads.colunas.v1";

function Numero({ valor, casas = 0 }: { valor: number | null; casas?: number }) {
  if (valor === null) return <span className="text-muted-foreground">{TRACO}</span>;
  return (
    <>
      {valor.toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      })}
    </>
  );
}

function Percentual({ valor, casas = 2 }: { valor: number | null; casas?: number }) {
  if (valor === null) return <span className="text-muted-foreground">{TRACO}</span>;
  return (
    <>
      {valor.toLocaleString("pt-BR", {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas,
      })}
      %
    </>
  );
}

interface Props {
  linhas: LinhaDeCampanha[];
  /**
   * A moeda da CONTA, não a da instalação.
   *
   * Um token pode alcançar conta em USD e conta em BRL ao mesmo tempo. Formatar
   * tudo em real mostraria "R$ 364,63" para um gasto que foi em dólar — número
   * errado com aparência de certo, que é o pior erro possível numa tela de
   * custo. Vem de `/me/adaccounts`, por conta.
   */
  moeda: string;
}

export function TabelaDeCampanhas({ linhas, moeda }: Props) {
  const t = useT();
  const [colunasVisiveis, setColunasVisiveis] = useState<Set<ColunaConfiguravel>>(
    () => new Set(TODAS_AS_COLUNAS),
  );

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(CHAVE_COLUNAS);
      if (!salvo) return;
      const ids = JSON.parse(salvo) as string[];
      const validos = ids.filter((id): id is ColunaConfiguravel =>
        TODAS_AS_COLUNAS.includes(id as ColunaConfiguravel),
      );
      queueMicrotask(() => setColunasVisiveis(new Set(validos)));
    } catch {
      // Preferência local inválida não deve impedir a leitura das campanhas.
    }
  }, []);

  const aplicarColunas = (ids: ColunaConfiguravel[]) => {
    const proximo = new Set(ids);
    setColunasVisiveis(proximo);
    try {
      window.localStorage.setItem(CHAVE_COLUNAS, JSON.stringify([...proximo]));
    } catch {
      // O seletor continua funcional mesmo quando o navegador bloqueia storage.
    }
  };

  const alternarColuna = (id: ColunaConfiguravel, marcada: boolean) => {
    const proximo = new Set(colunasVisiveis);
    if (marcada) proximo.add(id);
    else proximo.delete(id);
    aplicarColunas([...proximo]);
  };

  const visivel = (id: ColunaConfiguravel) => colunasVisiveis.has(id);

  const dinheiro = (valor: number | null, casas = 2) => {
    if (valor === null) return <span className="text-muted-foreground">{TRACO}</span>;
    return (
      <>
        {valor.toLocaleString("pt-BR", {
          style: "currency",
          currency: moeda,
          minimumFractionDigits: casas,
          maximumFractionDigits: casas,
        })}
      </>
    );
  };

  const estado = (valor: string | null) => {
    if (!valor) return <span className="text-muted-foreground">{TRACO}</span>;
    return <span className={TOM_DO_ESTADO[valor] ?? ""}>{t(ESTADO_LEGIVEL[valor] ?? valor)}</span>;
  };

  if (linhas.length === 0) {
    return (
      <p className="rounded-md border p-4 text-sm text-muted-foreground">
        {/*
          Vazio tem duas causas opostas e dizer só "nenhuma campanha" esconderia
          a segunda: ou a conta não tem campanha nenhuma, ou tem e nenhuma delas
          existia no período escolhido. A segunda se resolve mudando o período,
          e quem não souber disso vai concluir que a integração está quebrada.
        */}
        {t(
          "Nenhuma campanha neste período. Ou a conta ainda não tem campanhas, ou elas foram criadas depois da data escolhida.",
        )}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {t("Campanha")} + {colunasVisiveis.size} {t("colunas visíveis")}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              {t("Colunas")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>{t("Colunas da tabela")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem checked disabled>
              {t("Campanha")}
            </DropdownMenuCheckboxItem>
            {COLUNAS_CONFIGURAVEIS.map((coluna) => (
              <DropdownMenuCheckboxItem
                key={coluna.id}
                checked={visivel(coluna.id)}
                onCheckedChange={(marcada) => alternarColuna(coluna.id, marcada === true)}
                onSelect={(event) => event.preventDefault()}
              >
                {t(coluna.rotulo)}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => aplicarColunas(COLUNAS_ESSENCIAIS)}>
              {t("Mostrar essenciais")}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => aplicarColunas([...TODAS_AS_COLUNAS])}>
              {t("Mostrar todas")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-bg">{t("Campanha")}</TableHead>
              {visivel("status") && <TableHead>{t("Status")}</TableHead>}
              {visivel("veiculacao") && <TableHead>{t("Veiculação")}</TableHead>}
              {visivel("resultado") && (
                <TableHead className="text-right">{t("Resultado")}</TableHead>
              )}
              {visivel("custoResultado") && (
                <TableHead className="text-right">{t("Custo por Resultado")}</TableHead>
              )}
              {visivel("gasto") && <TableHead className="text-right">{t("Valor Gasto")}</TableHead>}
              {visivel("impressoes") && (
                <TableHead className="text-right">{t("Impressões")}</TableHead>
              )}
              {visivel("alcance") && <TableHead className="text-right">{t("Alcance")}</TableHead>}
              {visivel("cpm") && <TableHead className="text-right">{t("CPM")}</TableHead>}
              {visivel("ctr") && <TableHead className="text-right">{t("CTR")}</TableHead>}
              {visivel("frequencia") && (
                <TableHead className="text-right">{t("Frequência")}</TableHead>
              )}
              {visivel("cpc") && <TableHead className="text-right">{t("CPC")}</TableHead>}
              {/*
              O rótulo diz o numerador de propósito. O Hook Rate de mercado usa
              reproduções de 3 segundos, e esse campo FOI REMOVIDO da v22.0 —
              sobrou o total de reproduções, que dá um número maior. Uma coluna
              "Hook Rate" pelada não bateria com o Gerenciador e não explicaria
              por quê; com o numerador escrito, bate a conta na hora.
            */}
              {visivel("hookRate") && (
                <TableHead className="text-right" title={t("Reproduções de vídeo ÷ impressões")}>
                  {t("Hook Rate")}
                  <span className="ml-1 font-normal text-muted-foreground">
                    {t("(reproduções)")}
                  </span>
                </TableHead>
              )}
              {visivel("thruPlays") && (
                <TableHead className="text-right">{t("ThruPlays")}</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((linha) => {
              const rotulo = rotuloDoIndicador(linha.resultado.indicador);
              return (
                <TableRow key={linha.campanhaId}>
                  <TableCell className="sticky left-0 z-10 max-w-[22rem] bg-bg font-medium">
                    <span className="block truncate" title={linha.nome}>
                      {linha.nome}
                    </span>
                  </TableCell>
                  {visivel("status") && <TableCell>{estado(linha.status)}</TableCell>}
                  {visivel("veiculacao") && <TableCell>{estado(linha.veiculacao)}</TableCell>}
                  {visivel("resultado") && (
                    <TableCell className="text-right">
                      <Numero valor={linha.resultado.valor} />
                      {rotulo && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {t(rotulo)}
                        </span>
                      )}
                    </TableCell>
                  )}
                  {visivel("custoResultado") && (
                    <TableCell className="text-right">
                      {dinheiro(linha.resultado.custoPorResultado)}
                    </TableCell>
                  )}
                  {visivel("gasto") && (
                    <TableCell className="text-right">{dinheiro(linha.gasto)}</TableCell>
                  )}
                  {visivel("impressoes") && (
                    <TableCell className="text-right">
                      <Numero valor={linha.impressoes} />
                    </TableCell>
                  )}
                  {visivel("alcance") && (
                    <TableCell className="text-right">
                      <Numero valor={linha.alcance} />
                    </TableCell>
                  )}
                  {visivel("cpm") && (
                    <TableCell className="text-right">{dinheiro(linha.cpm)}</TableCell>
                  )}
                  {visivel("ctr") && (
                    <TableCell className="text-right">
                      <Percentual valor={linha.ctr} />
                    </TableCell>
                  )}
                  {visivel("frequencia") && (
                    <TableCell className="text-right">
                      <Numero valor={linha.frequencia} casas={2} />
                    </TableCell>
                  )}
                  {visivel("cpc") && (
                    <TableCell className="text-right">{dinheiro(linha.cpc)}</TableCell>
                  )}
                  {visivel("hookRate") && (
                    <TableCell className="text-right">
                      <Percentual valor={linha.hookRate} />
                    </TableCell>
                  )}
                  {visivel("thruPlays") && (
                    <TableCell className="text-right">
                      <Numero valor={linha.thruPlays} />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
