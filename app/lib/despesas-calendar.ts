/**
 * Datas de despesas vêm de input type="date" (YYYY-MM-DD) e viram meia-noite UTC
 * (`new Date("2026-04-15")`). Intervalos de mês precisam usar o mesmo critério
 * (mês civil em UTC), senão fuso do servidor/cliente desloca abril ↔ março, etc.
 */
export function limitesMesCivilUTC(ano: number, mes: number) {
	const m0 = mes - 1;
	const inicio = new Date(Date.UTC(ano, m0, 1, 0, 0, 0, 0));
	const fim = new Date(Date.UTC(ano, m0 + 1, 0, 23, 59, 59, 999));
	return { inicio, fim };
}

/** `mes` 1–12; compara com a data civil UTC gravada no banco. */
export function despesaCaiNoMesCivil(
	data: Date | string | null | undefined,
	ano: number,
	mes: number,
): boolean {
	if (data == null) return false;
	const dt = new Date(data);
	return (
		dt.getUTCFullYear() === ano && dt.getUTCMonth() + 1 === mes
	);
}
