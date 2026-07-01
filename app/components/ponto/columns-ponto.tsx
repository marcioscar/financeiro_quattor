import type { ColumnDef } from "@tanstack/react-table";
import type { PontoRegistro } from "~/models/ponto.server";

function formatarDataHora(data: Date): string {
	return new Date(data).toLocaleString("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatarDuracao(entrada: Date, saida: Date): string {
	const diferencaMs = new Date(saida).getTime() - new Date(entrada).getTime();
	if (diferencaMs <= 0) return "-";

	const minutosTotais = Math.floor(diferencaMs / (1000 * 60));
	const horas = Math.floor(minutosTotais / 60);
	const minutos = minutosTotais % 60;
	return `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

export const columnsPonto: ColumnDef<PontoRegistro>[] = [
	{
		accessorKey: "nome",
		header: "Funcionário",
	},
	{
		accessorKey: "matricula",
		header: "Matrícula",
	},
	{
		accessorKey: "entrada",
		header: "Entrada",
		cell: ({ row }) => formatarDataHora(row.original.entrada),
	},
	{
		accessorKey: "saida",
		header: "Saída",
		cell: ({ row }) => formatarDataHora(row.original.saida),
	},
	{
		id: "duracao",
		header: "Duração",
		cell: ({ row }) =>
			formatarDuracao(row.original.entrada, row.original.saida),
	},
];
