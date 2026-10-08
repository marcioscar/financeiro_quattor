export type BancoTreinoRow = {
	id: string;
	ciclo: string | null;
	treino: string | null;
	grupo: string | null;
	exercicios: Array<{
		exercicio?: string | null;
		repeticoes?: string | null;
		observacao?: string | null;
		video?: string | null;
	}>;
};
