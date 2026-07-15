/**
 * Integração com a API EVO (W12) para dados de membros/alunos.
 * - activeclients: Excel/CSV com um contrato principal por cliente
 * - membermembership (v3): JSON com um registro por contrato (filtro por plano/status)
 * Autenticação: Basic Auth (User = DNS da academia, Password = Secret Key)
 */

import * as XLSX from "xlsx";
import {
	type FiltroPlanoId,
	getFiltroPlanoPorId,
	planoCorrespondeFiltroId,
} from "~/lib/planos-evo-filtros";

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

/** Contrato individual retornado por /api/v3/membermembership */
export interface ContratoAtivoEVO {
	idCliente: number;
	nomeCliente: string;
	idPlano: number;
	nomePlano: string;
	valor: number;
	dataInicio: string | null;
	dataFim: string | null;
	documento: string | null;
}

export interface ProfessorEVO {
	id: number;
	nome: string;
}

/** Contrato ativo + conexão (professor/consultor) do aluno */
export interface ClientePlanoEVO extends ContratoAtivoEVO {
	idProfessor: number | null;
	nomeProfessor: string | null;
	nomeConsultor: string | null;
}

const STATUS_CONTRATO_ATIVO = 1;
const MEMBERSHIP_PAGE_SIZE = 50;
const CONTRATO_PAGE_SIZE = 25;
const MEMBROS_PAGE_SIZE = 50;
const EVO_API_PRO =
	process.env.EVO_API_PRO === "true" || process.env.EVO_API_PRO === "1";
const EVO_LIMITE_REQUESTS_POR_MINUTO = 40;
const EVO_LIMITE_REQUESTS_POR_SEGUNDO = 5;
const EVO_INTERVALO_PLUS_MS =
	Math.ceil(60_000 / EVO_LIMITE_REQUESTS_POR_MINUTO) + 100;
const EVO_INTERVALO_PRO_MS =
	Math.ceil(1000 / EVO_LIMITE_REQUESTS_POR_SEGUNDO) + 50;
const EVO_ESPERA_429_MINUTO_MS = 65_000;
const EVO_ESPERA_429_SEGUNDO_MS = 1_100;
const EVO_MAX_RETRIES_429 = 3;
const CACHE_PLANOS_TTL_MS = 60 * 60 * 1000;
const CACHE_CONSULTA_PLANO_TTL_MS = 10 * 60 * 1000;

let ultimoRequestEVOMS = 0;
let filaThrottleEVO: Promise<void> = Promise.resolve();

type CachePlanosAtivos = {
	planos: PlanoEVORaw[];
	expiraEm: number;
};

type CacheConsultaPlanoEntry = {
	dataRef: string;
	todosClientes: ClientePlanoEVO[];
	professores: ProfessorEVO[];
	expiraEm: number;
};

let cachePlanosAtivos: CachePlanosAtivos | null = null;
const cacheConsultaPlano = new Map<FiltroPlanoId, CacheConsultaPlanoEntry>();

type ClienteRaw = Record<string, unknown>;

type PlanoEVORaw = {
	idMembership: number;
	nameMembership: string;
	inactive?: boolean;
};

type ContratoEVORaw = {
	idMember: number;
	name: string;
	idMembership: number;
	nameMembership: string;
	saleValue: number;
	membershipStart: string;
	membershipEnd: string;
	memberDocument?: string | null;
	statusMemberMembership: number;
};

type MembershipListResponse = {
	list?: PlanoEVORaw[];
};

type MembroConexaoRaw = {
	idMember: number;
	nameEmployeeInstructor?: string | null;
	idEmployeeInstructor?: number | null;
	nameEmployeeConsultant?: string | null;
	idEmployeeConsultant?: number | null;
};

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

function credenciaisNaoConfiguradas(): string {
	return "Credenciais EVO não configuradas. Defina EVO_USER e EVO_SECRET no .env";
}

function normalizarTextoPlano(texto: string): string {
	return texto.trim().toUpperCase();
}

function planoCorrespondeFiltro(nomePlano: string, filtroPlano: string): boolean {
	return normalizarTextoPlano(nomePlano).includes(
		normalizarTextoPlano(filtroPlano),
	);
}

function dataSemHorario(data: Date): Date {
	return new Date(data.getFullYear(), data.getMonth(), data.getDate());
}

function parseDataISO(str: string | null): Date | null {
	if (!str?.trim()) return null;
	const date = new Date(str.trim());
	return isNaN(date.getTime()) ? null : date;
}

function formatarDataBR(date: Date): string {
	const d = String(date.getDate()).padStart(2, "0");
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const y = date.getFullYear();
	return `${d}/${m}/${y}`;
}

function contratoVigenteNaData(
	contrato: ContratoEVORaw,
	dataReferencia: Date,
): boolean {
	const hoje = dataSemHorario(dataReferencia);
	const inicio = parseDataISO(contrato.membershipStart);
	const fim = parseDataISO(contrato.membershipEnd);

	if (!inicio) return false;
	const inicioDate = dataSemHorario(inicio);
	if (hoje < inicioDate) return false;
	if (!fim) return true;

	return hoje <= dataSemHorario(fim);
}

function contratoRawParaAtivo(raw: ContratoEVORaw): ContratoAtivoEVO {
	const inicio = parseDataISO(raw.membershipStart);
	const fim = parseDataISO(raw.membershipEnd);

	return {
		idCliente: raw.idMember,
		nomeCliente: raw.name.trim(),
		idPlano: raw.idMembership,
		nomePlano: raw.nameMembership.trim(),
		valor: raw.saleValue,
		dataInicio: inicio ? formatarDataBR(inicio) : null,
		dataFim: fim ? formatarDataBR(fim) : null,
		documento: raw.memberDocument?.trim() || null,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function chaveDataReferencia(data: Date): string {
	return data.toISOString().slice(0, 10);
}

function obterIntervaloMinimoEVOMS(): number {
	return EVO_API_PRO ? EVO_INTERVALO_PRO_MS : EVO_INTERVALO_PLUS_MS;
}

function esperaApos429(corpoErro: string): number {
	const texto = corpoErro.toLowerCase();
	if (
		texto.includes("5 per 1s") ||
		texto.includes("per 1s") ||
		texto.includes("quota exceeded")
	) {
		return EVO_ESPERA_429_SEGUNDO_MS;
	}
	if (texto.includes("per minute") || texto.includes("40 request")) {
		return EVO_ESPERA_429_MINUTO_MS;
	}
	return EVO_API_PRO ? EVO_ESPERA_429_SEGUNDO_MS : EVO_ESPERA_429_MINUTO_MS;
}

function aguardarSlotEVO(): Promise<void> {
	const intervaloMinimo = obterIntervaloMinimoEVOMS();
	const execucao = filaThrottleEVO.then(async () => {
		const agora = Date.now();
		const intervalo = agora - ultimoRequestEVOMS;
		if (ultimoRequestEVOMS > 0 && intervalo < intervaloMinimo) {
			await sleep(intervaloMinimo - intervalo);
		}
		ultimoRequestEVOMS = Date.now();
	});
	filaThrottleEVO = execucao.catch(() => {});
	return execucao;
}

async function fetchEVOResponse(
	url: string,
	init: RequestInit = {},
	tentativa429 = 0,
): Promise<Response> {
	await aguardarSlotEVO();

	const res = await fetch(url, {
		...init,
		headers: {
			Authorization: getAuthHeader(),
			...init.headers,
		},
	});

	if (res.status === 429 && tentativa429 < EVO_MAX_RETRIES_429) {
		const corpoErro = await res.text();
		await sleep(esperaApos429(corpoErro));
		ultimoRequestEVOMS = 0;
		return fetchEVOResponse(url, init, tentativa429 + 1);
	}

	return res;
}

async function fetchJsonEVO<T>(url: string): Promise<T> {
	const res = await fetchEVOResponse(url, {
		headers: { Accept: "application/json" },
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`EVO API retornou ${res.status}: ${text.slice(0, 200)}`);
	}

	return res.json() as Promise<T>;
}

async function listarPlanosAtivosEVO(): Promise<PlanoEVORaw[]> {
	if (cachePlanosAtivos && Date.now() < cachePlanosAtivos.expiraEm) {
		return cachePlanosAtivos.planos;
	}

	const planos: PlanoEVORaw[] = [];
	let skip = 0;

	while (true) {
		const url =
			`${EVO_API_BASE}/api/v2/membership?take=${MEMBERSHIP_PAGE_SIZE}` +
			`&skip=${skip}&active=true`;
		const data = await fetchJsonEVO<MembershipListResponse | PlanoEVORaw[]>(url);
		const lista = Array.isArray(data) ? data : (data.list ?? []);
		planos.push(...lista);

		if (lista.length < MEMBERSHIP_PAGE_SIZE) break;
		skip += MEMBERSHIP_PAGE_SIZE;
	}

	cachePlanosAtivos = {
		planos,
		expiraEm: Date.now() + CACHE_PLANOS_TTL_MS,
	};

	return planos;
}

function obterCacheConsultaPlano(
	filtroPlanoId: FiltroPlanoId,
	dataReferencia: Date,
): CacheConsultaPlanoEntry | undefined {
	const entry = cacheConsultaPlano.get(filtroPlanoId);
	if (!entry || Date.now() >= entry.expiraEm) return undefined;
	if (entry.dataRef !== chaveDataReferencia(dataReferencia)) return undefined;
	return entry;
}

function salvarCacheConsultaPlano(
	filtroPlanoId: FiltroPlanoId,
	dataReferencia: Date,
	todosClientes: ClientePlanoEVO[],
	professores: ProfessorEVO[],
): void {
	cacheConsultaPlano.set(filtroPlanoId, {
		dataRef: chaveDataReferencia(dataReferencia),
		todosClientes,
		professores,
		expiraEm: Date.now() + CACHE_CONSULTA_PLANO_TTL_MS,
	});
}

function filtrarClientesPorProfessor(
	clientes: ClientePlanoEVO[],
	idProfessor?: number,
): ClientePlanoEVO[] {
	if (idProfessor == null) return clientes;
	return clientes.filter((c) => c.idProfessor === idProfessor);
}

async function getIdsPlanosPorNome(filtroPlano: string): Promise<number[]> {
	const planos = await listarPlanosAtivosEVO();
	return planos
		.filter((plano) => planoCorrespondeFiltro(plano.nameMembership, filtroPlano))
		.map((plano) => plano.idMembership);
}

async function getIdsPlanosPorFiltroId(
	filtroId: FiltroPlanoId,
): Promise<number[]> {
	const planos = await listarPlanosAtivosEVO();
	return planos
		.filter((plano) =>
			planoCorrespondeFiltroId(plano.nameMembership, filtroId),
		)
		.map((plano) => plano.idMembership);
}

function deduplicarContratosPorCliente(
	contratos: ContratoAtivoEVO[],
): ContratoAtivoEVO[] {
	const porCliente = new Map<number, ContratoAtivoEVO>();

	for (const contrato of contratos) {
		const atual = porCliente.get(contrato.idCliente);
		if (!atual) {
			porCliente.set(contrato.idCliente, contrato);
			continue;
		}

		const fimAtual = parseDataBR(atual.dataFim);
		const fimNovo = parseDataBR(contrato.dataFim);
		if (!fimAtual) continue;
		if (!fimNovo || fimNovo > fimAtual) {
			porCliente.set(contrato.idCliente, contrato);
		}
	}

	return [...porCliente.values()];
}

async function buscarConexoesMembros(
	idsClientes: number[],
): Promise<Map<number, MembroConexaoRaw>> {
	const mapa = new Map<number, MembroConexaoRaw>();
	const unicos = [...new Set(idsClientes)];

	for (let i = 0; i < unicos.length; i += MEMBROS_PAGE_SIZE) {
		const chunk = unicos.slice(i, i + MEMBROS_PAGE_SIZE).join(",");
		const url =
			`${EVO_API_BASE}/api/v2/members?idsMembers=${chunk}` +
			`&showMemberships=true&take=${MEMBROS_PAGE_SIZE}`;
		const batch = await fetchJsonEVO<MembroConexaoRaw[]>(url);

		if (!Array.isArray(batch)) continue;

		for (const membro of batch) {
			mapa.set(membro.idMember, membro);
		}
	}

	return mapa;
}

function montarProfessoresDisponiveis(
	clientes: ClientePlanoEVO[],
): ProfessorEVO[] {
	const mapa = new Map<number, string>();

	for (const cliente of clientes) {
		if (cliente.idProfessor == null || !cliente.nomeProfessor) continue;
		mapa.set(cliente.idProfessor, cliente.nomeProfessor);
	}

	return [...mapa.entries()]
		.map(([id, nome]) => ({ id, nome }))
		.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function anexarConexaoAoContrato(
	contrato: ContratoAtivoEVO,
	conexao?: MembroConexaoRaw,
): ClientePlanoEVO {
	return {
		...contrato,
		idProfessor: conexao?.idEmployeeInstructor ?? null,
		nomeProfessor: conexao?.nameEmployeeInstructor?.trim() || null,
		nomeConsultor: conexao?.nameEmployeeConsultant?.trim() || null,
	};
}

async function getContratosAtivosDoPlano(
	idPlano: number,
): Promise<ContratoEVORaw[]> {
	const contratos: ContratoEVORaw[] = [];
	let skip = 0;

	while (true) {
		const url =
			`${EVO_API_BASE}/api/v3/membermembership?idMembership=${idPlano}` +
			`&statusMemberMembership=${STATUS_CONTRATO_ATIVO}` +
			`&take=${CONTRATO_PAGE_SIZE}&skip=${skip}`;
		const batch = await fetchJsonEVO<ContratoEVORaw[]>(url);

		if (!Array.isArray(batch) || batch.length === 0) break;

		contratos.push(
			...batch.filter((c) => c.statusMemberMembership === STATUS_CONTRATO_ATIVO),
		);

		if (batch.length < CONTRATO_PAGE_SIZE) break;
		skip += CONTRATO_PAGE_SIZE;
	}

	return contratos;
}

/**
 * Busca contratos ativos de um tipo de plano (ex.: "pilates") via membermembership.
 * Usa statusMemberMembership=1 (ativo) e filtra vigência na data de referência.
 */
export async function getContratosAtivosPorPlano(
	filtroPlano: string,
	dataReferencia: Date = new Date(),
): Promise<{ contratos: ContratoAtivoEVO[]; erro?: string }> {
	if (!EVO_USER || !EVO_SECRET) {
		return { contratos: [], erro: credenciaisNaoConfiguradas() };
	}

	const filtro = filtroPlano.trim();
	if (!filtro) {
		return { contratos: [], erro: "Informe o nome do plano para filtrar." };
	}

	try {
		const idsPlanos = await getIdsPlanosPorNome(filtro);
		if (idsPlanos.length === 0) {
			return { contratos: [], erro: `Nenhum plano encontrado para "${filtro}".` };
		}

		const contratos: ContratoAtivoEVO[] = [];

		for (const idPlano of idsPlanos) {
			const batch = await getContratosAtivosDoPlano(idPlano);
			for (const raw of batch) {
				if (!contratoVigenteNaData(raw, dataReferencia)) continue;
				contratos.push(contratoRawParaAtivo(raw));
			}
		}

		contratos.sort((a, b) => a.nomeCliente.localeCompare(b.nomeCliente, "pt-BR"));

		return { contratos };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Erro desconhecido";
		return {
			contratos: [],
			erro: `Erro ao buscar contratos na EVO: ${msg}`,
		};
	}
}

async function buscarClientesPlanoComConexao(
	filtroPlanoId: FiltroPlanoId,
	dataReferencia: Date,
): Promise<{
	todosClientes: ClientePlanoEVO[];
	professores: ProfessorEVO[];
	erro?: string;
}> {
	const filtro = getFiltroPlanoPorId(filtroPlanoId);
	if (!filtro) {
		return { todosClientes: [], professores: [], erro: "Tipo de plano inválido." };
	}

	const idsPlanos = await getIdsPlanosPorFiltroId(filtroPlanoId);
	if (idsPlanos.length === 0) {
		return {
			todosClientes: [],
			professores: [],
			erro: `Nenhum plano ativo encontrado para "${filtro.label}".`,
		};
	}

	const contratosBrutos: ContratoAtivoEVO[] = [];

	for (const idPlano of idsPlanos) {
		const batch = await getContratosAtivosDoPlano(idPlano);
		for (const raw of batch) {
			if (!contratoVigenteNaData(raw, dataReferencia)) continue;
			contratosBrutos.push(contratoRawParaAtivo(raw));
		}
	}

	const contratosUnicos = deduplicarContratosPorCliente(contratosBrutos);
	const conexoes = await buscarConexoesMembros(
		contratosUnicos.map((c) => c.idCliente),
	);

	const todosClientes = contratosUnicos.map((contrato) =>
		anexarConexaoAoContrato(contrato, conexoes.get(contrato.idCliente)),
	);

	const professores = montarProfessoresDisponiveis(todosClientes);

	todosClientes.sort((a, b) =>
		a.nomeCliente.localeCompare(b.nomeCliente, "pt-BR"),
	);

	return { todosClientes, professores };
}

/**
 * Busca clientes com contrato ativo vigente, filtrados por tipo de plano e
 * opcionalmente pelo professor da conexão do aluno (nameEmployeeInstructor).
 */
export async function getClientesAtivosPorPlanoComConexao(
	filtroPlanoId: FiltroPlanoId,
	idProfessor?: number,
	dataReferencia: Date = new Date(),
): Promise<{
	clientes: ClientePlanoEVO[];
	professores: ProfessorEVO[];
	erro?: string;
}> {
	if (!EVO_USER || !EVO_SECRET) {
		return {
			clientes: [],
			professores: [],
			erro: credenciaisNaoConfiguradas(),
		};
	}

	const cache = obterCacheConsultaPlano(filtroPlanoId, dataReferencia);
	if (cache) {
		return {
			clientes: filtrarClientesPorProfessor(cache.todosClientes, idProfessor),
			professores: cache.professores,
		};
	}

	try {
		const resultado = await buscarClientesPlanoComConexao(
			filtroPlanoId,
			dataReferencia,
		);

		if (resultado.erro) {
			return {
				clientes: [],
				professores: [],
				erro: resultado.erro,
			};
		}

		salvarCacheConsultaPlano(
			filtroPlanoId,
			dataReferencia,
			resultado.todosClientes,
			resultado.professores,
		);

		return {
			clientes: filtrarClientesPorProfessor(
				resultado.todosClientes,
				idProfessor,
			),
			professores: resultado.professores,
		};
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Erro desconhecido";
		return {
			clientes: [],
			professores: [],
			erro: `Erro ao buscar clientes na EVO: ${msg}`,
		};
	}
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
		const res = await fetchEVOResponse(url, {
			headers: { Accept: "text/csv, application/vnd.ms-excel, */*" },
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
		const res = await fetchEVOResponse(url, {
			headers: {
				Accept:
					"text/csv, application/vnd.ms-excel, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, */*",
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

/** Nota fiscal de saída (NFS-e/NF-e/NFC-e) emitida via integração eNotas. */
export interface NotaFiscalSaidaEVO {
	id: string;
	tipo: string | null;
	numero: string | null;
	status: string | null;
	dataEmissao: string | null;
	enviadaPorEmail: boolean;
	nomeCliente: string | null;
	valorTotal: number;
	linkDownloadPDF: string | null;
}

type NotaFiscalRaw = {
	id: string;
	tipo?: string | null;
	numero?: string | null;
	status?: string | null;
	dataEmissao?: string | null;
	enviadaPorEmail?: boolean;
	cliente?: { nome?: string | null } | null;
	valorTotal?: number | null;
	linkDownloadPDF?: string | null;
};

const INVOICE_PAGE_SIZE = 250;

function rawParaNotaFiscal(raw: NotaFiscalRaw): NotaFiscalSaidaEVO {
	return {
		id: raw.id,
		tipo: raw.tipo ?? null,
		numero: raw.numero ?? null,
		status: raw.status ?? null,
		dataEmissao: raw.dataEmissao ?? null,
		enviadaPorEmail: raw.enviadaPorEmail ?? false,
		nomeCliente: raw.cliente?.nome ?? null,
		valorTotal: raw.valorTotal ?? 0,
		linkDownloadPDF: raw.linkDownloadPDF ?? null,
	};
}

export interface BuscarNotasFiscaisEVOParams {
	issueDateStart: Date;
	issueDateEnd: Date;
	/** Quando informado, retorna só notas cuja última alteração ocorreu a partir desta data (sincronização incremental). */
	lastDateChangeStart?: Date;
}

/**
 * Status "Emitida"/"Autorizada" no filtro `statusInvoice` do endpoint de
 * invoices (1-Emitida, 2-Com erro, 3-Cancelada, 4-Criada). É o único filtro
 * confiável: o campo de texto `status` retornado varia bastante entre
 * integrações ("Autorizada", "CancelamentoNegado", `null`, ...) e não segue
 * um vocabulário fixo, então não deve ser usado para decidir validade.
 */
const INVOICE_STATUS_EMITIDA = "1";

/**
 * Busca notas fiscais de saída (NFS-e/NF-e/NFC-e) emitidas com sucesso
 * (statusInvoice=1) no período informado, via `/api/v2/invoices/get-invoices`
 * (integração eNotas da EVO).
 */
export async function buscarNotasFiscaisSaidaEVO(
	params: BuscarNotasFiscaisEVOParams,
): Promise<{ notas: NotaFiscalSaidaEVO[]; erro?: string }> {
	if (!EVO_USER || !EVO_SECRET) {
		return { notas: [], erro: credenciaisNaoConfiguradas() };
	}

	try {
		const notas: NotaFiscalSaidaEVO[] = [];
		let skip = 0;

		while (true) {
			const qs = new URLSearchParams({
				issueDateStart: params.issueDateStart.toISOString(),
				issueDateEnd: params.issueDateEnd.toISOString(),
				statusInvoice: INVOICE_STATUS_EMITIDA,
				take: String(INVOICE_PAGE_SIZE),
				skip: String(skip),
			});
			if (params.lastDateChangeStart) {
				qs.set(
					"lastDateChangeStart",
					params.lastDateChangeStart.toISOString(),
				);
			}

			const url = `${EVO_API_BASE}/api/v2/invoices/get-invoices?${qs.toString()}`;
			const batch = await fetchJsonEVO<NotaFiscalRaw[]>(url);

			if (!Array.isArray(batch) || batch.length === 0) break;

			notas.push(...batch.map(rawParaNotaFiscal));

			if (batch.length < INVOICE_PAGE_SIZE) break;
			skip += INVOICE_PAGE_SIZE;
		}

		return { notas };
	} catch (err) {
		const msg = err instanceof Error ? err.message : "Erro desconhecido";
		return { notas: [], erro: `Erro ao buscar notas fiscais na EVO: ${msg}` };
	}
}
