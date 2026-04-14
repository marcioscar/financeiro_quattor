import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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
import type { Cancelamento } from "~/components/cancelamentos/columns-cancel";

function formatarData(d: Date | string | null | undefined): string {
	if (!d) return "—";
	const date = typeof d === "string" ? new Date(d) : d;
	if (isNaN(date.getTime())) return "—";
	return new Intl.DateTimeFormat("pt-BR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);
}

type Props = {
	cancelamento: Cancelamento;
	open: boolean;
	onClose: () => void;
};

export function DialogEditarCancelamento({
	cancelamento,
	open,
	onClose,
}: Props) {
	const [cancelado, setCancelado] = useState(cancelamento.cancelado ?? false);
	const fetcher = useFetcher<FormActionWithUploadErrors>();
	const submittedRef = useRef(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const resetForm = useCallback(() => {
		setCancelado(cancelamento.cancelado ?? false);
		fileInputRef.current && (fileInputRef.current.value = "");
	}, [cancelamento]);

	useEffect(() => {
		if (open) resetForm();
	}, [open, resetForm]);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		const form = e.currentTarget;
		const formData = new FormData();
		formData.append("intent", "editar");
		formData.append("id", cancelamento.id);
		formData.append("cancelado", String(cancelado));

		const fileInput = form.querySelector<HTMLInputElement>(
			'input[name="comprovante"]',
		);
		if (fileInput?.files?.[0]) {
			formData.append("comprovante", fileInput.files[0]);
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
				onClose();
			}
		}
	}, [fetcher.state, fetcher.data, onClose]);

	const busy = fetcher.state !== "idle";
	const formError =
		fetcher.data?.errors?.form ?? fetcher.data?.error;
	const comprovanteError = fetcher.data?.errors?.comprovante;

	if (!open) return null;

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Editar cancelamento</DialogTitle>
				</DialogHeader>
				<fetcher.Form
					onSubmit={handleSubmit}
					encType="multipart/form-data"
					className="space-y-4"
				>
					<div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
						<p>
							<strong>Aluno:</strong> {cancelamento.aluno ?? "—"}
						</p>
						<p>
							<strong>Contato:</strong> {cancelamento.contato ?? "—"}
						</p>
						<p>
							<strong>Plano:</strong> {cancelamento.plano ?? "—"}
						</p>
						<p>
							<strong>Motivo:</strong> {cancelamento.motivo ?? "—"}
						</p>
						<p>
							<strong>Data solicitação:</strong>{" "}
							{formatarData(cancelamento.data_solicitacao)}
						</p>
						<p>
							<strong>Conclusão:</strong>{" "}
							{cancelamento.conclusao ?? "—"}
						</p>
						<p>
							<strong>Valor a estornar:</strong>{" "}
							{cancelamento.valor_estornar ?? "—"}
						</p>
						<p>
							<strong>Stone:</strong> {cancelamento.stone ?? "—"}
						</p>
						<p>
							<strong>Data limite:</strong>{" "}
							{formatarData(cancelamento.data_limite)}
						</p>
					</div>

					<Field>
						<div className="flex items-center gap-2">
							<Checkbox
								id="cancelado"
								checked={cancelado}
								onCheckedChange={(v) => setCancelado(!!v)}
								disabled={busy}
							/>
							<FieldLabel
								htmlFor="cancelado"
								className="cursor-pointer font-normal"
							>
								Cancelamento concluído
							</FieldLabel>
						</div>
					</Field>

					<Field data-invalid={!!comprovanteError}>
						<FieldLabel htmlFor="comprovante-cancelamento">
							Comprovante de cancelamento
						</FieldLabel>
						<Input
							ref={fileInputRef}
							id="comprovante-cancelamento"
							name="comprovante"
							type="file"
							accept=".pdf,.jpg,.jpeg,.png,.webp"
							disabled={busy}
							className="cursor-pointer"
						/>
						<p className="mt-1 text-xs text-muted-foreground">
							Deixe em branco para manter o atual
						</p>
						<FieldError>{comprovanteError}</FieldError>
						{cancelamento.recibo && (
							<a
								href={
									cancelamento.recibo.startsWith("http")
										? cancelamento.recibo
										: `/cancelamentos/recibo/${cancelamento.id}`
								}
								target="_blank"
								rel="noopener noreferrer"
								className="mt-2 inline-block text-sm text-primary hover:underline"
							>
								Ver comprovante atual
							</a>
						)}
					</Field>

					{formError && (
						<p className="text-sm text-destructive">{formError}</p>
					)}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={onClose}
							disabled={busy}
						>
							Cancelar
						</Button>
						<Button type="submit" disabled={busy}>
							{busy ? "Salvando..." : "Salvar"}
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
