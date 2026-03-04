import { db } from "~/db.server";

function getTresMesesAtras(): Date {
	const data = new Date();
	data.setMonth(data.getMonth() - 4);
	return data;
}

function filtrarSalariosUltimos3Meses<T extends { data?: Date | null; pago?: boolean | null }>(
	salarios: T[]
): T[] {
	const tresMesesAtras = getTresMesesAtras();
	return (salarios ?? [])
		.filter((s) => s.data && new Date(s.data) >= tresMesesAtras && s.pago === true)
		.sort(
			(a, b) =>
				new Date(b.data!).getTime() - new Date(a.data!).getTime()
		)
		.slice(0, 3);
}

type SalarioAPagarDetalhes = { valor: number; data: Date } | null;

function obterSalarioAPagar(
	salarios: {
		valor?: number | null;
		pago?: boolean | null;
		data?: Date | null;
	}[]
): number | null {
	const detalhes = obterSalarioAPagarDetalhes(salarios);
	return detalhes?.valor ?? null;
}

function obterSalarioAPagarDetalhes(
	salarios: {
		valor?: number | null;
		pago?: boolean | null;
		data?: Date | null;
		[key: string]: unknown;
	}[]
): SalarioAPagarDetalhes {
	const naoPagos = (salarios ?? []).filter(
		(s) => s.pago === false && s.valor != null
	);
	if (naoPagos.length === 0) return null;
	const maisRecente = naoPagos.sort(
		(a, b) =>
			new Date(b.data ?? 0).getTime() - new Date(a.data ?? 0).getTime()
	)[0];
	if (!maisRecente?.valor || !maisRecente?.data) return null;
	return {
		valor: maisRecente.valor,
		data: new Date(maisRecente.data),
	};
}

export async function atualizarFuncionario(
	folhaId: string,
	nome: string,
	conta: string,
	funcao: string,
	modalidade: string
) {
	await db.folha.update({
		where: { id: folhaId },
		data: { nome, conta, funcao, modalidade },
	});
}

export async function excluirFuncionario(folhaId: string) {
	await db.folha.delete({
		where: { id: folhaId },
	});
}

export async function criarFuncionario(
	nome: string,
	conta: string,
	funcao: string,
	modalidade: string
) {
	await db.folha.create({
		data: {
			nome,
			conta,
			funcao,
			modalidade,
			salarios: [],
		},
	});
}

export async function criarSalarioAPagar(
	folhaId: string,
	valor: number,
	data: Date
) {
	await db.folha.update({
		where: { id: folhaId },
		data: {
			salarios: {
				push: {
					valor,
					data,
					pago: false,
				},
			},
		},
	});
}

export async function getFolhasComSalariosUltimos3Meses() {
	const folhas = await db.folha.findMany({
		orderBy: { nome: "asc" },
	});

	return folhas.map((folha) => {
		const salarios = folha.salarios ?? [];
		return {
			...folha,
			salariosUltimos3Meses: filtrarSalariosUltimos3Meses(salarios),
			salarioAPagar: obterSalarioAPagar(salarios),
			salarioAPagarDetalhes: obterSalarioAPagarDetalhes(salarios),
		};
	});
}

export async function atualizarSalarioAPagar(
	folhaId: string,
	valor: number,
	data: Date,
	marcarComoPago = false
) {
	const folha = await db.folha.findUniqueOrThrow({
		where: { id: folhaId },
	});

	const salarios = [...(folha.salarios ?? [])];
	const idx = salarios.findIndex((s) => s.pago === false);
	if (idx < 0) throw new Error("Nenhum salário a pagar encontrado");

	salarios[idx] = {
		...salarios[idx],
		valor,
		data,
		pago: marcarComoPago,
	};

	await db.folha.update({
		where: { id: folhaId },
		data: { salarios: { set: salarios } },
	});
}
