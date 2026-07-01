import type { LoaderFunctionArgs } from "react-router";
import { renderEspelhoPontoPdfToBuffer } from "~/components/ponto/espelho-ponto-pdf";
import { getEspelhoPontoFuncionarioMes } from "~/models/ponto.server";

function obterMesAno(url: URL): { mes: number; ano: number } {
	const hoje = new Date();
	const mesParam = parseInt(url.searchParams.get("mes") ?? "", 10);
	const anoParam = parseInt(url.searchParams.get("ano") ?? "", 10);

	const mes =
		Number.isNaN(mesParam) || mesParam < 1 || mesParam > 12
			? hoje.getMonth() + 1
			: mesParam;
	const ano = Number.isNaN(anoParam) ? hoje.getFullYear() : anoParam;
	return { mes, ano };
}

function normalizarNomeArquivo(valor: string): string {
	return valor
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, "_")
		.replace(/[^a-zA-Z0-9_]/g, "")
		.toLowerCase();
}

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const nome = url.searchParams.get("nome")?.trim();
	if (!nome) {
		return new Response("Parâmetro nome é obrigatório.", { status: 400 });
	}

	const { mes, ano } = obterMesAno(url);
	const espelho = await getEspelhoPontoFuncionarioMes({ nome, mes, ano });
	if (!espelho) {
		return new Response("Funcionário não encontrado para gerar espelho.", {
			status: 404,
		});
	}

	const buffer = await renderEspelhoPontoPdfToBuffer(espelho);
	const body = new Uint8Array(buffer);
	const nomeArquivo = normalizarNomeArquivo(espelho.nome);
	const filename = `espelho_ponto_${nomeArquivo}_${String(mes).padStart(2, "0")}_${ano}.pdf`;

	return new Response(body, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Content-Length": String(buffer.length),
		},
	});
}
