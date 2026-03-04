"use client";

import { ArrowUpDown, Pencil, Save } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";

export type Cancelamento = {
	id: string;
	aluno?: string | null;
	contato?: string | null;
	plano?: string | null;
	motivo?: string | null;
	data_solicitacao?: Date | null;
	conclusao?: string | null;
	valor_estornar?: string | null;
	stone?: string | null;
	data_limite?: Date | null;
	cancelado?: boolean | null;
	recibo?: string | null;
};

type Options = {
	onEdit?: (cancelamento: Cancelamento) => void;
};

export function getColumns(options?: Options): ColumnDef<Cancelamento>[] {
	const onEdit = options?.onEdit;

	const columns: ColumnDef<Cancelamento>[] = [];

	if (onEdit) {
		columns.push({
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
					aria-label='Editar'>
					<Pencil className='size-4' />
				</Button>
			),
			enableSorting: false,
		});
	}

	columns.push(
		{
			accessorKey: "aluno",
			header: ({ column }) => (
				<Button
					variant='ghost'
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
					Aluno
					<ArrowUpDown className='ml-2 size-4' />
				</Button>
			),
			cell: ({ row }) => row.getValue("aluno") ?? "—",
		},

		{
			accessorKey: "valor_estornar",
			header: "Valor estornar",
			cell: ({ row }) => row.getValue("valor_estornar") ?? "—",
		},
		{
			accessorKey: "stone",
			header: "Stone",
			cell: ({ row }) => row.getValue("stone") ?? "—",
		},
		{
			accessorKey: "data_solicitacao",
			header: "Data solicitação",
			cell: ({ row }) => {
				const data = row.getValue("data_solicitacao") as Date | null;
				if (data == null) return "—";
				return new Intl.DateTimeFormat("pt-BR", {
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
					timeZone: "UTC",
				}).format(new Date(data));
			},
		},
		{
			accessorKey: "data_limite",
			header: "Data limite",
			cell: ({ row }) => {
				const data = row.getValue("data_limite") as Date | null;
				if (data == null) return "—";
				return new Intl.DateTimeFormat("pt-BR", {
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
					timeZone: "UTC",
				}).format(new Date(data));
			},
		},
		{
			accessorKey: "cancelado",
			header: "Status",
			cell: ({ row }) => {
				const cancelado = row.getValue("cancelado") as boolean | null;
				return cancelado ? (
					<span className='rounded bg-green-100 px-2 py-0.5 text-xs text-green-800'>
						Cancelado
					</span>
				) : (
					<span className='rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800'>
						Pendente
					</span>
				);
			},
		},
		{
			accessorKey: "recibo",
			header: () => <span className='sr-only'>Comprovante</span>,
			cell: ({ row }) => {
				const recibo = row.getValue("recibo") as string | null;
				const id = row.original.id;
				if (recibo == null || recibo === "" || !id) return "—";
				const url =
					recibo.startsWith("http://") || recibo.startsWith("https://")
						? recibo
						: `/cancelamentos/recibo/${id}`;
				return (
					<a
						href={url}
						target='_blank'
						rel='noopener noreferrer'
						className='inline-flex items-center gap-1.5 text-primary hover:underline'
						title='Ver comprovante de cancelamento'>
						<Save className='size-4 shrink-0' />
					</a>
				);
			},
		},
		{
			accessorKey: "plano",
			header: "Plano",
			cell: ({ row }) => row.getValue("plano") ?? "—",
		},
	);

	return columns;
}
