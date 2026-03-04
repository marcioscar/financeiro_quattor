import { HandCoins, Pencil } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
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
import { Checkbox } from "~/components/ui/checkbox";

type Props = {
	folhaId: string;
	nome: string;
	conta: string;
	valor: number;
	data: Date;
};

function formatarDataParaInput(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function DialogEditarSalario({
	folhaId,
	nome,
	conta,
	valor,
	data,
}: Props) {
	const [open, setOpen] = useState(false);
	const [valorStr, setValorStr] = useState(() =>
		valor.toFixed(2).replace(".", ","),
	);
	const [dataStr, setDataStr] = useState(() => formatarDataParaInput(data));
	const [marcarComoPago, setMarcarComoPago] = useState(false);
	const fetcher = useFetcher();

	const resetForm = useCallback(() => {
		setValorStr(valor.toFixed(2).replace(".", ","));
		setDataStr(formatarDataParaInput(data));
		setMarcarComoPago(false);
	}, [valor, data]);

	useEffect(() => {
		if (open) resetForm();
	}, [open, resetForm]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		const valorNum = parseFloat(valorStr.replace(",", "."));
		if (isNaN(valorNum) || valorNum <= 0) return;

		fetcher.submit(
			{
				intent: "editar",
				folhaId,
				valor: String(valorNum),
				data: dataStr,
				marcarComoPago: marcarComoPago ? "1" : "0",
			},
			{ method: "post" },
		);
	}

	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data?.success) {
			setOpen(false);
		}
	}, [fetcher.state, fetcher.data]);

	return (
		<Dialog open={open} onOpenChange={(o) => (setOpen(o), !o && resetForm())}>
			<DialogTrigger asChild>
				<Button size='xs' variant='ghost' className='h-7 px-2'>
					<HandCoins className='size-3.5' />
					Pagar
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Pagar salário</DialogTitle>
					<DialogDescription className='text-sm font-light text-orange-500'>
						{nome}.
					</DialogDescription>
				</DialogHeader>
				<fetcher.Form onSubmit={handleSubmit} className='space-y-4'>
					<input type='hidden' name='intent' value='editar' />
					<input type='hidden' name='folhaId' value={folhaId} />
					<Field>
						<FieldLabel htmlFor='valor-editar'>Valor (R$)</FieldLabel>
						<Input
							id='valor-editar'
							name='valor'
							type='text'
							inputMode='decimal'
							placeholder='0,00'
							value={valorStr}
							onChange={(e) => setValorStr(e.target.value)}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='data-editar'>Data</FieldLabel>
						<Input
							id='data-editar'
							name='data'
							type='date'
							value={dataStr}
							onChange={(e) => setDataStr(e.target.value)}
							required
						/>
					</Field>
					<div className='flex flex-col gap-1'>
						<div className='flex items-center gap-2'>
							<Checkbox
								id='marcar-pago'
								checked={marcarComoPago}
								onCheckedChange={(c) => setMarcarComoPago(c === true)}
							/>
							<label
								htmlFor='marcar-pago'
								className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
								Pagar?
							</label>
						</div>
						<span className='text-sm text-stone-500 font-light pl-6'>
							{conta}
						</span>
					</div>
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
							disabled={fetcher.state !== "idle" || !valorStr || !dataStr}>
							{fetcher.state !== "idle" ? "Salvando..." : "Salvar"}
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
