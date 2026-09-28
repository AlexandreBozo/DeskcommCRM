export type StatusFinanceiro = "Pendente" | "Pago" | "Vencido" | "Previsto";

export const resumoFinanceiro = [
  { label: "A receber", valor: "R$ 41.780,00", detalhe: "9 recebíveis em aberto" },
  { label: "A pagar", valor: "R$ 28.450,00", detalhe: "12 obrigações em aberto" },
  { label: "Recebido", valor: "R$ 24.300,00", detalhe: "competência atual" },
  { label: "Pago", valor: "R$ 17.820,00", detalhe: "competência atual" },
];
export const previsaoMes = { receitas: "R$ 66.080,00", despesas: "R$ 46.270,00", resultado: "R$ 19.810,00" };

export const contasPagar = [
  { descricao:"Google Ads", vencimento:"25/09/2026", fornecedor:"Google", contrato:"Google Ads", competencia:"09/2026", valor:"R$ 6.500,00", status:"Pendente", origem:"Manual" },
  { descricao:"KVM 1", vencimento:"27/09/2026", fornecedor:"Hostinger", contrato:"KVM 1", competencia:"09/2026", valor:"R$ 1.280,00", status:"Pendente", origem:"Integração" },
  { descricao:"Contabilidade", vencimento:"20/09/2026", fornecedor:"Luiz", contrato:"Contabilidade mensal", competencia:"09/2026", valor:"R$ 1.450,00", status:"Atrasado", origem:"Manual" },
  { descricao:"OpenAI", vencimento:"30/09/2026", fornecedor:"OpenAI", contrato:"API OpenAI", competencia:"09/2026", valor:"R$ 980,00", status:"Previsto", origem:"Manual" },
];

export const contasReceber = [
  { descricao:"Mensalidade CRM", cliente:"Ricardo Quiderole", contrato:"Operação CRM", competencia:"09/2026", vencimento:"24/09/2026", valor:"R$ 4.900,00", status:"Pendente" },
  { descricao:"Automação comercial", cliente:"UP Colchões", contrato:"WhatsApp inteligente", competencia:"09/2026", vencimento:"28/09/2026", valor:"R$ 12.500,00", status:"Previsto" },
  { descricao:"Operação digital", cliente:"Crescer", contrato:"Crescer Saúde", competencia:"09/2026", vencimento:"18/09/2026", valor:"R$ 3.800,00", status:"Pago" },
  { descricao:"Implantação", cliente:"Cliente exemplo", contrato:"Projeto", competencia:"09/2026", vencimento:"15/09/2026", valor:"R$ 2.600,00", status:"Atrasado" },
];

export const fornecedores = [
  { id: "hostinger", nome: "Hostinger", tipo: "Plataforma / Serviço digital", categoria: "Infraestrutura", contratos: 5, ativo: true },
  { id: "openai", nome: "OpenAI", tipo: "Plataforma / Serviço digital", categoria: "IA", contratos: 1, ativo: true },
  { id: "google", nome: "Google", tipo: "Empresa", categoria: "Marketing", contratos: 1, ativo: true },
  { id: "luiz", nome: "Luiz", tipo: "Pessoa", categoria: "Contabilidade", contratos: 1, ativo: true },
];

export const contratos = [
  { fornecedorId:"hostinger", nome:"Business Web Hosting", tipo:"Hospedagem", centro:"Coagentica", valor:"R$ 249,90", recorrencia:"Anual", vencimento:1 },
  { fornecedorId:"hostinger", nome:"KVM 1", tipo:"VPS", centro:"Coagentica", valor:"R$ 1.280,00", recorrencia:"Mensal", vencimento:27 },
  { fornecedorId:"hostinger", nome:"Managed Applications", tipo:"Aplicação", centro:"Coagentica", valor:"R$ 189,90", recorrencia:"Mensal", vencimento:12 },
  { fornecedorId:"hostinger", nome:"Premium Web Hosting", tipo:"Hospedagem", centro:"Ricardo Quiderole", valor:"R$ 199,90", recorrencia:"Anual", vencimento:5 },
  { fornecedorId:"hostinger", nome:".COM.BR Domain", tipo:"Domínio", centro:"Coagentica", valor:"R$ 59,90", recorrencia:"Anual", vencimento:24 },
];

export const faturas = [
  { fornecedorId:"hostinger", competencia:"09/2026", numero:"INV-0926-01", valor:"R$ 1.280,00", vencimento:"27/09/2026", status:"Pendente", origem:"Integração" },
  { fornecedorId:"hostinger", competencia:"08/2026", numero:"INV-0826-01", valor:"R$ 1.280,00", vencimento:"27/08/2026", status:"Paga", origem:"Integração" },
];

export const categorias = ["Infraestrutura", "Software", "IA", "Marketing", "Serviços", "Energia", "Telecom", "Contabilidade", "Impostos", "Outros"];
export const centrosCusto = ["Coagentica", "Ricardo Quiderole", "UP Colchões"];
