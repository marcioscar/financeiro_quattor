import type { FiltroPlanoId } from "~/lib/planos-evo-filtros";
import { getFiltroPlanoPorId } from "~/lib/planos-evo-filtros";
import { buscarContratosMes } from "~/models/contratos.server";
import {
	type ClientePlanoEVO,
	getClientesAtivosPorPlanoComConexao,
} from "~/models/evo.server";

export type FonteDadosPlanos = "banco" | "evo";

function parseIdProfessor(valor: string): number | undefined {
	if (!valor || valor === "todos") return undefined;
	const id = Number.parseInt(valor, 10);
	return Number.isFinite(id) ? id : undefined;
}

export async function carregarClientesPlanos(
	mes: number,
	ano: number,
	planoFiltro: FiltroPlanoId,
	professorFiltro: string,
	forcarEvo = false,
): Promise<
	| {
			clientes: ClientePlanoEVO[];
			fonte: FonteDadosPlanos;
			planoLabel: string;
	  }
	| { erro: string }
> {
	const filtro = getFiltroPlanoPorId(planoFiltro);
	if (!filtro) {
		return { erro: "Tipo de plano inválido." };
	}

	if (!forcarEvo) {
		const salvo = await buscarContratosMes(
			mes,
			ano,
			planoFiltro,
			professorFiltro,
		);
		if (salvo) {
			return {
				clientes: salvo.clientes,
				fonte: "banco",
				planoLabel: filtro.label,
			};
		}
	}

	const resultado = await getClientesAtivosPorPlanoComConexao(
		planoFiltro,
		parseIdProfessor(professorFiltro),
	);

	if (resultado.erro) {
		return { erro: resultado.erro };
	}

	return {
		clientes: resultado.clientes,
		fonte: "evo",
		planoLabel: filtro.label,
	};
}
