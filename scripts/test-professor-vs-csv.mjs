import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
	for (const line of readFileSync(resolve(ROOT, ".env"), "utf8").split("\n")) {
		const m = line.match(/^([A-Z_]+)=(.*)$/);
		if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
	}
}

function norm(s) {
	return s.trim().replace(/\s+/g, " ").toUpperCase();
}

async function main() {
	loadEnv();
	const auth = `Basic ${Buffer.from(`${process.env.EVO_USER}:${process.env.EVO_SECRET}`).toString("base64")}`;
	const headers = { Authorization: auth, Accept: "application/json" };

	const lines = readFileSync(resolve(ROOT, "public/clientes_pilates.csv"), "utf8")
		.trim()
		.split(/\r?\n/)
		.slice(1);

	const rows = lines.map((line) => {
		const c = line.split(";");
		return {
			id: c[0],
			nome: [c[1], c[2]].filter(Boolean).join(" ").trim(),
			csvProf: c[3]?.trim() ?? "",
		};
	});

	let ok = 0;
	let diff = 0;
	let sem = 0;
	const diffs = [];
	const semLista = [];

	for (const row of rows) {
		await new Promise((r) => setTimeout(r, 600));
		const res = await fetch(
			`https://evo-integracao-api.w12app.com.br/api/v1/activities/enrollment/member-enrollment?idMember=${row.id}&status=1`,
			{ headers },
		);
		const data = await res.json();
		const arr = Array.isArray(data) ? data : [];
		const pilates = arr.filter((a) =>
			/pilates/i.test(a.activityName ?? a.ActivityName ?? ""),
		);
		const profs = [
			...new Set(
				pilates.map((a) => (a.teacherName ?? a.TeacherName ?? "").trim()).filter(Boolean),
			),
		];

		if (profs.length === 0) {
			sem++;
			semLista.push(row);
			continue;
		}

		const apiProf = profs[0];
		if (norm(apiProf) === norm(row.csvProf)) {
			ok++;
		} else {
			diff++;
			diffs.push({ ...row, apiProf, profs });
		}
	}

	console.log("=== Professor: CSV vs API (member-enrollment) ===\n");
	console.log(`Total CSV:              ${rows.length}`);
	console.log(`Professor igual:        ${ok}`);
	console.log(`Professor diferente:    ${diff}`);
	console.log(`Sem matrícula Pilates:  ${sem}`);
	console.log(`Cobertura:              ${((ok / rows.length) * 100).toFixed(1)}%`);

	if (diffs.length) {
		console.log("\n--- Diferenças ---");
		for (const d of diffs) {
			console.log(`  ${d.id} ${d.nome}`);
			console.log(`    CSV: ${d.csvProf}`);
			console.log(`    API: ${d.apiProf}${d.profs.length > 1 ? ` (todos: ${d.profs.join(" | ")})` : ""}`);
		}
	}

	if (semLista.length) {
		console.log("\n--- Sem inscrição ativa em Pilates Studio ---");
		for (const s of semLista) {
			console.log(`  ${s.id} ${s.nome} (CSV prof: ${s.csvProf})`);
		}
	}
}

main().catch(console.error);
