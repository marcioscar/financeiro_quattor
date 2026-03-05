"use client";

import { Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";

export type BancoTreinoRow = {
	id: string;
	ciclo: string | null;
	treino: string | null;
	grupo: string | null;
	exercicios: Array<{
		exercicio?: string | null;
		repeticoes?: string | null;
		observacao?: string | null;
		video?: string | null;
	}>;
};

export function getColumnsTreinos(
	onEdit: (row: BancoTreinoRow) => void,
): ColumnDef<BancoTreinoRow>[] {
	return [
		{
			id: "actions",
			header: "",
			cell: ({ row }) => (
				<Button
					variant='ghost'
					size='icon'
					className='size-8'
					onClick={(e) => {
						e.stopPropagation();
						onEdit(row.original);
					}}
					aria-label='Editar exercícios'>
					<Pencil className='size-4' />
				</Button>
			),
			enableSorting: false,
		},
		{
			accessorKey: "ciclo",
			header: "Ciclo",
			cell: ({ row }) => row.getValue("ciclo") ?? "—",
		},
		{
			accessorKey: "treino",
			header: "Treino",
			cell: ({ row }) => row.getValue("treino") ?? "—",
		},
		{
			accessorKey: "grupo",
			header: "Grupo",
			cell: ({ row }) => row.getValue("grupo") ?? "—",
		},

		{
			id: "qtdExercicios",
			header: "Exercícios",
			cell: ({ row }) => {
				const exs = row.original.exercicios ?? [];
				return exs.length;
			},
		},
	];
}
