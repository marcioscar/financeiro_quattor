import { db } from "~/db.server";

export type ExercicioBancoTreinoInput = {
	exercicio: string;
	observacao: string;
	video: string;
	repeticoes: string;
};

export async function createBancoTreino(data: {
	ciclo: string;
	treino: string;
	grupo: string;
	exercicios: ExercicioBancoTreinoInput[];
}) {
	return db.banco_treino.create({
		data: {
			ciclo: data.ciclo,
			treino: data.treino,
			grupo: data.grupo,
			exercicios: data.exercicios,
		},
	});
}

export async function findBancoTreinoByCicloTreinoGrupo(params: {
	ciclo: string;
	treino: string;
	grupo: string;
}) {
	return db.banco_treino.findFirst({
		where: {
			ciclo: params.ciclo,
			treino: params.treino,
			grupo: params.grupo,
		},
	});
}

export async function addExerciciosToBancoTreino(
	id: string,
	novosExercicios: ExercicioBancoTreinoInput[],
) {
	const existente = await db.banco_treino.findUnique({
		where: { id },
		select: { exercicios: true },
	});
	if (!existente) throw new Error("Treino não encontrado");

	const exerciciosAtualizados = [
		...(existente.exercicios ?? []),
		...novosExercicios,
	];

	return db.banco_treino.update({
		where: { id },
		data: { exercicios: exerciciosAtualizados },
	});
}

export async function getBancoTreinosByCicloTreino(params: {
	ciclo: string;
	treino: string;
}) {
	const treinoNorm = params.treino.trim().replace(/\s+/g, "");
	return db.banco_treino.findMany({
		where: {
			ciclo: params.ciclo.trim(),
			treino: treinoNorm,
		},
		orderBy: [{ grupo: "asc" }],
	});
}

export async function getBancoTreinos() {
	return db.banco_treino.findMany({
		orderBy: [{ ciclo: "asc" }, { treino: "asc" }, { grupo: "asc" }],
	});
}

export async function getBancoTreinoById(id: string) {
	return db.banco_treino.findUnique({
		where: { id },
	});
}

export async function updateBancoTreino(
	id: string,
	data: { exercicios: ExercicioBancoTreinoInput[] },
) {
	return db.banco_treino.update({
		where: { id },
		data: { exercicios: data.exercicios },
	});
}
