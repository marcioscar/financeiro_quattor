export type FiltroPlanoId =
	| "judo"
	| "boxe"
	| "pilates"
	| "karate"
	| "krav-maga"
	| "kung-fu"
	| "muay-thai"
	| "quattor-prime";

export type FiltroPlanoEVO = {
	id: FiltroPlanoId;
	label: string;
	corresponde: (nomePlano: string) => boolean;
};

function normalizar(nome: string): string {
	return nome
		.trim()
		.toUpperCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "");
}

export const FILTROS_PLANO_EVO: FiltroPlanoEVO[] = [
	{
		id: "judo",
		label: "Judô",
		corresponde: (nome) => /\bJUDO\b/.test(normalizar(nome)),
	},
	{
		id: "boxe",
		label: "Boxe",
		corresponde: (nome) => /\bBOXE\b/.test(normalizar(nome)),
	},
	{
		id: "pilates",
		label: "Pilates",
		corresponde: (nome) => /PILATES/.test(normalizar(nome)),
	},
	{
		id: "karate",
		label: "Karatê",
		corresponde: (nome) => /KARATE/.test(normalizar(nome)),
	},
	{
		id: "krav-maga",
		label: "Krav Maga",
		corresponde: (nome) => /KRAV\s*MAGA/.test(normalizar(nome)),
	},
	{
		id: "kung-fu",
		label: "Kung Fu",
		corresponde: (nome) => /KUNG\s*FU/.test(normalizar(nome)),
	},
	{
		id: "muay-thai",
		label: "Muay Thai",
		corresponde: (nome) => /MUAY[\s-]*THAI/.test(normalizar(nome)),
	},
	{
		id: "quattor-prime",
		label: "Quattor Prime",
		corresponde: (nome) => /QUATTOR\s+PRIME/.test(normalizar(nome)),
	},
];

const filtroPorId = new Map(FILTROS_PLANO_EVO.map((f) => [f.id, f]));

export function getFiltroPlanoPorId(
	id: string | null | undefined,
): FiltroPlanoEVO | undefined {
	if (!id) return undefined;
	return filtroPorId.get(id as FiltroPlanoId);
}

export function planoCorrespondeFiltroId(
	nomePlano: string,
	filtroId: FiltroPlanoId,
): boolean {
	const filtro = filtroPorId.get(filtroId);
	return filtro ? filtro.corresponde(nomePlano) : false;
}

/**
 * Somente o Pilates tem professores distintos por aluno que justificam
 * filtrar por professor e dividir o repasse no PDF por professor. Nas
 * demais modalidades os alunos não são divididos por professor.
 */
export function permiteFiltroProfessor(filtroId: FiltroPlanoId): boolean {
	return filtroId === "pilates";
}
