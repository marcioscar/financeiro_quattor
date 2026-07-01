/**
 * Teste pontual: compara clientes_pilates.csv com a API EVO (membermembership).
 * Uso: node scripts/test-pilates-vs-csv.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const DELAY_MS = 1700;
const STATUS_ATIVO = 1;

function loadEnv() {
	const text = readFileSync(resolve(ROOT, ".env"), "utf8");
	for (const line of text.split("\n")) {
		const m = line.match(/^([A-Z_]+)=(.*)$/);
		if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
	}
}

function splitPipe(val) {
	return val.split(/\s*\|\s*/).map((s) => s.trim());
}

function parseValorBR(val) {
	return parseFloat(val.replace(",", ".").trim());
}

function parseCsvPilates(csvPath) {
	const lines = readFileSync(csvPath, "utf8").trim().split(/\r?\n/).slice(1);
	const rows = [];

	for (const line of lines) {
		const cols = line.split(";");
		const id = cols[0]?.trim();
		const nome = [cols[1], cols[2]].filter(Boolean).join(" ").trim();
		const contratos = splitPipe(cols[4] ?? "");
		const inicios = splitPipe(cols[5] ?? "");
		const vencimentos = splitPipe(cols[6] ?? "");
		const valores = splitPipe(cols[7] ?? "");

		const idx = contratos.findIndex((c) => /pilates/i.test(c));
		if (idx < 0) {
			rows.push({ id, nome, semPilates: true, contratosRaw: cols[4] });
			continue;
		}

		rows.push({
			id,
			nome,
			plano: contratos[idx].trim(),
			inicio: inicios[idx]?.trim() ?? "",
			vencimento: vencimentos[idx]?.trim() ?? "",
			valor: parseValorBR(valores[idx] ?? "0"),
		});
	}

	return rows;
}

function formatarDataBR(iso) {
	const d = new Date(iso);
	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	return `${dd}/${mm}/${d.getFullYear()}`;
}

function vigenteHoje(inicioISO, fimISO, ref) {
	const hoje = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
	const iniD = new Date(new Date(inicioISO).setHours(0, 0, 0, 0));
	const fimD = new Date(new Date(fimISO).setHours(0, 0, 0, 0));
	return hoje >= iniD && hoje <= fimD;
}

async function aguardar(ms = DELAY_MS) {
	await new Promise((r) => setTimeout(r, ms));
}

async function fetchContratosMembro(idMembro, auth) {
	await aguardar();
	// Nota: statusMemberMembership na URL não funciona bem com idMember;
	// filtramos status=1 no código depois.
	const url =
		`https://evo-integracao-api.w12app.com.br/api/v3/membermembership` +
		`?idMember=${idMembro}`;
	const res = await fetch(url, {
		headers: { Authorization: auth, Accept: "application/json" },
	});

	if (res.status === 429) {
		console.log(`  rate limit no cliente ${idMembro} — aguardando 65s`);
		await aguardar(65000);
		return fetchContratosMembro(idMembro, auth);
	}

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Cliente ${idMembro}: HTTP ${res.status} ${body.slice(0, 120)}`);
	}

	const data = await res.json();
	return Array.isArray(data) ? data : [];
}

function extrairPilatesVigente(contratos, dataRef) {
	const pilates = contratos.filter(
		(c) =>
			c.statusMemberMembership === STATUS_ATIVO &&
			/pilates/i.test(c.nameMembership ?? "") &&
			vigenteHoje(c.membershipStart, c.membershipEnd, dataRef),
	);

	if (pilates.length === 0) return null;

	// Se houver mais de um vigente, pega o que termina mais tarde (contrato atual)
	pilates.sort(
		(a, b) =>
			new Date(b.membershipEnd).getTime() - new Date(a.membershipEnd).getTime(),
	);

	const c = pilates[0];
	return {
		plano: c.nameMembership?.trim() ?? "",
		inicio: formatarDataBR(c.membershipStart),
		vencimento: formatarDataBR(c.membershipEnd),
		valor: Number(c.saleValue),
	};
}

function normalizarPlano(s) {
	return s.trim().replace(/\s+/g, " ").toUpperCase();
}

async function main() {
	loadEnv();
	const user = process.env.EVO_USER;
	const secret = process.env.EVO_SECRET;
	if (!user || !secret) {
		console.error("EVO_USER / EVO_SECRET não configurados");
		process.exit(1);
	}

	const auth = `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`;
	const dataRef = new Date();
	const csvRows = parseCsvPilates(resolve(ROOT, "public/clientes_pilates.csv"));

	console.log("=== Teste Pilates: CSV vs API EVO ===");
	console.log("Data referência:", dataRef.toLocaleDateString("pt-BR"));
	console.log("Filtros API: statusMemberMembership=1 + vigente hoje + nome contém PILATES");
	console.log(`Consultando ${csvRows.length} clientes do CSV (~${Math.ceil((csvRows.length * DELAY_MS) / 1000)}s)\n`);

	const matches = [];
	const divergencias = [];
	const soNoCsv = [];
	const semPilatesNoCsv = csvRows.filter((r) => r.semPilates);

	for (const csv of csvRows) {
		if (csv.semPilates) continue;

		process.stdout.write(`  ${csv.id}... `);
		const contratos = await fetchContratosMembro(csv.id, auth);
		const api = extrairPilatesVigente(contratos, dataRef);

		if (!api) {
			console.log("API: sem pilates ativo vigente");
			soNoCsv.push(csv);
			continue;
		}

		const diffs = [];
		if (normalizarPlano(csv.plano) !== normalizarPlano(api.plano)) {
			diffs.push({ campo: "plano", csv: csv.plano, api: api.plano });
		}
		if (csv.inicio !== api.inicio) {
			diffs.push({ campo: "inicio", csv: csv.inicio, api: api.inicio });
		}
		if (csv.vencimento !== api.vencimento) {
			diffs.push({ campo: "vencimento", csv: csv.vencimento, api: api.vencimento });
		}
		if (Math.abs(csv.valor - api.valor) > 0.01) {
			diffs.push({ campo: "valor", csv: csv.valor, api: api.valor });
		}

		if (diffs.length === 0) {
			console.log("OK");
			matches.push(csv.id);
		} else {
			console.log("DIFERENTE");
			divergencias.push({ id: csv.id, nome: csv.nome, diffs });
		}
	}

	const csvComPilates = csvRows.filter((r) => !r.semPilates);

	console.log("\n--- Resumo ---");
	console.log(`CSV total:                  ${csvRows.length}`);
	console.log(`CSV com PILATES:            ${csvComPilates.length}`);
	console.log(`CSV sem PILATES na linha:   ${semPilatesNoCsv.length}`);
	console.log(`Match exato:                ${matches.length}`);
	console.log(`Divergências:               ${divergencias.length}`);
	console.log(`No CSV, API sem pilates:    ${soNoCsv.length}`);

	if (semPilatesNoCsv.length) {
		console.log("\n--- CSV sem plano PILATES ---");
		for (const r of semPilatesNoCsv) {
			console.log(`  ${r.id} ${r.nome}: ${r.contratosRaw}`);
		}
	}

	if (divergencias.length) {
		console.log("\n--- Divergências ---");
		for (const d of divergencias) {
			console.log(`  ${d.id} ${d.nome}`);
			for (const diff of d.diffs) {
				console.log(`    ${diff.campo}: CSV="${diff.csv}" | API="${diff.api}"`);
			}
		}
	}

	if (soNoCsv.length) {
		console.log("\n--- No CSV mas API não achou pilates vigente ---");
		for (const r of soNoCsv) {
			console.log(`  ${r.id} ${r.nome} | CSV: ${r.plano} ${r.valor}`);
		}
	}

	const pct =
		csvComPilates.length > 0
			? ((matches.length / csvComPilates.length) * 100).toFixed(1)
			: "0";
	console.log(`\n=== Cobertura: ${matches.length}/${csvComPilates.length} (${pct}%) ===`);

	const igual =
		divergencias.length === 0 &&
		soNoCsv.length === 0 &&
		semPilatesNoCsv.length === 0;

	console.log(
		igual
			? "RESULTADO: CSV e API batem 100%."
			: "RESULTADO: CSV e API NÃO são idênticos.",
	);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
