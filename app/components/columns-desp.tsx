"use client";

import { ArrowUpDown, Save, ReceiptText, Barcode, Pencil } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";

export type Despesa = {
	id: string;
	conta?: string | null;
	descricao?: string | null;
	valor?: number | null;
	data?: Date | null;
	pago?: boolean | null;
	tipo?: string | null;
	boleto_path?: string | null;
	recibo_path?: string | null;
};

export type DespesaTableOptions = {
	variant: "despesas" | "contas_a_pagar";
	enableSelection?: boolean;
	onEdit?: (despesa: Despesa) => void;
};

export function getColumns(
	options?: DespesaTableOptions,
): ColumnDef<Despesa>[] {
	const columns: ColumnDef<Despesa>[] = [];
	const onEdit = options?.onEdit;

	if (options?.enableSelection) {
		columns.push({
			id: "select",
			header: ({ table }) => (
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && "indeterminate")
					}
					onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
					aria-label='Selecionar todas'
				/>
			),
			cell: ({ row }) => (
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label='Selecionar linha'
				/>
			),
			enableSorting: false,
			enableHiding: false,
		});
	}

	columns.push(
		...(onEdit
			? [
					{
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
					} as ColumnDef<Despesa>,
				]
			: []),
		{
			accessorKey: "conta",
			header: "Conta",
			cell: ({ row }) => row.getValue("conta") ?? "—",
		},
		{
			accessorKey: "valor",
			header: () => <div className='text-right'>Valor</div>,
			cell: ({ row }) => {
				const valor = row.getValue("valor") as number | null;
				if (valor == null) return <div className='text-right'>—</div>;
				return (
					<div className='text-right'>
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
					variant='ghost'
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
					Descrição
					<ArrowUpDown className='ml-2 size-4' />
				</Button>
			),
		},
		{
			accessorKey: "tipo",
			header: "Tipo",
			cell: ({ row }) => row.getValue("tipo") ?? "—",
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
		{
			accessorKey: "recibo_path",
			header: () => <ReceiptText className='size-4 shrink-0' />,
			cell: ({ row }) => {
				const recibo = row.getValue("recibo_path") as string | null;
				const id = row.original.id;
				if (recibo == null || recibo === "" || !id) return "—";
				const url =
					recibo.startsWith("http://") || recibo.startsWith("https://")
						? recibo
						: `/despesas/comprovante/${id}`;
				return (
					<a
						href={url}
						target='_blank'
						rel='noopener noreferrer'
						className='inline-flex items-center gap-1.5 text-primary hover:underline'
						title='Ver recibo'>
						<Save className='size-4 shrink-0' />
					</a>
				);
			},
		},
		{
			accessorKey: "boleto_path",
			header: () => <Barcode className='size-4 shrink-0 text-orange-400' />,
			cell: ({ row }) => {
				const boleto = row.getValue("boleto_path") as string | null;
				const id = row.original.id;
				if (boleto == null || boleto === "" || !id) return "—";
				const url =
					boleto.startsWith("http://") || boleto.startsWith("https://")
						? boleto
						: `/despesas/boleto/${id}`;
				return (
					<a
						href={url}
						target='_blank'
						rel='noopener noreferrer'
						className='inline-flex items-center gap-1.5 text-primary hover:underline'
						title='Ver boleto'>
						<Save className='size-4 shrink-0' />
					</a>
				);
			},
		},
	);

	return columns;
}
