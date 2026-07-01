import type { LoaderFunctionArgs } from "react-router";
import { renderRelatorioPontoPdfToBuffer } from "~/components/ponto/relatorio-ponto-pdf";
import { getRelatorioPontoMensal } from "~/models/ponto.server";

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

export async function loader({ request }: LoaderFunctionArgs) {
	const url = new URL(request.url);
	const { mes, ano } = obterMesAno(url);

	const funcionarios = await getRelatorioPontoMensal(mes, ano);
	const buffer = await renderRelatorioPontoPdfToBuffer(mes, ano, funcionarios);
	const body = new Uint8Array(buffer);

	const filename = `relatorio_ponto_${String(mes).padStart(2, "0")}_${ano}.pdf`;
	return new Response(body, {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Disposition": `attachment; filename="${filename}"`,
			"Content-Length": String(buffer.length),
		},
	});
}
