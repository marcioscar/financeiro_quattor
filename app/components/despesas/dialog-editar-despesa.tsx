import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Checkbox } from "~/components/ui/checkbox";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import type { FormActionWithUploadErrors } from "~/lib/upload-errors";
import { Input } from "~/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import type { Despesa } from "~/components/columns-desp";
import { CONTAS } from "./contas";

const TIPOS = ["fixa", "variavel"] as const;

function formatarDataParaInput(d: Date | string | null | undefined): string {
	if (!d) return "";
	const date = typeof d === "string" ? new Date(d) : d;
	if (isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}

type Props = {
	despesa: Despesa;
	open: boolean;
	onClose: () => void;
	variant?: "despesas" | "contas_a_pagar";
};

export function DialogEditarDespesa({
	despesa,
	open,
	onClose,
	variant = "despesas",
}: Props) {
	const [conta, setConta] = useState(despesa.conta ?? "");
	const [descricao, setDescricao] = useState(despesa.descricao ?? "");
	const [valor, setValor] = useState(
		despesa.valor != null ? String(despesa.valor) : "",
	);
	const [data, setData] = useState(formatarDataParaInput(despesa.data));
	const [tipo, setTipo] = useState(despesa.tipo ?? "");
	const [pago, setPago] = useState(despesa.pago ?? false);
	const fetcher = useFetcher<FormActionWithUploadErrors>();
	const submittedRef = useRef(false);
	const boletoInputRef = useRef<HTMLInputElement>(null);
	const comprovanteInputRef = useRef<HTMLInputElement>(null);

	const resetForm = useCallback(() => {
		setConta(despesa.conta ?? "");
		setDescricao(despesa.descricao ?? "");
		setValor(despesa.valor != null ? String(despesa.valor) : "");
		setData(formatarDataParaInput(despesa.data));
		setTipo(despesa.tipo ?? "");
		setPago(despesa.pago ?? false);
		boletoInputRef.current && (boletoInputRef.current.value = "");
		comprovanteInputRef.current && (comprovanteInputRef.current.value = "");
	}, [despesa]);

	useEffect(() => {
		if (open) resetForm();
	}, [open, resetForm]);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!conta.trim() || !descricao.trim() || !valor || !data || !tipo) return;

		const valorNum = parseFloat(valor.replace(",", "."));
		if (isNaN(valorNum) || valorNum < 0) return;

		const form = e.currentTarget;
		const formData = new FormData();
		formData.append(
			"intent",
			variant === "contas_a_pagar" ? "editar_conta_pagar" : "editar",
		);
		formData.append("id", despesa.id);
		formData.append("conta", conta.trim());
		formData.append("descricao", descricao.trim());
		formData.append("valor", String(valorNum));
		formData.append("data", data);
		formData.append("tipo", tipo.trim());
		if (variant === "contas_a_pagar") {
			formData.append("pago", String(pago));

			const boletoInput = form.querySelector<HTMLInputElement>(
				'input[name="boleto"]',
			);
			if (boletoInput?.files?.[0]) {
				formData.append("boleto", boletoInput.files[0]);
			}

			const comprovanteInput = form.querySelector<HTMLInputElement>(
				'input[name="comprovante"]',
			);
			if (comprovanteInput?.files?.[0]) {
				formData.append("comprovante", comprovanteInput.files[0]);
			}
		} else {
			const comprovanteInput = form.querySelector<HTMLInputElement>(
				'input[name="comprovante"]',
			);
			if (comprovanteInput?.files?.[0]) {
				formData.append("comprovante", comprovanteInput.files[0]);
			}
		}

		fetcher.submit(formData, {
			method: "post",
			encType: "multipart/form-data",
		});
	}

	function handleExcluir() {
		if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;

		fetcher.submit({ intent: "excluir", id: despesa.id }, { method: "post" });
	}

	useEffect(() => {
		if (fetcher.state === "submitting") {
			submittedRef.current = true;
		}
		if (fetcher.state === "idle" && submittedRef.current) {
			submittedRef.current = false;
			if (fetcher.data?.success) {
				onClose();
			}
		}
	}, [fetcher.state, fetcher.data, onClose]);

	const busy = fetcher.state !== "idle";
	const formError =
		fetcher.data?.errors?.form ?? fetcher.data?.error;
	const errBoleto = fetcher.data?.errors?.boleto;
	const errComprovante = fetcher.data?.errors?.comprovante;

	const isValid =
		conta.trim() &&
		descricao.trim() &&
		valor &&
		data &&
		tipo &&
		!isNaN(parseFloat(valor.replace(",", "."))) &&
		parseFloat(valor.replace(",", ".")) >= 0;

	if (!open) return null;

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{variant === "contas_a_pagar"
							? "Editar conta a pagar"
							: "Editar despesa"}
					</DialogTitle>
				</DialogHeader>
				<fetcher.Form
					onSubmit={handleSubmit}
					encType='multipart/form-data'
					className='space-y-4'>
					<Field>
						<FieldLabel htmlFor='editar-conta'>Conta</FieldLabel>
						<Select
							value={conta}
							onValueChange={setConta}
							disabled={busy}
							required>
							<SelectTrigger id='editar-conta' className='w-full'>
								<SelectValue placeholder='Selecione a conta' />
							</SelectTrigger>
							<SelectContent>
								{[
									...(conta &&
									!CONTAS.includes(conta as (typeof CONTAS)[number])
										? [conta]
										: []),
									...CONTAS,
								].map((c) => (
									<SelectItem key={c} value={c}>
										{c}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor='editar-descricao'>Descrição</FieldLabel>
						<Input
							id='editar-descricao'
							placeholder='Descrição da despesa'
							value={descricao}
							onChange={(e) => setDescricao(e.target.value)}
							disabled={busy}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='editar-valor'>Valor (R$)</FieldLabel>
						<Input
							id='editar-valor'
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
						<FieldLabel htmlFor='editar-data'>Data</FieldLabel>
						<Input
							id='editar-data'
							type='date'
							value={data}
							onChange={(e) => setData(e.target.value)}
							disabled={busy}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor='editar-tipo'>Tipo</FieldLabel>
						<Select
							value={tipo}
							onValueChange={setTipo}
							disabled={busy}
							required>
							<SelectTrigger id='editar-tipo' className='w-full'>
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
					{variant === "contas_a_pagar" && (
						<Field>
							<div className='flex items-center gap-2'>
								<Checkbox
									id='editar-pago'
									checked={pago}
									onCheckedChange={(v) => setPago(!!v)}
									disabled={busy}
								/>
								<FieldLabel
									htmlFor='editar-pago'
									className='cursor-pointer font-normal'>
									Marcar como pago
								</FieldLabel>
							</div>
						</Field>
					)}
					{variant === "contas_a_pagar" ? (
						<>
							<Field data-invalid={!!errBoleto}>
								<FieldLabel htmlFor='editar-boleto'>Boleto</FieldLabel>
								<Input
									ref={boletoInputRef}
									id='editar-boleto'
									name='boleto'
									type='file'
									accept='.pdf,.jpg,.jpeg,.png,.webp'
									disabled={busy}
									className='cursor-pointer'
								/>
								<p className='mt-1 text-xs text-muted-foreground'>
									Deixe em branco para manter o atual
								</p>
								<FieldError>{errBoleto}</FieldError>
							</Field>
							<Field data-invalid={!!errComprovante}>
								<FieldLabel htmlFor='editar-comprovante'>
									Comprovante de pagamento
								</FieldLabel>
								<Input
									ref={comprovanteInputRef}
									id='editar-comprovante'
									name='comprovante'
									type='file'
									accept='.pdf,.jpg,.jpeg,.png,.webp'
									disabled={busy}
									className='cursor-pointer'
								/>
								<p className='mt-1 text-xs text-muted-foreground'>
									Envie o comprovante ao marcar como pago. Deixe em branco para
									manter o atual.
								</p>
								<FieldError>{errComprovante}</FieldError>
							</Field>
						</>
					) : (
						<Field data-invalid={!!errComprovante}>
							<FieldLabel htmlFor='editar-comprovante'>
								Comprovante de pagamento
							</FieldLabel>
							<Input
								ref={comprovanteInputRef}
								id='editar-comprovante'
								name='comprovante'
								type='file'
								accept='.pdf,.jpg,.jpeg,.png,.webp'
								disabled={busy}
								className='cursor-pointer'
							/>
							<p className='mt-1 text-xs text-muted-foreground'>
								Deixe em branco para manter o atual
							</p>
							<FieldError>{errComprovante}</FieldError>
						</Field>
					)}

					{formError && (
						<p className='text-sm text-destructive'>{formError}</p>
					)}

					<DialogFooter className='flex-col gap-2 sm:flex-row'>
						<div className='flex flex-1 justify-start'>
							<Button
								type='button'
								variant='destructive'
								size='sm'
								onClick={handleExcluir}
								disabled={busy}>
								<Trash2 className='size-4' />
								Excluir
							</Button>
						</div>
						<div className='flex gap-2'>
							<Button
								type='button'
								variant='outline'
								onClick={onClose}
								disabled={busy}>
								Cancelar
							</Button>
							<Button type='submit' disabled={busy || !isValid}>
								{busy ? "Salvando..." : "Salvar"}
							</Button>
						</div>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
