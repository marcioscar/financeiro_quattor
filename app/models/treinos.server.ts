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

/** semana ISO 8601 de hoje e o ano ISO a que ela pertence */
export function getSemanaAtual(hoje = new Date()): { semana: number; ano: number } {
	const d = new Date(hoje);
	d.setHours(0, 0, 0, 0);
	const day = d.getDay() || 7;
	// a quinta-feira da semana define o ano ISO (29/12 pode ser semana 1 do ano seguinte)
	d.setDate(d.getDate() + 4 - day);
	const yearStart = new Date(d.getFullYear(), 0, 1);
	const semana = Math.ceil(
		((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
	);
	return { semana, ano: d.getFullYear() };
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

export async function findTreinoByGrupoSemana(
	grupo: string,
	semana: number,
	ano: number,
) {
	return db.treinos.findFirst({
		where: { grupo, semana, ano },
	});
}

export async function cadastrarTreinosNaSemanaFromBanco(
	bancoTreinos: Array<{
		grupo: string | null;
		exercicios: ExercicioBancoTreino[];
	}>,
) {
	const { semana, ano } = getSemanaAtual();
	const criados: string[] = [];
	const atualizados: string[] = [];

	for (const bt of bancoTreinos) {
		const grupo = bt.grupo?.trim();
		if (!grupo || !bt.exercicios?.length) continue;

		const exercicios = bt.exercicios.map(converterParaExercicioTreinos);
		const existente = await findTreinoByGrupoSemana(grupo, semana, ano);

		if (existente) {
			await db.treinos.update({
				where: { id: existente.id },
				data: { exercicios },
			});
			atualizados.push(grupo);
		} else {
			const created = await db.treinos.create({
				data: { grupo, semana, ano, exercicios },
			});
			criados.push(created.id);
		}
	}

	return { semana, ano, criados, atualizados };
}
