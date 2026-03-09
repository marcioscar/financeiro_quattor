/**
 * Integração com a API EVO (W12) para dados de membros/alunos.
 * Usa o endpoint /api/v2/management/activeclients.
 * A API retorna Excel (.xlsx) ou CSV.
 * Autenticação: Basic Auth (User = DNS da academia, Password = Secret Key)
 */

import * as XLSX from "xlsx";

const EVO_API_BASE = "https://evo-integracao-api.w12app.com.br";
const EVO_USER = process.env.EVO_USER ?? "";
const EVO_SECRET = process.env.EVO_SECRET ?? "";

export interface AlunoAtivoEVO {
	idFilial: number;
	nomeFilial: string | null;
	nomeCliente: string | null;
	cpf: string | null;
	telefone: string | null;
	email: string | null;
	idCliente: number;
	descricaoContrato: string | null;
	tipoContrato: string | null;
	idTipoContrato: number;
	dataInicio: string | null;
	dataFim: string | null;
}

type ClienteRaw = Record<string, unknown>;

function getAuthHeader(): string {
	const credentials = Buffer.from(`${EVO_USER}:${EVO_SECRET}`).toString(
		"base64",
	);
	return `Basic ${credentials}`;
}

function toNum(val: string | number | undefined): number {
	if (val === undefined || val === null || val === "") return 0;
	return typeof val === "number" ? val : parseInt(String(val), 10) || 0;
}

function toStr(val: string | number | undefined): string | null {
	if (val === undefined || val === null) return null;
	const s = String(val).trim();
	return s === "" ? null : s;
}

function getRawVal(obj: ClienteRaw, ...keys: string[]): string | number | undefined {
	for (const k of keys) {
		const v = obj[k];
		if (v !== undefined && v !== null && v !== "") return v as string | number;
	}
	return undefined;
}

function rawParaAlunoAtivo(raw: ClienteRaw): AlunoAtivoEVO {
	return {
		idFilial: toNum(getRawVal(raw, "idFilial", "IdFilial")),
		nomeFilial: toStr(getRawVal(raw, "filial", "Filial")),
		nomeCliente: toStr(getRawVal(raw, "nomeCompleto", "NomeCompleto")),
		cpf: null,
		telefone: toStr(getRawVal(raw, "telefone", "Telefone")),
		email: toStr(getRawVal(raw, "email", "Email")),
		idCliente: toNum(getRawVal(raw, "idCliente", "IdCliente")),
		descricaoContrato: toStr(getRawVal(raw, "contratoAtivo", "ContratoAtivo")),
		tipoContrato: null,
		idTipoContrato: 0,
		dataInicio: toStr(getRawVal(raw, "dtInicioContratoAtivo", "DtInicioContratoAtivo")),
		dataFim: toStr(getRawVal(raw, "dtFimContratoAtivo", "DtFimContratoAtivo")),
	};
}

function isExcel(buffer: ArrayBuffer): boolean {
	if (buffer.byteLength < 2) return false;
	const arr = new Uint8Array(buffer);
	return arr[0] === 0x50 && arr[1] === 0x4b; // PK = ZIP/XLSX
}

/** Mapeia nomes de coluna do Excel/CSV (EVO pode usar variações) para chaves esperadas */
function normalizarCol(nome: string): string {
	const s = String(nome).trim().toLowerCase().replace(/\s+/g, "");
	const map: Record<string, string> = {
		idfilial: "idFilial",
		filial: "filial",
		idcliente: "idCliente",
		nomecompleto: "nomeCompleto",
		nome: "nomeCompleto",
		telefone: "telefone",
		email: "email",
		contratoativo: "contratoAtivo",
		contrato: "contratoAtivo",
		dtiniciocontratoativo: "dtInicioContratoAtivo",
		datainicio: "dtInicioContratoAtivo",
		inicio: "dtInicioContratoAtivo",
		dtfimcontratoativo: "dtFimContratoAtivo",
		datafim: "dtFimContratoAtivo",
		fim: "dtFimContratoAtivo",
	};
	return map[s] ?? nome;
}

/** Verifica se o texto parece CSV (cabeçalho com IdFilial ou IdCliente) */
function isCsv(text: string): boolean {
	const firstLine = text.split("\n")[0] ?? "";
	return (
		firstLine.includes("IdFilial") ||
		firstLine.includes("IdCliente") ||
		(firstLine.includes(";") && firstLine.toLowerCase().includes("filial"))
	);
}

/** Parse CSV com separador ; (formato EVO) */
function extrairClientesDeCSV(text: string): ClienteRaw[] {
	const lines = text.trim().split(/\r?\n/);
	if (lines.length < 2) return [];

	const sep = lines[0].includes(";") ? ";" : ",";
	const headers = parseCsvLine(lines[0], sep);
	const clientes: ClienteRaw[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i], sep);
		if (values.length === 0 || !values.some((v) => v.trim())) continue;

		const obj: ClienteRaw = {};
		headers.forEach((h, idx) => {
			const val = values[idx]?.trim();
			if (val) obj[normalizarCol(h)] = val;
		});
		if ("idCliente" in obj || "nomeCompleto" in obj) clientes.push(obj);
	}
	return clientes;
}

function parseCsvLine(line: string, sep: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const c = line[i];
		if (c === '"') {
			inQuotes = !inQuotes;
		} else if (!inQuotes && c === sep) {
			result.push(current);
			current = "";
		} else {
			current += c;
		}
	}
	result.push(current);
	return result;
}

/** Extrai clientes de planilha Excel retornada pela API */
function extrairClientesDeExcel(buffer: ArrayBuffer): ClienteRaw[] {
	const workbook = XLSX.read(buffer, { type: "array" });
	const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
	if (!firstSheet) return [];

	const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
		raw: false,
		defval: "",
	});
	if (rows.length === 0) return [];

	const clientes: ClienteRaw[] = [];
	for (const row of rows) {
		const obj: ClienteRaw = {};
		for (const [col, val] of Object.entries(row)) {
			if (val === undefined || val === null || String(val).trim() === "") continue;
			const key = normalizarCol(col);
			obj[key] = val;
		}
		const hasCliente = "idCliente" in obj || "nomeCompleto" in obj;
		if (hasCliente && Object.keys(obj).length > 0) clientes.push(obj);
	}
	return clientes;
}

/** Parse data no formato DD/MM/YYYY ou ISO */
function parseDataBR(str: string | null): Date | null {
	if (!str || !str.trim()) return null;
	const s = str.trim();
	const ddmmyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
	if (ddmmyy) {
		const [, d, m, y] = ddmmyy;
		const date = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10));
		return isNaN(date.getTime()) ? null : date;
	}
	const date = new Date(s);
	return isNaN(date.getTime()) ? null : date;
}

function estaAtivoNaData(
	aluno: AlunoAtivoEVO,
	dataReferencia: Date,
): boolean {
	const hoje = new Date(
		dataReferencia.getFullYear(),
		dataReferencia.getMonth(),
		dataReferencia.getDate(),
	);
	const inicio = parseDataBR(aluno.dataInicio);
	const fim = parseDataBR(aluno.dataFim);

	if (!inicio) return false;
	if (!fim) return hoje >= new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());

	const inicioDate = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
	const fimDate = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());

	return hoje >= inicioDate && hoje <= fimDate;
}

/**
 * Busca alunos ativos na EVO (endpoint activeclients) e filtra os vigentes na data.
 * @param dataReferencia - Data para checar vigência (padrão: hoje)
 */
export async function getAlunosAtivos(
	dataReferencia: Date = new Date(),
): Promise<{ alunos: AlunoAtivoEVO[]; erro?: string }> {
	if (!EVO_USER || !EVO_SECRET) {
		return {
			alunos: [],
			erro: "Credenciais EVO não configuradas. Defina EVO_USER e EVO_SECRET no .env",
		};
	}

	const url = `${EVO_API_BASE}/api/v2/management/activeclients`;

	try {
		const res = await fetch(url, {
			headers: {
				Authorization: getAuthHeader(),
				Accept: "text/csv, application/vnd.ms-excel, */*",
			},
		});

		const buffer = await res.arrayBuffer();

		if (!res.ok) {
			const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
			return {
				alunos: [],
				erro: `EVO API retornou ${res.status}: ${text.slice(0, 200)}`,
			};
		}

		if (res.status === 204 || buffer.byteLength === 0) {
			return { alunos: [] };
		}

		let clientesRaw: ClienteRaw[];
		if (isExcel(buffer)) {
			clientesRaw = extrairClientesDeExcel(buffer);
		} else {
			const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
			const trimmed = text.trim();
			if (isCsv(trimmed)) {
				clientesRaw = extrairClientesDeCSV(trimmed);
			} else {
				return {
					alunos: [],
					erro: `EVO API retornou conteúdo inesperado. Esperado Excel ou CSV.`,
				};
			}
		}

		const alunos = clientesRaw
			.map(rawParaAlunoAtivo)
			.filter((a) => estaAtivoNaData(a, dataReferencia));

		return { alunos };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Erro desconhecido";
		return { alunos: [], erro: `Erro ao buscar alunos na EVO: ${msg}` };
	}
}

function isFlCanceladoTrue(val: unknown): boolean {
	if (val === true) return true;
	if (val === 1) return true;
	const s = String(val ?? "").trim().toLowerCase();
	return ["true", "1", "sim", "yes"].includes(s);
}

/** Extrai linhas de planilha Excel/CSV e conta onde FlCancelado é true */
function contarCanceladosDeBuffer(
	buffer: ArrayBuffer,
	isExcelFile: boolean,
): number {
	if (isExcelFile) {
		const workbook = XLSX.read(buffer, { type: "array" });
		const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
		if (!firstSheet) return 0;

		const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
			firstSheet,
			{ raw: false, defval: "" },
		);

		return rows.filter((row) => {
			const val = row["FlCancelado"] ?? row["flCancelado"];
			return isFlCanceladoTrue(val);
		}).length;
	}

	const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
	const lines = text.trim().split(/\r?\n/);
	if (lines.length < 2) return 0;

	const sep = lines[0].includes(";") ? ";" : ",";
	const headers = lines[0].split(sep).map((h) => h.trim());
	const idxFlCancelado = headers.findIndex(
		(h) => h.toLowerCase().replace(/\s+/g, "") === "flcancelado",
	);
	if (idxFlCancelado < 0) return 0;

	let count = 0;
	for (let i = 1; i < lines.length; i++) {
		const cols = parseCsvLine(lines[i], sep);
		const val = cols[idxFlCancelado];
		if (isFlCanceladoTrue(val)) count++;
	}
	return count;
}

/**
 * Busca clientes não renovados (not-renewed) no mês e retorna
 * a quantidade de cancelamentos (FlCancelado = true).
 */
export async function getCancelamentosNoMes(
	dataRef: Date = new Date(),
): Promise<{ total: number; erro?: string }> {
	if (!EVO_USER || !EVO_SECRET) {
		return {
			total: 0,
			erro: "Credenciais EVO não configuradas. Defina EVO_USER e EVO_SECRET no .env",
		};
	}

	const ano = dataRef.getFullYear();
	const mes = dataRef.getMonth();
	const primeiroDia = `${ano}-${String(mes + 1).padStart(2, "0")}-01`;
	const ultimoDia = new Date(ano, mes + 1, 0).getDate();
	const dataFim = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;

	const url = `${EVO_API_BASE}/api/v2/management/not-renewed?dtStart=${primeiroDia}&dtEnd=${dataFim}`;

	try {
		const res = await fetch(url, {
			headers: {
				Authorization: getAuthHeader(),
				Accept: "text/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, */*",
			},
		});

		const buffer = await res.arrayBuffer();

		if (!res.ok) {
			const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
			return {
				total: 0,
				erro: `EVO API retornou ${res.status}: ${text.slice(0, 200)}`,
			};
		}

		if (res.status === 204 || buffer.byteLength === 0) {
			return { total: 0 };
		}

		const total = contarCanceladosDeBuffer(buffer, isExcel(buffer));
		return { total };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Erro desconhecido";
		return { total: 0, erro: `Erro ao buscar cancelamentos na EVO: ${msg}` };
	}
}
