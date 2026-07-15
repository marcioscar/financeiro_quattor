import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	useReactTable,
	type SortingState,
	getSortedRowModel,
	type ColumnFiltersState,
	getFilteredRowModel,
	type RowSelectionState,
} from "@tanstack/react-table";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";

import { Button } from "~/components/ui/button";
import { useState } from "react";
import { Input } from "~/components/ui/input";

interface DataTableProps<TData, TValue> {
	columns: ColumnDef<TData, TValue>[];
	data: TData[];
	enableRowSelection?: boolean;
	getRowId?: (row: TData) => string;
	selectionActions?: (selectedRows: TData[]) => React.ReactNode;
	filterColumn?: string;
	filterPlaceholder?: string;
	filterExtra?: React.ReactNode;
	/** "column" (padrão) filtra só `filterColumn`; "global" filtra por qualquer coluna da tabela. */
	filterMode?: "column" | "global";
	onRowClick?: (row: TData) => void;
	/** Desative quando `data` for editada localmente a cada tecla (ex.: tabelas com inputs inline) para a paginação não voltar pra página 1 a cada alteração. */
	autoResetPageIndex?: boolean;
	/** IDs de linhas que devem ficar sempre fixas no topo, independente de ordenação/paginação (ex.: linhas recém-adicionadas ainda não salvas). */
	pinnedRowIds?: string[];
}

export function DataTable<TData extends { id?: string }, TValue>({
	columns,
	data,
	enableRowSelection = false,
	getRowId = (row) => (row as { id: string }).id,
	selectionActions,
	filterColumn = "fornecedor",
	filterPlaceholder = "Filtrar por fornecedor...",
	filterExtra,
	filterMode = "column",
	onRowClick,
	autoResetPageIndex = true,
	pinnedRowIds,
}: DataTableProps<TData, TValue>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

	const table = useReactTable({
		data,
		columns,
		getRowId,
		autoResetPageIndex,
		initialState: { pagination: { pageSize: 12 } },
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		getFilteredRowModel: getFilteredRowModel(),
		onRowSelectionChange: setRowSelection,
		enableRowSelection,
		state: {
			sorting,
			columnFilters,
			globalFilter,
			rowSelection,
			rowPinning: { top: pinnedRowIds ?? [], bottom: [] },
		},
	});

	const selectedRows = table.getFilteredSelectedRowModel().rows.map((r) => r.original);
	const hasSelection = selectedRows.length > 0;
	const linhas = [...table.getTopRows(), ...table.getCenterRows()];

	return (
		<div className="min-w-0 w-full max-w-full">
			{hasSelection && selectionActions && (
				<div className="mb-4 flex items-center gap-4 rounded-lg border bg-muted/50 px-4 py-3">
					<span className="text-sm font-medium">
						{selectedRows.length} linha(s) selecionada(s)
					</span>
					{selectionActions(selectedRows)}
				</div>
			)}
			{filterMode === "global" ? (
				<div className="flex flex-wrap items-center gap-2 py-4">
					<Input
						placeholder={filterPlaceholder}
						value={globalFilter}
						onChange={(event) => setGlobalFilter(event.target.value)}
						className="max-w-sm"
					/>
					{filterExtra}
				</div>
			) : (
				filterColumn && (
					<div className="flex flex-wrap items-center gap-2 py-4">
						<Input
							placeholder={filterPlaceholder}
							value={
								(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ""
							}
							onChange={(event) =>
								table.getColumn(filterColumn)?.setFilterValue(event.target.value)
							}
							className="max-w-sm"
						/>
						{filterExtra}
					</div>
				)
			)}
			<div className="max-w-full overflow-x-auto rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{linhas.length ? (
							linhas.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									onClick={
										onRowClick
											? () => onRowClick(row.original)
											: undefined
									}
									className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											onClick={(e) =>
												cell.column.id === "select" ||
												cell.column.id === "actions"
													? e.stopPropagation()
													: undefined
											}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center">
									Nenhum resultado.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
				<div className="flex items-center justify-end space-x-2 px-4 py-4">
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.previousPage()}
						disabled={!table.getCanPreviousPage()}>
						Anterior
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => table.nextPage()}
						disabled={!table.getCanNextPage()}>
						Próximo
					</Button>
				</div>
			</div>
		</div>
	);
}
