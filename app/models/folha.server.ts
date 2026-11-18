import { randomBytes } from "node:crypto";
import { db } from "~/db.server";
import {
	lancamentoNoPeriodo,
	type MesFechamento,
} from "~/lib/folha-fechamento";
import { ehSalario, type TipoLancamento } from "~/lib/folha-tipos";

type Salario = {
	valor?: number | null;
	pago?: boolean | null;
	data?: Date | null;
	tipo?: string | null;
};

function getQuatroMesesAtras(): Date {
	const data = new Date();
	data.setMonth(data.getMonth() - 4);
	return data;
}

/** Últimos 3 salários pagos (sem 13º), do mais recente para o mais antigo. */
function filtrarSalariosUltimos3Meses<T extends Salario>(salarios: T[]): T[] {
	const limite = getQuatroMesesAtras();
	return (salarios ?? [])
		.filter(
			(s) =>
				ehSalario(s) && s.data && new Date(s.data) >= limite && s.pago === true,
		)
		.sort((a, b) => new Date(b.data!).getTime() - new Date(a.data!).getTime())
		.slice(0, 3);
}

/** Salário (sem 13º) com data no mês civil atual (UTC). */
function obterSalarioMesAtualDetalhes(
	salarios: Salario[],
): { valor: number; data: Date; pago: boolean } | null {
	const hoje = new Date();
	const doMesAtual = (salarios ?? []).find((s) => {
		if (!s.data || s.valor == null || !ehSalario(s)) return false;
		const d = new Date(s.data);
		return (
			d.getUTCMonth() === hoje.getUTCMonth() &&
			d.getUTCFullYear() === hoje.getUTCFullYear()
		);
	});
	if (!doMesAtual?.valor || !doMesAtual?.data) return null;
	return {
		valor: doMesAtual.valor,
		data: new Date(doMesAtual.data),
		pago: doMesAtual.pago === true,
	};
}

export async function atualizarFuncionario(
	folhaId: string,
	nome: string,
	conta: string,
	funcao: string,
	modalidade: string,
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
	modalidade: string,
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

export async function getFolhasComSalarios() {
	const folhas = await db.folha.findMany({
		orderBy: { nome: "asc" },
	});

	return folhas.map((folha) => {
		const salarios = folha.salarios ?? [];
		return {
			...folha,
			salariosUltimos3Meses: filtrarSalariosUltimos3Meses(salarios),
			salarioMesAtualDetalhes: obterSalarioMesAtualDetalhes(salarios),
		};
	});
}

function novoSalId(): string {
	return randomBytes(12).toString("hex");
}

/**
 * Grava o lançamento de `tipo` do período para cada funcionário: atualiza o
 * que já existe (mês para salário, ano para 13º) ou cria um novo. Se houver
 * mais de um lançamento no período, eles viram um só com o valor informado,
 * já que a tela mostra a soma deles como um valor único.
 */
export async function salvarLancamentos(
	tipo: TipoLancamento,
	periodo: MesFechamento,
	data: Date,
	pago: boolean,
	itens: { folhaId: string; valor: number; comprovante?: string }[],
): Promise<number> {
	let salvos = 0;
	for (const { folhaId, valor, comprovante } of itens) {
		const folha = await db.folha.findUniqueOrThrow({ where: { id: folhaId } });
		const salarios = [...(folha.salarios ?? [])];
		const indices = salarios
			.map((s, i) => (lancamentoNoPeriodo(s, tipo, periodo) ? i : -1))
			.filter((i) => i >= 0);

		if (indices.length === 0) {
			salarios.push({
				sal_id: novoSalId(),
				tipo,
				valor,
				data,
				pago,
				comprovante: comprovante ?? null,
				decimo: null,
				ferias: null,
				fgts: null,
			});
		} else {
			const [primeiro, ...duplicados] = indices;
			salarios[primeiro] = {
				...salarios[primeiro],
				// Lançamentos antigos de salário não têm tipo; mantém como estão.
				tipo: salarios[primeiro].tipo ?? (tipo === "salario" ? null : tipo),
				valor,
				data,
				pago,
				// Sem arquivo novo, mantém o comprovante que já estava anexado.
				...(comprovante && { comprovante }),
			};
			for (const i of duplicados.reverse()) salarios.splice(i, 1);
		}

		await db.folha.update({
			where: { id: folhaId },
			data: { salarios: { set: salarios } },
		});
		salvos++;
	}
	return salvos;
}

/** Anexa (ou troca) o comprovante do lançamento do período. */
export async function anexarComprovante(
	folhaId: string,
	tipo: TipoLancamento,
	periodo: MesFechamento,
	comprovante: string,
) {
	const folha = await db.folha.findUniqueOrThrow({ where: { id: folhaId } });
	const salarios = (folha.salarios ?? []).map((s) =>
		lancamentoNoPeriodo(s, tipo, periodo) ? { ...s, comprovante } : s,
	);
	await db.folha.update({
		where: { id: folhaId },
		data: { salarios: { set: salarios } },
	});
}

/** Remove o lançamento do período, desde que ainda não tenha sido pago. */
export async function removerLancamento(
	folhaId: string,
	tipo: TipoLancamento,
	periodo: MesFechamento,
) {
	const folha = await db.folha.findUniqueOrThrow({ where: { id: folhaId } });
	const salarios = folha.salarios ?? [];
	const doPeriodo = salarios.filter((s) => lancamentoNoPeriodo(s, tipo, periodo));
	if (doPeriodo.length === 0) return;
	if (doPeriodo.some((s) => s.pago === true)) {
		throw new Error("Lançamento já pago: volte para 'a pagar' antes de remover.");
	}
	await db.folha.update({
		where: { id: folhaId },
		data: {
			salarios: {
				set: salarios.filter((s) => !lancamentoNoPeriodo(s, tipo, periodo)),
			},
		},
	});
}
