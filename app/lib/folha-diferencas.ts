/**
 * Compara os salários pagos de cada funcionário entre dois meses civis.
 * Usa UTC porque as datas de salário são gravadas como meia-noite UTC.
 */

/** Diferenças abaixo de meio centavo são ruído de ponto flutuante. */
const TOLERANCIA = 0.005;

export type MesCivil = { ano: number; mes: number };

type FolhaComSalarios = {
	id: string;
	nome: string;
	funcao: string;
	salarios?:
		| {
				data?: Date | string | null;
				valor?: number | null;
				pago?: boolean | null;
		  }[]
		| null;
};

export type DiferencaSalario = {
	id: string;
	nome: string;
	funcao: string;
	valorAnterior: number;
	valorAtual: number;
	diferenca: number;
	percentual: number;
};

export type ComparacaoSalarios = {
	/** Maiores diferenças em valor absoluto, da maior para a menor. */
	maiores: DiferencaSalario[];
	/** Quem recebeu em só um dos meses: não há diferença real a comparar. */
	semPagamentoNoAnterior: string[];
	semPagamentoNoAtual: string[];
};

/** Mês civil `mesesAtras` meses antes de `hoje`. */
export function mesCivilAnterior(mesesAtras: number, hoje = new Date()): MesCivil {
	const d = new Date(
		Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - mesesAtras, 1),
	);
	return { ano: d.getUTCFullYear(), mes: d.getUTCMonth() };
}

function somaPagaNoMes(
	salarios: FolhaComSalarios["salarios"],
	{ ano, mes }: MesCivil,
): number {
	return (salarios ?? []).reduce((total, sal) => {
		if (sal.pago !== true || sal.valor == null || !sal.data) return total;
		const d = new Date(sal.data);
		return d.getUTCFullYear() === ano && d.getUTCMonth() === mes
			? total + sal.valor
			: total;
	}, 0);
}

export function compararSalariosEntreMeses(
	folhas: FolhaComSalarios[],
	anterior: MesCivil,
	atual: MesCivil,
	limite = 10,
): ComparacaoSalarios {
	const diferencas: DiferencaSalario[] = [];
	const semPagamentoNoAnterior: string[] = [];
	const semPagamentoNoAtual: string[] = [];

	for (const folha of folhas) {
		const valorAnterior = somaPagaNoMes(folha.salarios, anterior);
		const valorAtual = somaPagaNoMes(folha.salarios, atual);

		if (valorAnterior <= 0 && valorAtual <= 0) continue;
		if (valorAnterior <= 0) {
			semPagamentoNoAnterior.push(folha.nome);
			continue;
		}
		if (valorAtual <= 0) {
			semPagamentoNoAtual.push(folha.nome);
			continue;
		}

		const diferenca = valorAtual - valorAnterior;
		if (Math.abs(diferenca) < TOLERANCIA) continue;

		diferencas.push({
			id: folha.id,
			nome: folha.nome,
			funcao: folha.funcao,
			valorAnterior,
			valorAtual,
			diferenca,
			percentual: (diferenca / valorAnterior) * 100,
		});
	}

	return {
		maiores: diferencas
			.sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca))
			.slice(0, limite),
		semPagamentoNoAnterior,
		semPagamentoNoAtual,
	};
}
