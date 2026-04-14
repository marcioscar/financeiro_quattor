import { limitesMesCivilUTC } from "~/lib/despesas-calendar";
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
	const inicioAno = new Date(Date.UTC(anoAtual, 0, 1, 0, 0, 0, 0));
	const fimAno = new Date(Date.UTC(anoAtual, 11, 31, 23, 59, 59, 999));

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

/** Soma de todas as despesas do mês (fixas + variáveis). `mes` 1–12. */
export async function getDespesasTotaisDoMes(
	ano: number,
	mes: number,
): Promise<number> {
	const { inicio: inicioMes, fim: fimMes } = limitesMesCivilUTC(ano, mes);

	const despesas = await db.despesas.findMany({
		where: {
			pago: true,
			data: { gte: inicioMes, lte: fimMes },
		},
		select: { valor: true },
	});

	return despesas.reduce((acc, d) => acc + (d.valor ?? 0), 0);
}

/** Despesas agrupadas por conta (categoria) no mês — para gráfico de composição. `mes` 1–12. */
export async function getDespesasPorCategoriaDoMes(
	ano: number,
	mes: number,
): Promise<{ conta: string; valor: number }[]> {
	const { inicio: inicioMes, fim: fimMes } = limitesMesCivilUTC(ano, mes);

	const despesas = await db.despesas.findMany({
		where: {
			pago: true,
			data: { gte: inicioMes, lte: fimMes },
		},
		select: { conta: true, valor: true },
	});

	const porConta = new Map<string, number>();
	for (const d of despesas) {
		const conta = d.conta?.trim() || "Outros";
		porConta.set(conta, (porConta.get(conta) ?? 0) + (d.valor ?? 0));
	}

	return Array.from(porConta.entries())
		.map(([conta, valor]) => ({ conta, valor }))
		.filter((x) => x.valor > 0)
		.sort((a, b) => b.valor - a.valor);
}

/** Soma das despesas fixas do mês (ponto de equilíbrio). `mes` 1–12. */
export async function getDespesasFixasDoMes(
	ano: number,
	mes: number,
): Promise<number> {
	const { inicio: inicioMes, fim: fimMes } = limitesMesCivilUTC(ano, mes);

	const despesas = await db.despesas.findMany({
		where: {
			tipo: "fixa",
			pago: true,
			data: { gte: inicioMes, lte: fimMes },
		},
		select: { valor: true },
	});

	return despesas.reduce((acc, d) => acc + (d.valor ?? 0), 0);
}

export async function getContasAPagar() {
	const anoAtual = new Date().getFullYear();
	const inicioAno = new Date(Date.UTC(anoAtual, 0, 1, 0, 0, 0, 0));
	const fimAno = new Date(Date.UTC(anoAtual, 11, 31, 23, 59, 59, 999));

	return db.despesas.findMany({
		where: {
			pago: false,
			data: {
				gte: inicioAno,
				lte: fimAno,
			},
		},
		orderBy: { data: "asc" },
	});
}