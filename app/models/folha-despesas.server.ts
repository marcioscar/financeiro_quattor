import { db } from "~/db.server";
import { limitesMesCivilUTC } from "~/lib/despesas-calendar";

/**
 * Mantém em despesas um lançamento por mês com o total de salários **pagos** na
 * folha daquele mês. O vínculo é o campo `despesas.origem_folha_mes` ("YYYY-MM"):
 * enquanto o valor da folha muda (novo salário marcado como pago, valor editado),
 * a despesa correspondente é atualizada em vez de duplicada.
 */

const CONTA = "Pessoal";
const TIPO = "fixa";
const DESCRICAO = "Salários (folha)";

/** Quantos meses civis para trás são sincronizados (inclui o mês atual). */
const MESES_SINCRONIZADOS = 3;

/**
 * Despesas de salário lançadas à mão antes desta automação. Ao sincronizar um
 * mês pela primeira vez, uma delas é adotada (ganha `origem_folha_mes`) em vez
 * de criarmos uma segunda — senão o mês contaria a folha duas vezes.
 */
const DESCRICAO_MANUAL = /sal[aá]rios?|folha/i;

/** Diferenças abaixo de meio centavo são ruído de ponto flutuante. */
const TOLERANCIA = 0.005;

export type SincronizacaoSalarios = {
	mes: string;
	total: number;
	acao: "criada" | "adotada" | "atualizada" | "removida" | "inalterada";
};

function chaveMes(ano: number, mes: number): string {
	return `${ano}-${String(mes).padStart(2, "0")}`;
}

/**
 * Meses a sincronizar, do mais antigo para o mais recente. Usa UTC porque as
 * datas de salário e de despesa são gravadas como meia-noite UTC.
 */
function mesesDaJanela(hoje = new Date()): { ano: number; mes: number }[] {
	const meses: { ano: number; mes: number }[] = [];
	for (let i = MESES_SINCRONIZADOS - 1; i >= 0; i--) {
		const d = new Date(
			Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - i, 1),
		);
		meses.push({ ano: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 });
	}
	return meses;
}

type TotalMes = { total: number; ultimoPagamento: Date | null };

/** Soma dos salários pagos por mês civil (UTC), a partir de toda a folha. */
async function totaisPagosPorMes(): Promise<Map<string, TotalMes>> {
	const folhas = await db.folha.findMany({ select: { salarios: true } });

	const porMes = new Map<string, TotalMes>();
	for (const folha of folhas) {
		for (const sal of folha.salarios ?? []) {
			if (sal.pago !== true || sal.valor == null || !sal.data) continue;
			const d = new Date(sal.data);
			const chave = chaveMes(d.getUTCFullYear(), d.getUTCMonth() + 1);
			const atual = porMes.get(chave) ?? { total: 0, ultimoPagamento: null };
			atual.total += sal.valor;
			if (!atual.ultimoPagamento || d > atual.ultimoPagamento) {
				atual.ultimoPagamento = d;
			}
			porMes.set(chave, atual);
		}
	}
	return porMes;
}

async function sincronizarMes(
	ano: number,
	mes: number,
	totalMes: TotalMes | undefined,
): Promise<SincronizacaoSalarios> {
	const chave = chaveMes(ano, mes);
	const total = Math.round((totalMes?.total ?? 0) * 100) / 100;
	const { inicio, fim } = limitesMesCivilUTC(ano, mes);

	const vinculada = await db.despesas.findFirst({
		where: { origem_folha_mes: chave },
	});

	if (total <= 0) {
		if (vinculada) {
			await db.despesas.delete({ where: { id: vinculada.id } });
			return { mes: chave, total, acao: "removida" };
		}
		return { mes: chave, total, acao: "inalterada" };
	}

	if (vinculada) {
		if (Math.abs((vinculada.valor ?? 0) - total) < TOLERANCIA) {
			return { mes: chave, total, acao: "inalterada" };
		}
		await db.despesas.update({
			where: { id: vinculada.id },
			data: { valor: total },
		});
		return { mes: chave, total, acao: "atualizada" };
	}

	// Primeira sincronização do mês: adota um lançamento manual, se houver.
	const candidatos = await db.despesas.findMany({
		where: { conta: CONTA, data: { gte: inicio, lte: fim } },
	});
	const manual = candidatos.find(
		(d) => !d.origem_folha_mes && DESCRICAO_MANUAL.test(d.descricao ?? ""),
	);

	if (manual) {
		await db.despesas.update({
			where: { id: manual.id },
			data: { origem_folha_mes: chave, valor: total },
		});
		return {
			mes: chave,
			total,
			acao:
				Math.abs((manual.valor ?? 0) - total) < TOLERANCIA
					? "adotada"
					: "atualizada",
		};
	}

	await db.despesas.create({
		data: {
			conta: CONTA,
			descricao: DESCRICAO,
			valor: total,
			data: totalMes?.ultimoPagamento ?? fim,
			tipo: TIPO,
			pago: true,
			origem_folha_mes: chave,
			recibo_path: null,
			boleto_path: null,
		},
	});
	return { mes: chave, total, acao: "criada" };
}

/**
 * Roda no loader da folha e no de despesas. Como só escreve quando o valor
 * diverge, o custo em regime normal é uma leitura da folha + uma de despesas.
 */
let emAndamento: Promise<SincronizacaoSalarios[]> | null = null;

export async function sincronizarDespesasSalarios(): Promise<
	SincronizacaoSalarios[]
> {
	// Loaders concorrentes (folha e despesas na mesma navegação) criariam duas
	// despesas para o mesmo mês — não há índice único no Mongo para barrar isso.
	if (emAndamento) return emAndamento;

	emAndamento = (async () => {
		const porMes = await totaisPagosPorMes();
		const resultado: SincronizacaoSalarios[] = [];
		for (const { ano, mes } of mesesDaJanela()) {
			resultado.push(
				await sincronizarMes(ano, mes, porMes.get(chaveMes(ano, mes))),
			);
		}
		return resultado;
	})();

	try {
		return await emAndamento;
	} finally {
		emAndamento = null;
	}
}
