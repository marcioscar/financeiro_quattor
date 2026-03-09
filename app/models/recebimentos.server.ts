/**
 * Lê o Excel de contas a receber e soma todas as linhas da coluna Valor baixa.
 * O arquivo já vem filtrado pelo mês desejado.
 */

import * as XLSX from "xlsx";
import path from "node:path";
import { readFileSync } from "node:fs";

const COL_VALOR_BAIXA = 10;

function toNum(val: unknown): number {
	if (val === null || val === undefined || val === "") return 0;
	const n = Number(val);
	return isNaN(n) ? 0 : n;
}

/**
 * Soma a coluna Valor baixa de todas as linhas do Excel.
 */
export function getRecebimentosDoMesAtual(): { valor: number; erro?: string } {
	try {
		const dataPath = path.join(
			process.cwd(),
			"app",
			"dados",
			"Contas_receber.xlsx",
		);
		const buffer = readFileSync(dataPath);
		const workbook = XLSX.read(buffer, { type: "buffer" });
		const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
		if (!firstSheet) return { valor: 0, erro: "Planilha vazia" };

		const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, {
			header: 1,
			defval: "",
		});

		let soma = 0;

		for (let i = 1; i < rows.length; i++) {
			const row = rows[i];
			if (!Array.isArray(row)) continue;
			soma += toNum(row[COL_VALOR_BAIXA]);
		}

		return { valor: soma };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Erro desconhecido";
		return { valor: 0, erro: `Erro ao ler recebimentos: ${msg}` };
	}
}
