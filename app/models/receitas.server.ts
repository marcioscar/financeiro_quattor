import { db } from "~/db.server";
import { limitesMesCivilUTC } from "~/lib/despesas-calendar";

export async function createReceita(data: {
	forma: string;
	descricao: string;
	valor: number;
	data: Date;
	status: string;
}) {
	return db.receitas.create({
		data: {
			forma: data.forma,
			descricao: data.descricao,
			valor: data.valor,
			data: data.data,
			status: data.status,
		},
	});
}

export async function updateReceita(
	id: string,
	data: {
		forma?: string;
		descricao?: string;
		valor?: number;
		data?: Date;
		status?: string;
	},
) {
	return db.receitas.update({
		where: { id },
		data,
	});
}

export async function deleteReceita(id: string) {
	return db.receitas.delete({
		where: { id },
	});
}

export async function getReceitas() {
	const anoAtual = new Date().getUTCFullYear();
	const inicioAno = new Date(Date.UTC(anoAtual, 0, 1, 0, 0, 0, 0));
	const fimAno = new Date(Date.UTC(anoAtual, 11, 31, 23, 59, 59, 999));

	return db.receitas.findMany({
		where: {
			data: {
				gte: inicioAno,
				lte: fimAno,
			},
		},
		orderBy: { data: "desc" },
	});
}

/**
 * Soma de todas as receitas do mês (faturamento). Usa mês civil em UTC —
 * `dataRef` é comparado com `getUTCFullYear`/`getUTCMonth`, não os getters
 * locais, senão em fusos negativos (ex.: America/Sao_Paulo) receitas do dia
 * 1º do mês (gravadas à meia-noite UTC) ficam fora do intervalo local.
 */
export async function getFaturamentoDoMes(
	dataRef: Date = new Date(),
): Promise<number> {
	const ano = dataRef.getUTCFullYear();
	const mes = dataRef.getUTCMonth() + 1;
	const { inicio, fim } = limitesMesCivilUTC(ano, mes);

	const receitas = await db.receitas.findMany({
		where: {
			data: { gte: inicio, lte: fim },
		},
		select: { valor: true },
	});

	return receitas.reduce((acc, r) => acc + (r.valor ?? 0), 0);
}
