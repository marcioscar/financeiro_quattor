"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, XCircle } from "lucide-react";
import type { NotaFiscalSaidaEVO } from "~/models/evo.server";

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

const formatadorData = new Intl.DateTimeFormat("pt-BR", {
	day: "2-digit",
	month: "2-digit",
	year: "numeric",
});

export function getColumnsNotasFiscais(): ColumnDef<NotaFiscalSaidaEVO>[] {
	return [
		{
			accessorKey: "numero",
			header: "Número",
			cell: ({ row }) => row.original.numero ?? "-",
		},
		{
			accessorKey: "tipo",
			header: "Tipo",
			cell: ({ row }) => row.original.tipo ?? "-",
		},
		{
			accessorKey: "nomeCliente",
			header: "Cliente",
			cell: ({ row }) => row.original.nomeCliente ?? "-",
		},
		{
			accessorKey: "dataEmissao",
			header: "Emissão",
			cell: ({ row }) => {
				const data = row.original.dataEmissao;
				return data ? formatadorData.format(new Date(data)) : "-";
			},
		},
		{
			accessorKey: "status",
			header: "Status",
			cell: ({ row }) => row.original.status ?? "-",
		},
		{
			accessorKey: "enviadaPorEmail",
			header: "Enviada",
			cell: ({ row }) =>
				row.original.enviadaPorEmail ? (
					<CheckCircle2 className="size-4 text-green-600" />
				) : (
					<XCircle className="size-4 text-muted-foreground" />
				),
		},
		{
			accessorKey: "valorTotal",
			header: "Valor",
			cell: ({ row }) => formatadorMoeda.format(row.original.valorTotal),
		},
	];
}
