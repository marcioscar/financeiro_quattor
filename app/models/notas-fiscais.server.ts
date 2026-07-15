/**
 * Cache mensal de notas fiscais de saída (EVO/eNotas) para poupar chamadas à
 * API: meses fechados (anteriores ao mês corrente) são buscados uma única
 * vez e gravados no MongoDB; o mês corrente é sincronizado de forma
 * incremental, buscando na EVO só o que mudou desde a última consulta.
 */
import { db } from "~/db.server";
import { limitesMesCivilUTC } from "~/lib/despesas-calendar";
import {
	buscarNotasFiscaisSaidaEVO,
	type NotaFiscalSaidaEVO,
} from "~/models/evo.server";

export interface ResumoNotasFiscaisMes {
	mes: number;
	ano: number;
	quantidade: number;
	valorTotal: number;
	notas: NotaFiscalSaidaEVO[];
	erro?: string;
}

type ItemNotaFiscalGravado = {
	id_evo: string;
	tipo?: string | null;
	numero?: string | null;
	status?: string | null;
	data_emissao?: Date | null;
	enviada_por_email?: boolean | null;
	nome_cliente?: string | null;
	valor_total?: number | null;
	link_download_pdf?: string | null;
};

function mesEstaFechado(mes: number, ano: number, hoje: Date): boolean {
	const anoAtual = hoje.getUTCFullYear();
	const mesAtual = hoje.getUTCMonth() + 1;
	return ano < anoAtual || (ano === anoAtual && mes < mesAtual);
}

function notaParaItem(nota: NotaFiscalSaidaEVO): ItemNotaFiscalGravado {
	return {
		id_evo: nota.id,
		tipo: nota.tipo,
		numero: nota.numero,
		status: nota.status,
		data_emissao: nota.dataEmissao ? new Date(nota.dataEmissao) : null,
		enviada_por_email: nota.enviadaPorEmail,
		nome_cliente: nota.nomeCliente,
		valor_total: nota.valorTotal,
		link_download_pdf: nota.linkDownloadPDF,
	};
}

function itemParaNota(item: ItemNotaFiscalGravado): NotaFiscalSaidaEVO {
	return {
		id: item.id_evo,
		tipo: item.tipo ?? null,
		numero: item.numero ?? null,
		status: item.status ?? null,
		dataEmissao: item.data_emissao ? item.data_emissao.toISOString() : null,
		enviadaPorEmail: item.enviada_por_email ?? false,
		nomeCliente: item.nome_cliente ?? null,
		valorTotal: item.valor_total ?? 0,
		linkDownloadPDF: item.link_download_pdf ?? null,
	};
}

/** `buscarNotasFiscaisSaidaEVO` já filtra statusInvoice=1, então tudo que chega aqui conta. */
function resumirNotas(
	mes: number,
	ano: number,
	notas: NotaFiscalSaidaEVO[],
): ResumoNotasFiscaisMes {
	const valorTotal = notas.reduce((acc, n) => acc + n.valorTotal, 0);
	return { mes, ano, quantidade: notas.length, valorTotal, notas };
}

/** Mescla notas recém-buscadas por cima do cache existente (upsert por id). */
function mesclarNotas(
	existentes: NotaFiscalSaidaEVO[],
	novas: NotaFiscalSaidaEVO[],
): NotaFiscalSaidaEVO[] {
	const mapa = new Map(existentes.map((n) => [n.id, n]));
	for (const nota of novas) mapa.set(nota.id, nota);
	return [...mapa.values()];
}

/**
 * Busca o resumo de notas fiscais de saída emitidas no mês/ano informado.
 * - Mês fechado + já gravado: lê só do banco, sem tocar na EVO.
 * - Mês fechado + nunca sincronizado: busca completa na EVO, grava como fechado.
 * - Mês corrente (aberto): sincroniza incrementalmente (lastDateChangeStart a
 *   partir da última sincronização) e mescla com o que já está gravado.
 */
export async function getResumoNotasFiscaisMes(
	mes: number,
	ano: number,
): Promise<ResumoNotasFiscaisMes> {
	const agora = new Date();
	const fechado = mesEstaFechado(mes, ano, agora);

	const registro = await db.notas_fiscais_mes.findUnique({
		where: { notas_fiscais_mes_ano: { mes, ano } },
	});

	if (registro?.fechado) {
		const notas = registro.itens.map(itemParaNota);
		return resumirNotas(mes, ano, notas);
	}

	const { inicio, fim } = limitesMesCivilUTC(ano, mes);
	const fimBusca = fechado ? fim : agora;
	const notasExistentes = registro?.itens.map(itemParaNota) ?? [];

	const { notas: notasBuscadas, erro } = await buscarNotasFiscaisSaidaEVO({
		issueDateStart: inicio,
		issueDateEnd: fimBusca,
		lastDateChangeStart: registro?.ultima_sincronizacao_em ?? undefined,
	});

	if (erro) {
		if (notasExistentes.length > 0) {
			return { ...resumirNotas(mes, ano, notasExistentes), erro };
		}
		return { mes, ano, quantidade: 0, valorTotal: 0, notas: [], erro };
	}

	const notasMescladas = mesclarNotas(notasExistentes, notasBuscadas);

	await db.notas_fiscais_mes.upsert({
		where: { notas_fiscais_mes_ano: { mes, ano } },
		create: {
			mes,
			ano,
			fechado,
			ultima_sincronizacao_em: agora,
			itens: notasMescladas.map(notaParaItem),
		},
		update: {
			fechado,
			ultima_sincronizacao_em: agora,
			itens: notasMescladas.map(notaParaItem),
		},
	});

	return resumirNotas(mes, ano, notasMescladas);
}
