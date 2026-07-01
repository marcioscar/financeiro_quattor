import type { LoaderFunctionArgs } from "react-router";
import { renderRepasseProfessorPdfToBuffer } from "~/components/planos/repasse-professor-pdf";
import { montarNomeArquivoRepassePdf } from "~/lib/planos-repasse-pdf";
import {
	getFiltroPlanoPorId,
	type FiltroPlanoId,
} from "~/lib/planos-evo-filtros";
import { carregarClientesPlanos } from "~/models/planos-dados.server";

function parseMesAno(url: URL): { mes: number; ano: number } {
	const hoje = new Date();
	const mesParam = Number.parseInt(url.searchParams.get("mes") ?? "", 10);
	const anoParam = Number.parseInt(url.searchParams.get("ano") ?? "", 10);

	return {
		mes:
			Number.isFinite(mesParam) && mesParam >= 1 && mesParam <= 12
				? mesParam
				: hoje.getMonth() + 1,
		ano:
			Number.isFinite(anoParam) && anoParam >= 2000 && anoParam <= 2100
				? anoParam
				: hoje.getFullYear(),
	};
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const planoParam = url.searchParams.get("plano");
	const professorParam = url.searchParams.get("professor") ?? "todos";
	const forcarEvo = url.searchParams.get("fonte") === "evo";

	const filtro = getFiltroPlanoPorId(planoParam);
	if (!filtro) {
		return new Response("Plano inválido.", { status: 400 });
	}

	const { mes, ano } = parseMesAno(url);
	const resultado = await carregarClientesPlanos(
		mes,
		ano,
		filtro.id as FiltroPlanoId,
		professorParam,
		forcarEvo,
	);

	if ("erro" in resultado) {
		return new Response(resultado.erro, { status: 502 });
	}

	if (resultado.clientes.length === 0) {
		return new Response("Nenhum aluno encontrado para gerar o PDF.", {
			status: 404,
		});
	}

	const buffer = await renderRepasseProfessorPdfToBuffer(
		mes,
		ano,
		resultado.planoLabel,
		professorParam,
		resultado.clientes,
	);
	const body = new Uint8Array(buffer);

	const filename = montarNomeArquivoRepassePdf(
		resultado.planoLabel,
		professorParam,
		resultado.clientes[0]?.nomeProfessor,
		mes,
		ano,
	);

	return new Response(body, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Content-Length": String(buffer.length),
		},
	});
}
