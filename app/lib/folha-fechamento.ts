/**
 * Monta a tela de fechamento da folha: uma linha por funcionário com o
 * lançamento do período (salário do mês ou parcela do 13º do ano) e um valor
 * sugerido para lançar. Datas em UTC, como são gravadas no banco.
 */
import {
	ehDecimoTerceiro,
	recebeDecimoTerceiro,
	tipoDoLancamento,
	type TipoLancamento,
} from "~/lib/folha-tipos";

export type MesFechamento = { ano: number; mes: number }; // mes 1–12

type Salario = {
	data?: Date | string | null;
	valor?: number | null;
	pago?: boolean | null;
	tipo?: string | null;
};

type FolhaComSalarios = {
	id: string;
	nome: string;
	funcao: string;
	modalidade: string;
	conta: string;
	salarios?: Salario[] | null;
};

export type LancamentoFechamento = {
	valor: number;
	/** YYYY-MM-DD */
	data: string;
	pago: boolean;
};

export type LinhaFechamento = {
	folhaId: string;
	nome: string;
	funcao: string;
	modalidade: string;
	conta: string;
	/** Salário do mês anterior (salário) ou salário base (13º). */
	referencia: number | null;
	sugestao: number | null;
	lancamento: LancamentoFechamento | null;
};

export type Fechamento = {
	periodo: MesFechamento;
	tipo: TipoLancamento;
	linhas: LinhaFechamento[];
	totais: {
		pago: number;
		aPagar: number;
		pagos: number;
		aPagarQtd: number;
		semLancamento: number;
	};
	/** Intervalo aceito para a data do lançamento (YYYY-MM-DD). */
	dataMin: string;
	dataMax: string;
};

const arredondar = (v: number) => Math.round(v * 100) / 100;

function isoData(d: Date): string {
	return d.toISOString().slice(0, 10);
}

/** Mês corrente no fuso da academia, para o fechamento não virar às 21h. */
export function mesAtualFechamento(hoje = new Date()): MesFechamento {
	const [ano, mes] = new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Sao_Paulo",
		year: "numeric",
		month: "2-digit",
	})
		.format(hoje)
		.split("-")
		.map(Number);
	return { ano, mes };
}

export function hojeFechamento(hoje = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/Sao_Paulo",
	}).format(hoje);
}

/** "2026-11" -> { ano: 2026, mes: 11 }; inválido -> null */
export function parseMesFechamento(valor: string | null): MesFechamento | null {
	const match = valor?.match(/^(\d{4})-(\d{2})$/);
	if (!match) return null;
	const ano = Number(match[1]);
	const mes = Number(match[2]);
	if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) return null;
	return { ano, mes };
}

export function formatarMesFechamento({ ano, mes }: MesFechamento): string {
	return `${ano}-${String(mes).padStart(2, "0")}`;
}

export function deslocarMes(
	{ ano, mes }: MesFechamento,
	delta: number,
): MesFechamento {
	const d = new Date(Date.UTC(ano, mes - 1 + delta, 1));
	return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 };
}

/** O salário vale para o mês; o 13º, para o ano inteiro. */
export function limitesDoPeriodo(
	tipo: TipoLancamento,
	{ ano, mes }: MesFechamento,
): { dataMin: string; dataMax: string } {
	if (ehDecimoTerceiro(tipo)) {
		return { dataMin: `${ano}-01-01`, dataMax: `${ano}-12-31` };
	}
	return {
		dataMin: isoData(new Date(Date.UTC(ano, mes - 1, 1))),
		dataMax: isoData(new Date(Date.UTC(ano, mes, 0))),
	};
}

/** Lançamento de `tipo` cuja data cai no período (mês ou ano, conforme o tipo). */
export function lancamentoNoPeriodo(
	sal: Salario,
	tipo: TipoLancamento,
	{ ano, mes }: MesFechamento,
): boolean {
	if (!sal.data || sal.valor == null) return false;
	if (tipoDoLancamento(sal.tipo) !== tipo) return false;
	const d = new Date(sal.data);
	if (d.getUTCFullYear() !== ano) return false;
	return ehDecimoTerceiro(tipo) || d.getUTCMonth() + 1 === mes;
}

function somaPaga(salarios: Salario[], tipo: TipoLancamento, periodo: MesFechamento) {
	return salarios.reduce(
		(acc, s) =>
			s.pago === true && lancamentoNoPeriodo(s, tipo, periodo)
				? acc + (s.valor ?? 0)
				: acc,
		0,
	);
}

/** Salário mais recente até o fim do mês do fechamento (pago ou a pagar). */
function salarioBase(salarios: Salario[], { ano, mes }: MesFechamento): number | null {
	const limite = Date.UTC(ano, mes, 0, 23, 59, 59);
	const candidato = salarios
		.filter(
			(s) =>
				s.data &&
				s.valor != null &&
				s.valor > 0 &&
				tipoDoLancamento(s.tipo) === "salario" &&
				new Date(s.data).getTime() <= limite,
		)
		.sort((a, b) => new Date(b.data!).getTime() - new Date(a.data!).getTime())[0];
	return candidato?.valor ?? null;
}

function montarLinha(
	folha: FolhaComSalarios,
	tipo: TipoLancamento,
	periodo: MesFechamento,
): LinhaFechamento {
	const salarios = folha.salarios ?? [];
	const doPeriodo = salarios.filter((s) => lancamentoNoPeriodo(s, tipo, periodo));
	const lancamento: LancamentoFechamento | null =
		doPeriodo.length > 0
			? {
					valor: arredondar(doPeriodo.reduce((acc, s) => acc + (s.valor ?? 0), 0)),
					data: isoData(new Date(doPeriodo[0].data!)),
					pago: doPeriodo.every((s) => s.pago === true),
				}
			: null;

	let referencia: number | null;
	let sugestao: number | null;
	if (tipo === "salario") {
		const anterior = somaPaga(salarios, "salario", deslocarMes(periodo, -1));
		referencia = anterior > 0 ? arredondar(anterior) : null;
		sugestao = referencia;
	} else {
		referencia = salarioBase(salarios, periodo);
		if (referencia == null) {
			sugestao = null;
		} else if (tipo === "decimo_1") {
			sugestao = arredondar(referencia / 2);
		} else {
			const primeira = somaPaga(salarios, "decimo_1", periodo);
			sugestao = arredondar(primeira > 0 ? referencia - primeira : referencia);
		}
	}

	return {
		folhaId: folha.id,
		nome: folha.nome,
		funcao: folha.funcao,
		modalidade: folha.modalidade,
		conta: folha.conta,
		referencia,
		sugestao: lancamento?.valor ?? sugestao,
		lancamento,
	};
}

export function montarFechamento(
	folhas: FolhaComSalarios[],
	tipo: TipoLancamento,
	periodo: MesFechamento,
): Fechamento {
	const linhas = folhas
		.filter(
			(f) =>
				!ehDecimoTerceiro(tipo) ||
				recebeDecimoTerceiro(f.funcao) ||
				// Quem já tem lançamento aparece mesmo sem direito, para não sumir.
				(f.salarios ?? []).some((s) => lancamentoNoPeriodo(s, tipo, periodo)),
		)
		.map((f) => montarLinha(f, tipo, periodo))
		.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

	const totais = { pago: 0, aPagar: 0, pagos: 0, aPagarQtd: 0, semLancamento: 0 };
	for (const linha of linhas) {
		if (!linha.lancamento) totais.semLancamento++;
		else if (linha.lancamento.pago) {
			totais.pagos++;
			totais.pago += linha.lancamento.valor;
		} else {
			totais.aPagarQtd++;
			totais.aPagar += linha.lancamento.valor;
		}
	}
	totais.pago = arredondar(totais.pago);
	totais.aPagar = arredondar(totais.aPagar);

	return { periodo, tipo, linhas, totais, ...limitesDoPeriodo(tipo, periodo) };
}
