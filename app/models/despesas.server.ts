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