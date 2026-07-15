/**
 * Importação do extrato bancário (somente entradas) para criar receitas
 * automaticamente. O arquivo é enviado semanalmente e sempre traz todos os
 * lançamentos (antigos + novos), então a importação é idempotente: cada
 * linha vira um hash de `data+descricao+valor` e lançamentos cujo hash já
 * existe no banco são descartados.
 */
import { createHash } from "node:crypto";
import { db } from "~/db.server";

type LinhaExtrato = {
	forma: string;
	descricao: string;
	valor: number;
	data: Date;
	hash: string;
};

function normalizarNumeroBR(valor: string): number {
	const limpo = valor.trim().replace(/\./g, "").replace(",", ".");
	const num = Number.parseFloat(limpo);
	return Number.isFinite(num) ? num : 0;
}

/** "01/07/2026" -> Date (UTC, mesma convenção de `despesas-calendar.ts`) */
function parseDataBR(valor: string): Date | null {
	const match = valor.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
	if (!match) return null;
	const [, dia, mes, ano] = match;
	return new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
}

/** Deriva a forma de pagamento a partir do texto do lançamento bancário. */
function inferirForma(descricao: string): string {
	const desc = descricao.toUpperCase();
	if (desc.startsWith("RECEBIMENTO STONE")) {
		if (/\bDB\d/.test(desc)) return "Débito";
		if (/\bCD\d/.test(desc)) return "Crédito";
		return "Crédito";
	}
	if (desc.startsWith("PIX")) return "PIX";
	if (desc.startsWith("TED")) return "Transferência";
	if (desc.startsWith("RENDIMENTOS")) return "Transferência";
	return "Transferência";
}

function calcularHash(data: Date, descricao: string, valor: number): string {
	const chave = `${data.toISOString().slice(0, 10)}|${descricao}|${valor.toFixed(2)}`;
	return createHash("sha256").update(chave).digest("hex");
}

function parseExtratoTxt(buffer: Buffer): LinhaExtrato[] {
	const texto = buffer.toString("utf-8").replace(/^﻿/, "");
	const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);

	const registros: LinhaExtrato[] = [];

	for (const linha of linhas) {
		const campos = linha.split(";");
		if (campos.length < 3) continue;

		const data = parseDataBR(campos[0] ?? "");
		const descricao = campos[1]?.trim();
		if (!data || !descricao) continue;

		const valor = normalizarNumeroBR(campos[2] ?? "0");
		if (valor <= 0) continue;

		registros.push({
			forma: inferirForma(descricao),
			descricao,
			valor,
			data,
			hash: calcularHash(data, descricao, valor),
		});
	}

	return registros;
}

/**
 * Importa o extrato bancário (somente entradas) como receitas, descartando
 * lançamentos já importados anteriormente (dedupe por hash de
 * data+descrição+valor, já que o extrato não traz um id único por linha).
 */
export async function importarExtratoReceitas(
	buffer: Buffer,
): Promise<{ inseridas: number; ignoradas: number }> {
	const registros = parseExtratoTxt(buffer);
	if (registros.length === 0) {
		throw new Error(
			"Nenhum lançamento válido encontrado no arquivo. Confira se é o extrato bancário no formato data;descrição;valor.",
		);
	}

	const existentes = await db.receitas.findMany({
		where: { origem_extrato_hash: { in: registros.map((r) => r.hash) } },
		select: { origem_extrato_hash: true },
	});
	const hashesExistentes = new Set(existentes.map((e) => e.origem_extrato_hash));

	const novos = registros.filter((r) => !hashesExistentes.has(r.hash));

	if (novos.length > 0) {
		await db.receitas.createMany({
			data: novos.map((r) => ({
				forma: r.forma,
				descricao: r.descricao,
				valor: r.valor,
				data: r.data,
				status: "recebido",
				origem_extrato_hash: r.hash,
			})),
		});
	}

	return { inseridas: novos.length, ignoradas: registros.length - novos.length };
}
