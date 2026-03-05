import path from "node:path";
import type { LoaderFunctionArgs } from "react-router";
import { getBancoTreinosByCicloTreino } from "~/models/banco_treino.server";
import { renderTreinoPdfToBuffer } from "~/components/treinos/folha-treino-pdf";

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const ciclo = url.searchParams.get("ciclo");
	const treino = url.searchParams.get("treino");

	if (!ciclo?.trim() || !treino?.trim()) {
		return new Response("Parâmetros ciclo e treino são obrigatórios", {
			status: 400,
		});
	}

	const bancoTreinos = await getBancoTreinosByCicloTreino({
		ciclo: ciclo.trim(),
		treino: treino.trim(),
	});

	if (bancoTreinos.length === 0) {
		return new Response("Nenhum treino encontrado para este ciclo e treino", {
			status: 404,
		});
	}

	const grupos = bancoTreinos.map((bt) => ({
		grupo: bt.grupo,
		exercicios: bt.exercicios ?? [],
	}));

	const publicDir = path.join(process.cwd(), "public");
	const logoSrc = path.join(publicDir, "logopng.png");
	const bolasSrc = path.join(publicDir, "bolaspng.png");
	const rotateCcwSrc = path.join(publicDir, "rotate-ccw.png");

	const buffer = await renderTreinoPdfToBuffer(
		grupos,
		ciclo.trim(),
		treino.trim(),
		logoSrc,
		bolasSrc,
		rotateCcwSrc,
	);

	const treinoNorm = treino.trim().replace(/\s+/g, "");
	const filename = `treino_${treinoNorm}_${ciclo.trim().replace(/\s+/g, "_")}.pdf`;

	return new Response(buffer, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Content-Length": String(buffer.length),
		},
	});
}
