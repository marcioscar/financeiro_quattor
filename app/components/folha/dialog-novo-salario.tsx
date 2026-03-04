import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "~/components/ui/combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";

type FolhaItem = { id: string; nome: string };

type Props = {
	folhas: FolhaItem[];
};

export function DialogNovoSalario({ folhas }: Props) {
	const [open, setOpen] = useState(false);
	const [selectedFuncionario, setSelectedFuncionario] =
		useState<FolhaItem | null>(null);
	const [valor, setValor] = useState("");
	const [data, setData] = useState(() => {
		const hoje = new Date();
		return hoje.toISOString().slice(0, 10);
	});
	const anchorRef = useComboboxAnchor();
	const fetcher = useFetcher();

	const items = folhas.map((f) => ({ value: f.id, label: f.nome }));

	const resetForm = useCallback(() => {
		setSelectedFuncionario(null);
		setValor("");
		setData(new Date().toISOString().slice(0, 10));
	}, []);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const folhaId = selectedFuncionario?.id;
		if (!folhaId || !valor || !data) return;

		const valorNum = parseFloat(valor.replace(",", "."));
		if (isNaN(valorNum) || valorNum <= 0) return;

		fetcher.submit(
			{ folhaId, valor: String(valorNum), data },
			{ method: "post" },
		);
	}

	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data?.success) {
			setOpen(false);
			resetForm();
		}
	}, [fetcher.state, fetcher.data, resetForm]);

	return (
		<Dialog open={open} onOpenChange={(o) => (setOpen(o), !o && resetForm())}>
			<DialogTrigger asChild>
				<Button size='sm' className='ml-6' variant='outline'>
					<Plus className='size-4' />
					Novo salário
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Cadastrar salário a pagar</DialogTitle>
				</DialogHeader>
				<fetcher.Form onSubmit={handleSubmit} className='space-y-4'>
					<div ref={anchorRef} className='space-y-2'>
						<Field>
							<FieldLabel>Funcionário</FieldLabel>
							<Combobox
								value={
									selectedFuncionario
										? {
												value: selectedFuncionario.id,
												label: selectedFuncionario.nome,
											}
										: null
								}
								onValueChange={(v) =>
									setSelectedFuncionario(
										v ? { id: v.value, nome: v.label } : null,
									)
								}
								items={items}>
								<ComboboxInput placeholder='Buscar funcionário...' showClear />
								<ComboboxContent anchor={anchorRef}>
									<ComboboxList>
										{(item) => (
											<ComboboxItem key={item.value} value={item}>
												{item.label}
											</ComboboxItem>
										)}
									</ComboboxList>
									<ComboboxEmpty>Nenhum funcionário encontrado</ComboboxEmpty>
								</ComboboxContent>
							</Combobox>
						</Field>
					</div>
					<Field>
						<FieldLabel htmlFor='valor'>Valor (R$)</FieldLabel>
						<Input
							id='valor'
							type='text'
							inputMode='decimal'
							placeholder='0,00'
							value={valor}
							onChange={(e) => setValor(e.target.value)}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='data'>Data</FieldLabel>
						<Input
							id='data'
							type='date'
							value={data}
							onChange={(e) => setData(e.target.value)}
							required
						/>
					</Field>
					{fetcher.data?.error && (
						<p className='text-sm text-destructive'>{fetcher.data.error}</p>
					)}
					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => setOpen(false)}>
							Cancelar
						</Button>
						<Button
							type='submit'
							disabled={
								fetcher.state !== "idle" ||
								!selectedFuncionario ||
								!valor ||
								!data
							}>
							{fetcher.state !== "idle" ? "Salvando..." : "Cadastrar"}
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
