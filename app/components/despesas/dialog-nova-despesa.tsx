import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Field, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";

import { CONTAS } from "./contas";

const TIPOS = ["fixa", "variavel"] as const;

type Props = { variant?: "despesas" | "contas_a_pagar" };

export function DialogNovaDespesa({ variant = "despesas" }: Props) {
	const [open, setOpen] = useState(false);
	const [conta, setConta] = useState("");
	const [descricao, setDescricao] = useState("");
	const [valor, setValor] = useState("");
	const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
	const [tipo, setTipo] = useState("");
	const fetcher = useFetcher<{ error?: string; success?: boolean }>();
	const submittedRef = useRef(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const resetForm = useCallback(() => {
		setConta("");
		setDescricao("");
		setValor("");
		setData(new Date().toISOString().slice(0, 10));
		setTipo("");
		fileInputRef.current && (fileInputRef.current.value = "");
	}, []);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!conta.trim() || !descricao.trim() || !valor || !data || !tipo) return;

		const valorNum = parseFloat(valor.replace(",", "."));
		if (isNaN(valorNum) || valorNum < 0) return;

		const form = e.currentTarget;
		const formData = new FormData();
		formData.append(
			"intent",
			variant === "contas_a_pagar" ? "criar_conta_pagar" : "criar",
		);
		formData.append("conta", conta.trim());
		formData.append("descricao", descricao.trim());
		formData.append("valor", String(valorNum));
		formData.append("data", data);
		formData.append("tipo", tipo.trim());

		const fieldName = variant === "contas_a_pagar" ? "boleto" : "comprovante";
		const fileInput = form.querySelector<HTMLInputElement>(
			`input[name="${fieldName}"]`,
		);
		if (fileInput?.files?.[0]) {
			formData.append(fieldName, fileInput.files[0]);
		}

		fetcher.submit(formData, {
			method: "post",
			encType: "multipart/form-data",
		});
	}

	useEffect(() => {
		if (fetcher.state === "submitting") {
			submittedRef.current = true;
		}
		if (fetcher.state === "idle" && submittedRef.current) {
			submittedRef.current = false;
			if (fetcher.data?.success) {
				setOpen(false);
				resetForm();
			}
		}
	}, [fetcher.state, fetcher.data, resetForm]);

	const busy = fetcher.state !== "idle";
	const isValid =
		conta.trim() &&
		descricao.trim() &&
		valor &&
		data &&
		tipo &&
		!isNaN(parseFloat(valor.replace(",", "."))) &&
		parseFloat(valor.replace(",", ".")) >= 0;

	return (
		<Dialog open={open} onOpenChange={(o) => (setOpen(o), !o && resetForm())}>
			<DialogTrigger asChild>
				<Button className='ml-10' variant='outline' size='sm'>
					<Plus className='size-4' />
					{variant === "contas_a_pagar" ? "Nova conta a pagar" : "Nova despesa"}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{variant === "contas_a_pagar"
							? "Nova conta a pagar"
							: "Nova despesa"}
					</DialogTitle>
				</DialogHeader>
				<fetcher.Form
					onSubmit={handleSubmit}
					encType='multipart/form-data'
					className='space-y-4'>
					<Field>
						<FieldLabel htmlFor='conta'>Conta</FieldLabel>
						<Select
							value={conta}
							onValueChange={setConta}
							disabled={busy}
							required>
							<SelectTrigger id='conta' className='w-full'>
								<SelectValue placeholder='Selecione a conta' />
							</SelectTrigger>
							<SelectContent>
								{CONTAS.map((c) => (
									<SelectItem key={c} value={c}>
										{c}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='descricao'>Descrição</FieldLabel>
						<Input
							id='descricao'
							placeholder='Descrição da despesa'
							value={descricao}
							onChange={(e) => setDescricao(e.target.value)}
							disabled={busy}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='valor'>Valor (R$)</FieldLabel>
						<Input
							id='valor'
							type='text'
							inputMode='decimal'
							placeholder='0,00'
							value={valor}
							onChange={(e) => setValor(e.target.value)}
							disabled={busy}
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
							disabled={busy}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='tipo'>Tipo</FieldLabel>
						<Select
							value={tipo}
							onValueChange={setTipo}
							disabled={busy}
							required>
							<SelectTrigger id='tipo' className='w-full'>
								<SelectValue placeholder='Selecione o tipo' />
							</SelectTrigger>
							<SelectContent>
								{TIPOS.map((t) => (
									<SelectItem key={t} value={t}>
										{t}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='comprovante'>
							{variant === "contas_a_pagar"
								? "Boleto"
								: "Comprovante de pagamento"}
						</FieldLabel>
						<Input
							ref={fileInputRef}
							id='comprovante'
							name={variant === "contas_a_pagar" ? "boleto" : "comprovante"}
							type='file'
							accept='.pdf,.jpg,.jpeg,.png,.webp'
							disabled={busy}
							className='cursor-pointer'
						/>
						<p className='mt-1 text-xs text-muted-foreground'>
							PDF ou imagem (opcional)
						</p>
					</Field>

					{fetcher.data?.error && (
						<div className='space-y-1'>
							<p className='text-sm text-destructive'>{fetcher.data.error}</p>
							{fetcher.data.error.toLowerCase().includes("upload") && (
								<p className='text-xs text-muted-foreground'>
									Remova o comprovante e tente salvar sem ele, ou verifique
									POCKETBASE_* no .env.
								</p>
							)}
						</div>
					)}
					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => setOpen(false)}
							disabled={busy}>
							Cancelar
						</Button>
						<Button type='submit' disabled={busy || !isValid}>
							{busy ? "Salvando..." : "Cadastrar"}
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
