/**
 * Tipos de lançamento da folha. Lançamentos antigos não têm `tipo` e contam
 * como salário.
 */

export const TIPOS_LANCAMENTO = ["salario", "decimo_1", "decimo_2"] as const;

export type TipoLancamento = (typeof TIPOS_LANCAMENTO)[number];

export const ROTULO_TIPO: Record<TipoLancamento, string> = {
	salario: "Salário",
	decimo_1: "13º - 1ª parcela",
	decimo_2: "13º - 2ª parcela",
};

export function tipoDoLancamento(tipo: string | null | undefined): TipoLancamento {
	return tipo === "decimo_1" || tipo === "decimo_2" ? tipo : "salario";
}

export function ehSalario(sal: { tipo?: string | null }): boolean {
	return tipoDoLancamento(sal.tipo) === "salario";
}

export function ehDecimoTerceiro(tipo: TipoLancamento): boolean {
	return tipo === "decimo_1" || tipo === "decimo_2";
}

export function parseTipoLancamento(valor: unknown): TipoLancamento | null {
	return typeof valor === "string" &&
		(TIPOS_LANCAMENTO as readonly string[]).includes(valor)
		? (valor as TipoLancamento)
		: null;
}

/** Funções com carteira assinada; estagiários e contratos não recebem 13º. */
const FUNCOES_COM_DECIMO = new Set(["adm", "coordenador", "professor"]);

export function recebeDecimoTerceiro(funcao: string | null | undefined): boolean {
	return FUNCOES_COM_DECIMO.has((funcao ?? "").trim().toLowerCase());
}
