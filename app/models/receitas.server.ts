import { db } from "~/db.server";

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
	const anoAtual = new Date().getFullYear();
	const inicioAno = new Date(anoAtual, 0, 1);
	const fimAno = new Date(anoAtual, 11, 31, 23, 59, 59, 999);

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

/** Soma de todas as receitas do mês (faturamento) */
export async function getFaturamentoDoMes(
	dataRef: Date = new Date(),
): Promise<number> {
	const ano = dataRef.getFullYear();
	const mes = dataRef.getMonth();
	const inicioMes = new Date(ano, mes, 1);
	const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59, 999);

	const receitas = await db.receitas.findMany({
		where: {
			data: { gte: inicioMes, lte: fimMes },
		},
		select: { valor: true },
	});

	return receitas.reduce((acc, r) => acc + (r.valor ?? 0), 0);
}
