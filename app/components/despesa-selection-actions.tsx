type DespesaSelectionActionsProps = {
	selectedRows: unknown[];
	variant: "despesas" | "contas_a_pagar";
	fornecedores: { id: string; nome?: string }[];
};

export function DespesaSelectionActions({
	selectedRows,
	variant,
	fornecedores,
}: DespesaSelectionActionsProps) {
	if (selectedRows.length === 0) return null;
	return (
		<div className="flex items-center gap-2">
			<span className="text-sm text-muted-foreground">
				{selectedRows.length} selecionada(s) • {variant}
			</span>
		</div>
	);
}
