import { db } from "~/db.server";
import { toTitleCase } from "~/lib/utils";

type ExercicioBancoTreino = {
	exercicio?: string | null;
	observacao?: string | null;
	video?: string | null;
	repeticoes?: string | null;
};

type ExercicioTreinos = {
	nome?: string | null;
	Repeticoes?: string | null;
	obs?: string | null;
	video?: string | null;
	carga?: string | null;
};

function getSemanaAtual(): number {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	const day = d.getDay() || 7;
	d.setDate(d.getDate() + 4 - day);
	const yearStart = new Date(d.getFullYear(), 0, 1);
	return Math.ceil(
		((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
	);
}

function converterParaExercicioTreinos(ex: ExercicioBancoTreino): ExercicioTreinos {
	const nome = String(ex.exercicio ?? "").trim();
	return {
		nome: toTitleCase(nome),
		Repeticoes: ex.repeticoes ?? "",
		obs: ex.observacao ?? "",
		video: ex.video ?? "_producao.gif",
		carga: "carga",
	};
}

export async function findTreinoByGrupoSemana(grupo: string, semana: number) {
	return db.treinos.findFirst({
		where: { grupo, semana },
	});
}

export async function cadastrarTreinosNaSemanaFromBanco(
	bancoTreinos: Array<{
		grupo: string | null;
		exercicios: ExercicioBancoTreino[];
	}>,
) {
	const semana = getSemanaAtual();
	const criados: string[] = [];
	const atualizados: string[] = [];

	for (const bt of bancoTreinos) {
		const grupo = bt.grupo?.trim();
		if (!grupo || !bt.exercicios?.length) continue;

		const exercicios = bt.exercicios.map(converterParaExercicioTreinos);
		const existente = await findTreinoByGrupoSemana(grupo, semana);

		if (existente) {
			await db.treinos.update({
				where: { id: existente.id },
				data: { exercicios },
			});
			atualizados.push(grupo);
		} else {
			const created = await db.treinos.create({
				data: { grupo, semana, exercicios },
			});
			criados.push(created.id);
		}
	}

	return { semana, criados, atualizados };
}
