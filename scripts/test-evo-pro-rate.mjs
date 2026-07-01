/**
 * Testa rate limit da EVO sem delay artificial.
 * Uso: node --env-file=.env scripts/test-evo-pro-rate.mjs
 */
import { readFileSync } from "node:fs";

const BASE = "https://evo-integracao-api.w12app.com.br";

function carregarEnv() {
	try {
		const texto = readFileSync(".env", "utf8");
		for (const linha of texto.split("\n")) {
			const t = linha.trim();
			if (!t || t.startsWith("#")) continue;
			const i = t.indexOf("=");
			if (i < 0) continue;
			const chave = t.slice(0, i).trim();
			let valor = t.slice(i + 1).trim();
			if (
				(valor.startsWith('"') && valor.endsWith('"')) ||
				(valor.startsWith("'") && valor.endsWith("'"))
			) {
				valor = valor.slice(1, -1);
			}
			if (!process.env[chave]) process.env[chave] = valor;
		}
	} catch {
		// .env opcional com --env-file
	}
}

carregarEnv();

const user = process.env.EVO_USER;
const secret = process.env.EVO_SECRET;
if (!user || !secret) {
	console.error("EVO_USER / EVO_SECRET não configurados");
	process.exit(1);
}

const auth = `Basic ${Buffer.from(`${user}:${secret}`).toString("base64")}`;

async function request(url) {
	const inicio = performance.now();
	const res = await fetch(url, {
		headers: { Authorization: auth, Accept: "application/json" },
	});
	const ms = Math.round(performance.now() - inicio);
	const texto = res.status === 204 ? "" : await res.text();
	return {
		status: res.status,
		ms,
		texto,
		resumo: texto.slice(0, 120),
	};
}

async function fluxoPilates({ delayMs = 0 } = {}) {
	const inicioFluxo = performance.now();
	let totalReq = 0;
	let erros429 = 0;

	async function req(url) {
		if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
		totalReq++;
		const r = await request(url);
		if (r.status === 429) {
			erros429++;
			console.log("  429:", r.resumo);
		}
		return r;
	}

	const planos = await req(
		`${BASE}/api/v2/membership?take=50&skip=0&active=true`,
	);
	if (planos.status !== 200) {
		return { ok: false, motivo: `membership ${planos.status}`, totalReq, erros429 };
	}

	let lista;
	try {
		const parsed = JSON.parse(planos.texto);
		lista = Array.isArray(parsed) ? parsed : (parsed.list ?? []);
	} catch {
		return { ok: false, motivo: "JSON membership inválido", totalReq, erros429 };
	}

	let todosPlanos = [...lista];
	let skip = lista.length;
	while (lista.length === 50) {
		const prox = await req(
			`${BASE}/api/v2/membership?take=50&skip=${skip}&active=true`,
		);
		if (prox.status !== 200) break;
		const parsed = JSON.parse(prox.texto);
		lista = Array.isArray(parsed) ? parsed : (parsed.list ?? []);
		todosPlanos.push(...lista);
		skip += 50;
	}

	const planosPilates = todosPlanos.filter((p) =>
		/PILATES/i.test(p.nameMembership ?? ""),
	);

	console.log(`Planos pilates: ${planosPilates.length}`);

	for (const plano of planosPilates) {
		await req(
			`${BASE}/api/v3/membermembership?idMembership=${plano.idMembership}` +
				`&statusMemberMembership=1&take=25&skip=0`,
		);
	}

	await req(
		`${BASE}/api/v2/members?idsMembers=24380,5970,4490,11882,5741` +
			`&showMemberships=true&take=50`,
	);

	return {
		ok: erros429 === 0,
		totalReq,
		erros429,
		segundos: ((performance.now() - inicioFluxo) / 1000).toFixed(1),
	};
}

async function burst(n, url, delayMs = 0) {
	const resultados = [];
	for (let i = 0; i < n; i++) {
		if (delayMs > 0 && i > 0) await new Promise((r) => setTimeout(r, delayMs));
		const r = await request(url);
		resultados.push(r);
		process.stdout.write(r.status === 429 ? "X" : ".");
	}
	process.stdout.write("\n");
	return resultados;
}

function resumir(resultados) {
	const ok = resultados.filter((r) => r.status >= 200 && r.status < 300).length;
	const rate = resultados.filter((r) => r.status === 429).length;
	const outros = resultados.length - ok - rate;
	const tempoMedio = Math.round(
		resultados.reduce((s, r) => s + r.ms, 0) / resultados.length,
	);
	return { ok, rate, outros, tempoMedio };
}

const urlMembership =
	`${BASE}/api/v2/membership?take=10&skip=0&active=true`;

const modo = process.argv[2] ?? "pilates";
const delayMs = Number.parseInt(process.argv[3] ?? "0", 10) || 0;

if (modo === "burst") {
	console.log("=== 50 requests seguidas (sem delay) ===");
	const r1 = await burst(50, urlMembership);
	console.log(resumir(r1));
	const ex = r1.find((r) => r.status === 429);
	if (ex) console.log("Exemplo 429:", ex.resumo);
	process.exit(0);
}

console.log(
	`=== Fluxo pilates${delayMs > 0 ? ` (delay ${delayMs}ms)` : " sem delay"} ===`,
);
const fluxo = await fluxoPilates({ delayMs });
console.log(fluxo);

if (fluxo.ok) {
	console.log("\n✓ Fluxo concluído sem 429.");
} else {
	console.log("\n✗ Houve 429 — verificar plano API ou aumentar intervalo.");
}
