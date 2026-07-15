/**
 * Importação do extrato de vendas da Stone (operadora de cartão) para
 * conciliação com as notas fiscais emitidas. O CSV baixado no site da Stone
 * sempre traz o mês inteiro, então a importação é idempotente por
 * `STONE ID` (único por transação) — reimportar o mesmo arquivo, ou um mais
 * novo que sobreponha dias já importados, nunca duplica registros.
 */
import { db } from "~/db.server";
import { limitesMesCivilUTC } from "~/lib/despesas-calendar";

const STATUS_APROVADA = "Aprovada";

type LinhaVendaStone = {
	stone_id: string;
	documento: string | null;
	data_venda: Date;
	bandeira: string | null;
	produto: string | null;
	n_parcelas: number | null;
	valor_bruto: number;
	valor_liquido: number | null;
	ultimo_status: string | null;
};

function normalizarNumeroBR(valor: string): number {
	const limpo = valor.trim().replace(/\./g, "").replace(",", ".");
	const num = Number.parseFloat(limpo);
	return Number.isFinite(num) ? num : 0;
}

/** "15/07/2026 11:18" -> Date (UTC, mesma convenção de `despesas-calendar.ts`) */
function parseDataHoraBR(valor: string): Date | null {
	const match = valor
		.trim()
		.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
	if (!match) return null;
	const [, dia, mes, ano, hora, minuto] = match;
	return new Date(
		Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto)),
	);
}

function parseCsvVendasStone(buffer: Buffer): LinhaVendaStone[] {
	const texto = buffer.toString("utf-8").replace(/^﻿/, "");
	const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (linhas.length < 2) return [];

	const registros: LinhaVendaStone[] = [];

	for (let i = 1; i < linhas.length; i++) {
		const campos = linhas[i].split(";");
		if (campos.length < 17) continue;

		const stoneId = campos[5]?.trim();
		if (!stoneId) continue;

		const dataVenda = parseDataHoraBR(campos[2] ?? "");
		if (!dataVenda) continue;

		registros.push({
			stone_id: stoneId,
			documento: campos[0]?.trim() || null,
			data_venda: dataVenda,
			bandeira: campos[3]?.trim() || null,
			produto: campos[4]?.trim() || null,
			n_parcelas: Number.parseInt(campos[6] ?? "", 10) || null,
			valor_bruto: normalizarNumeroBR(campos[7] ?? "0"),
			valor_liquido: normalizarNumeroBR(campos[8] ?? "0"),
			ultimo_status: campos[15]?.trim() || null,
		});
	}

	return registros;
}

/**
 * Importa o CSV de vendas da Stone, ignorando transações já gravadas
 * (dedupe por `stone_id`, único por transação).
 */
export async function importarVendasStone(
	buffer: Buffer,
): Promise<{ inseridas: number; ignoradas: number }> {
	const registros = parseCsvVendasStone(buffer);
	if (registros.length === 0) {
		throw new Error(
			"Nenhum registro válido encontrado no arquivo. Confira se é o CSV de vendas exportado pela Stone.",
		);
	}

	const existentes = await db.vendas_stone.findMany({
		where: { stone_id: { in: registros.map((r) => r.stone_id) } },
		select: { stone_id: true },
	});
	const idsExistentes = new Set(existentes.map((e) => e.stone_id));

	const novos = registros.filter((r) => !idsExistentes.has(r.stone_id));

	if (novos.length > 0) {
		await db.vendas_stone.createMany({ data: novos });
	}

	return { inseridas: novos.length, ignoradas: registros.length - novos.length };
}

export interface TotalVendasStoneMes {
	totalBruto: number;
	quantidade: number;
}

/** Soma o valor bruto das vendas aprovadas da Stone no mês/ano informado. */
export async function getTotalVendasStoneDoMes(
	mes: number,
	ano: number,
): Promise<TotalVendasStoneMes> {
	const { inicio, fim } = limitesMesCivilUTC(ano, mes);

	const vendas = await db.vendas_stone.findMany({
		where: {
			ultimo_status: STATUS_APROVADA,
			data_venda: { gte: inicio, lte: fim },
		},
		select: { valor_bruto: true },
	});

	const totalBruto = vendas.reduce((acc, v) => acc + v.valor_bruto, 0);
	return { totalBruto, quantidade: vendas.length };
}
