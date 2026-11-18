import { db } from "~/db.server";
import { limitesMesCivilUTC } from "~/lib/despesas-calendar";
import { ehSalario } from "~/lib/folha-tipos";

/**
 * Mantém em despesas um lançamento por mês com o total **pago** na folha
 * daquele mês, separado em dois: salários e 13º. O vínculo é o campo
 * `despesas.origem_folha_mes`: "YYYY-MM" para salários e "13-YYYY-MM" para o
 * 13º. Enquanto o valor da folha muda (novo pagamento, valor editado), a
 * despesa correspondente é atualizada em vez de duplicada.
 */

const CONTA = "Pessoal";
const TIPO = "fixa";

type Categoria = {
	descricao: string;
	prefixoChave: string;
	/**
	 * Só os salários adotam despesas lançadas à mão antes desta automação: ao
	 * sincronizar um mês pela primeira vez, uma delas ganha `origem_folha_mes`
	 * em vez de criarmos uma segunda — senão o mês contaria a folha duas vezes.
	 */
	adotaManual: boolean;
};

const SALARIOS: Categoria = {
	descricao: "Salários (folha)",
	prefixoChave: "",
	adotaManual: true,
};

const DECIMO_TERCEIRO: Categoria = {
	descricao: "13º salário (folha)",
	prefixoChave: "13-",
	adotaManual: false,
};

const DESCRICAO_MANUAL = /sal[aá]rios?|folha/i;

/** Quantos meses civis para trás são sincronizados (inclui o mês atual). */
const MESES_SINCRONIZADOS = 3;

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

/** Soma do que foi pago por mês civil (UTC), separada em salários e 13º. */
async function totaisPagosPorMes(): Promise<{
	salarios: Map<string, TotalMes>;
	decimo: Map<string, TotalMes>;
}> {
	const folhas = await db.folha.findMany({ select: { salarios: true } });

	const salarios = new Map<string, TotalMes>();
	const decimo = new Map<string, TotalMes>();
	for (const folha of folhas) {
		for (const sal of folha.salarios ?? []) {
			if (sal.pago !== true || sal.valor == null || !sal.data) continue;
			const porMes = ehSalario(sal) ? salarios : decimo;
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
	return { salarios, decimo };
}

async function sincronizarMes(
	categoria: Categoria,
	ano: number,
	mes: number,
	totalMes: TotalMes | undefined,
): Promise<SincronizacaoSalarios> {
	const chave = `${categoria.prefixoChave}${chaveMes(ano, mes)}`;
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

	if (categoria.adotaManual) {
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
	}

	await db.despesas.create({
		data: {
			conta: CONTA,
			descricao: categoria.descricao,
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
		const { salarios, decimo } = await totaisPagosPorMes();
		const resultado: SincronizacaoSalarios[] = [];
		for (const { ano, mes } of mesesDaJanela()) {
			const chave = chaveMes(ano, mes);
			resultado.push(
				await sincronizarMes(SALARIOS, ano, mes, salarios.get(chave)),
				await sincronizarMes(DECIMO_TERCEIRO, ano, mes, decimo.get(chave)),
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
