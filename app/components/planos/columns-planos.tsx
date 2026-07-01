"use client";

import { ArrowUpDown, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
	calcularPrecoMensal,
	calcularRepasseProfessor,
} from "~/lib/plano-preco-mensal";
import type { ClientePlanoEVO, ProfessorEVO } from "~/models/evo.server";

export type ClientePlanoRow = ClientePlanoEVO & { id: string };

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
	style: "currency",
	currency: "BRL",
});

type ColumnOptions = {
	onUpdate: (id: string, patch: Partial<ClientePlanoRow>) => void;
	onRemove: (id: string) => void;
	professores: ProfessorEVO[];
};

function HeaderOrdenavel({
	label,
	title,
	onClick,
	sorted,
}: {
	label: string;
	title?: string;
	onClick: () => void;
	sorted: false | "asc" | "desc";
}) {
	return (
		<Button
			variant="ghost"
			size="sm"
			className="h-8 px-1"
			title={title ?? label}
			onClick={onClick}>
			{label}
			<ArrowUpDown className="ml-1 size-3.5" data-sorted={sorted || undefined} />
		</Button>
	);
}

function CelulaInput({
	value,
	onChange,
	className,
	placeholder,
}: {
	value: string;
	onChange: (valor: string) => void;
	className?: string;
	placeholder?: string;
}) {
	return (
		<Input
			value={value}
			placeholder={placeholder}
			className={className ?? "h-8 min-w-[120px]"}
			onClick={(e) => e.stopPropagation()}
			onChange={(e) => onChange(e.target.value)}
		/>
	);
}

export function getColumnsPlanos(
	options: ColumnOptions,
): ColumnDef<ClientePlanoRow>[] {
	const { onUpdate, onRemove, professores } = options;

	return [
		{
			id: "acoes",
			header: "",
			cell: ({ row }) => (
				<Button
					variant="ghost"
					size="icon"
					className="size-8 text-destructive hover:text-destructive"
					aria-label="Remover linha"
					onClick={(e) => {
						e.stopPropagation();
						onRemove(row.original.id);
					}}>
					<Trash2 className="size-4" />
				</Button>
			),
			enableSorting: false,
		},
		{
			accessorKey: "nomeCliente",
			header: ({ column }) => (
				<HeaderOrdenavel
					label="Cliente"
					sorted={column.getIsSorted()}
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				/>
			),
			cell: ({ row }) => (
				<CelulaInput
					value={row.original.nomeCliente}
					placeholder="Nome do cliente"
					className="h-8 min-w-[140px]"
					onChange={(valor) =>
						onUpdate(row.original.id, { nomeCliente: valor })
					}
				/>
			),
		},
		{
			accessorKey: "nomePlano",
			header: "Plano",
			cell: ({ row }) => (
				<CelulaInput
					value={row.original.nomePlano}
					placeholder="Nome do plano"
					className="h-8 min-w-[160px]"
					onChange={(valor) => onUpdate(row.original.id, { nomePlano: valor })}
				/>
			),
		},
		{
			accessorKey: "valor",
			header: ({ column }) => (
				<HeaderOrdenavel
					label="Total"
					title="Valor total"
					sorted={column.getIsSorted()}
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				/>
			),
			cell: ({ row }) => (
				<Input
					type="number"
					min={0}
					step="0.01"
					value={row.original.valor || ""}
					className="h-8 min-w-[100px]"
					onClick={(e) => e.stopPropagation()}
					onChange={(e) => {
						const valor = Number.parseFloat(e.target.value);
						onUpdate(row.original.id, {
							valor: Number.isFinite(valor) ? valor : 0,
						});
					}}
				/>
			),
		},
		{
			id: "precoMensal",
			accessorFn: (row) =>
				calcularPrecoMensal(row.valor, row.nomePlano) ??
				Number.NEGATIVE_INFINITY,
			header: ({ column }) => (
				<HeaderOrdenavel
					label="Mensal"
					title="Mensalidade"
					sorted={column.getIsSorted()}
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				/>
			),
			cell: ({ row }) => {
				const mensal = calcularPrecoMensal(
					row.original.valor,
					row.original.nomePlano,
				);
				if (mensal == null) return "—";
				return formatadorMoeda.format(mensal);
			},
		},
		{
			id: "repasseProfessor",
			accessorFn: (row) =>
				calcularRepasseProfessor(row.valor, row.nomePlano) ??
				Number.NEGATIVE_INFINITY,
			header: ({ column }) => (
				<HeaderOrdenavel
					label="50%"
					title="Repasse professor (50%)"
					sorted={column.getIsSorted()}
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				/>
			),
			cell: ({ row }) => {
				const repasse = calcularRepasseProfessor(
					row.original.valor,
					row.original.nomePlano,
				);
				if (repasse == null) return "—";
				return formatadorMoeda.format(repasse);
			},
		},
		{
			accessorKey: "nomeProfessor",
			header: ({ column }) => (
				<HeaderOrdenavel
					label="Prof."
					title="Professor"
					sorted={column.getIsSorted()}
					onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
				/>
			),
			cell: ({ row }) => {
				const professorNaLista = professores.some(
					(p) => p.id === row.original.idProfessor,
				);
				const valorSelect = professorNaLista
					? String(row.original.idProfessor)
					: row.original.nomeProfessor
						? "outro"
						: "";

				return (
					<div
						className="flex min-w-[160px] flex-col gap-1"
						onClick={(e) => e.stopPropagation()}>
						<select
							className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
							value={valorSelect}
							onChange={(e) => {
								const valor = e.target.value;
								if (valor === "") {
									onUpdate(row.original.id, {
										idProfessor: null,
										nomeProfessor: null,
									});
									return;
								}
								if (valor === "outro") {
									onUpdate(row.original.id, {
										idProfessor: null,
										nomeProfessor: row.original.nomeProfessor ?? "",
									});
									return;
								}
								const professor = professores.find(
									(p) => String(p.id) === valor,
								);
								onUpdate(row.original.id, {
									idProfessor: professor?.id ?? null,
									nomeProfessor: professor?.nome ?? null,
								});
							}}>
							<option value="">—</option>
							{professores.map((prof) => (
								<option key={prof.id} value={String(prof.id)}>
									{prof.nome}
								</option>
							))}
							<option value="outro">Outro…</option>
						</select>
						{valorSelect === "outro" && (
							<Input
								value={row.original.nomeProfessor ?? ""}
								placeholder="Nome do professor"
								className="h-8"
								onChange={(e) =>
									onUpdate(row.original.id, {
										idProfessor: null,
										nomeProfessor: e.target.value,
									})
								}
							/>
						)}
					</div>
				);
			},
		},
	];
}
