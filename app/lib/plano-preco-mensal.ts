const DURACAO_POR_PALAVRA: [RegExp, number][] = [
	[/\bANUAL\b/, 12],
	[/\bSEMESTRAL\b/, 6],
	[/\bTRIMESTRAL\b/, 3],
	[/\bBIMESTRAL\b/, 2],
	[/\bMENSAL\b/, 1],
];

export function extrairDuracaoMesesDoPlano(nomePlano: string): number | null {
	const nome = nomePlano.trim().toUpperCase();

	const matchMeses = nome.match(/(\d+)\s*MESES?\b/);
	if (matchMeses) {
		const meses = Number.parseInt(matchMeses[1], 10);
		if (meses > 0) return meses;
	}

	for (const [padrao, meses] of DURACAO_POR_PALAVRA) {
		if (padrao.test(nome)) return meses;
	}

	return null;
}

export const PERCENTUAL_REPASSE_PROFESSOR = 0.5;

export function calcularPrecoMensal(
	valorTotal: number,
	nomePlano: string,
): number | null {
	const meses = extrairDuracaoMesesDoPlano(nomePlano);
	if (!meses || valorTotal <= 0) return null;
	return valorTotal / meses;
}

export function calcularRepasseProfessor(
	valorTotal: number,
	nomePlano: string,
): number | null {
	const mensal = calcularPrecoMensal(valorTotal, nomePlano);
	if (mensal == null) return null;
	return mensal * PERCENTUAL_REPASSE_PROFESSOR;
}

export type ResumoRepasseProfessor = {
	totalAlunos: number;
	totalRepasse: number;
	alunosSemMensalidade: number;
};

export function calcularResumoRepasse(
	clientes: { valor: number; nomePlano: string }[],
): ResumoRepasseProfessor {
	let totalRepasse = 0;
	let alunosSemMensalidade = 0;

	for (const cliente of clientes) {
		const repasse = calcularRepasseProfessor(cliente.valor, cliente.nomePlano);
		if (repasse == null) {
			alunosSemMensalidade += 1;
			continue;
		}
		totalRepasse += repasse;
	}

	return {
		totalAlunos: clientes.length,
		totalRepasse,
		alunosSemMensalidade,
	};
}
