import { db } from "~/db.server";

export async function createDespesa(data: {
	conta: string;
	descricao: string;
	valor: number;
	data: Date;
	tipo: string;
	pago?: boolean;
	recibo_path?: string | null;
	boleto_path?: string | null;
}) {
	return db.despesas.create({
		data: {
			conta: data.conta,
			descricao: data.descricao,
			valor: data.valor,
			data: data.data,
			tipo: data.tipo,
			pago: data.pago ?? true,
			recibo_path: data.recibo_path ?? null,
			boleto_path: data.boleto_path ?? null,
		},
	});
}

export async function updateDespesa(
	id: string,
	data: {
		conta?: string;
		descricao?: string;
		valor?: number;
		data?: Date;
		tipo?: string;
		pago?: boolean;
		recibo_path?: string | null;
		boleto_path?: string | null;
	},
) {
	return db.despesas.update({
		where: { id },
		data,
	});
}

export async function deleteDespesa(id: string) {
	return db.despesas.delete({
		where: { id },
	});
}

export async function getDespesas() {
	const anoAtual = new Date().getFullYear();
	const inicioAno = new Date(anoAtual, 0, 1);
	const fimAno = new Date(anoAtual, 11, 31, 23, 59, 59, 999);

	return db.despesas.findMany({
		where: {
			pago: true,
			data: {
				gte: inicioAno,
				lte: fimAno,
			},
		},
		orderBy: { data: "desc" },
	});
}

/** Soma das despesas fixas do mês atual (para cálculo de ponto de equilíbrio) */
export async function getDespesasFixasDoMes(
	dataRef: Date = new Date(),
): Promise<number> {
	const ano = dataRef.getFullYear();
	const mes = dataRef.getMonth();
	const inicioMes = new Date(ano, mes, 1);
	const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59, 999);

	const despesas = await db.despesas.findMany({
		where: {
			tipo: "fixa",
			data: { gte: inicioMes, lte: fimMes },
		},
		select: { valor: true },
	});

	return despesas.reduce((acc, d) => acc + (d.valor ?? 0), 0);
}

export async function getContasAPagar() {
	const anoAtual = new Date().getFullYear();
	const inicioAno = new Date(anoAtual, 0, 1);
	const fimAno = new Date(anoAtual, 11, 31, 23, 59, 59, 999);

	return db.despesas.findMany({
		where: {
			pago: false,
			data: {
				gte: inicioAno,
				lte: fimAno,
			},
		},
		orderBy: { data: "desc" },
	});
}