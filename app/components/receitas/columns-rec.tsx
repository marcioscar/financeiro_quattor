"use client";

import { ArrowUpDown, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";

export type Receita = {
	id: string;
	forma?: string | null;
	descricao?: string | null;
	valor?: number | null;
	data?: Date | null;
	status?: string | null;
};

export type ReceitaTableOptions = {
	onEdit?: (receita: Receita) => void;
};

export function getColumnsRec(options?: ReceitaTableOptions): ColumnDef<Receita>[] {
	const columns: ColumnDef<Receita>[] = [];
	const onEdit = options?.onEdit;

	if (onEdit) {
		columns.push({
			id: "actions",
			header: "",
			cell: ({ row }) => (
				<Button
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={(e) => {
						e.stopPropagation();
						onEdit(row.original);
					}}
					aria-label="Editar"
				>
					<Pencil className="size-4" />
				</Button>
			),
			enableSorting: false,
		});
	}

	columns.push(
		{
			accessorKey: "forma",
			header: "Forma",
			cell: ({ row }) => row.getValue("forma") ?? "—",
		},
		{
			accessorKey: "valor",
			header: () => <div className="text-right">Valor</div>,
			cell: ({ row }) => {
				const valor = row.getValue("valor") as number | null;
				if (valor == null) return <div className="text-right">—</div>;
				return (
					<div className="text-right">
						{new Intl.NumberFormat("pt-BR", {
							style: "currency",
							currency: "BRL",
						}).format(valor)}
					</div>
				);
			},
		},
		{
			accessorKey: "descricao",
			header: ({ column }) => (
				<Button
					variant="ghost"
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				>
					Descrição
					<ArrowUpDown className="ml-2 size-4" />
				</Button>
			),
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => row.getValue("status") ?? "—",
		},
		{
			accessorKey: "data",
			header: "Data",
			cell: ({ row }) => {
				const data = row.getValue("data") as Date | null;
				if (data == null) return "—";
				return new Intl.DateTimeFormat("pt-BR", {
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
					timeZone: "UTC",
				}).format(new Date(data));
			},
		},
	);

	return columns;
}
