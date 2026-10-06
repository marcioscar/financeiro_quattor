/**
 * Layouts disponíveis para a folha impressa (pendurada na parede). Sempre uma
 * página por grupo; os layouts novos tiram as séries longas para a legenda de
 * protocolos (A, B…) para sobrar espaço para letra grande.
 * - contraste: retrato, faixas alternadas e série à direita (padrão)
 * - cartaz:    retrato, número em círculo, série embaixo do nome
 * - cartoes:   paisagem, um cartão por exercício em grade
 * - compacto:  layout antigo (séries por extenso, fonte encolhe)
 */
export const LAYOUTS_TREINO = [
	{ id: "contraste", nome: "Faixas (alto contraste)" },
	{ id: "cartaz", nome: "Cartaz (letras grandes)" },
	{ id: "cartoes", nome: "Cartões (paisagem)" },
	{ id: "compacto", nome: "Compacto (layout antigo)" },
] as const;

export type LayoutTreino = (typeof LAYOUTS_TREINO)[number]["id"];

export function parseLayoutTreino(v: string | null | undefined): LayoutTreino {
	return LAYOUTS_TREINO.some((l) => l.id === v) ? (v as LayoutTreino) : "contraste";
}
