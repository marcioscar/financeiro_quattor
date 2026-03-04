import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
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
import type { Receita } from "~/components/receitas/columns-rec";

const FORMAS = ["Crédito", "Débito", "PIX", "Boleto", "Transferência", "Dinheiro"] as const;

const STATUS = ["recebido", "pendente", "previsto"] as const;

function formatarDataParaInput(d: Date | string | null | undefined): string {
	if (!d) return "";
	const date = typeof d === "string" ? new Date(d) : d;
	if (isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 10);
}

type Props = {
	receita: Receita;
	open: boolean;
	onClose: () => void;
};

export function DialogEditarReceita({ receita, open, onClose }: Props) {
	const [forma, setForma] = useState(receita.forma ?? "");
	const [descricao, setDescricao] = useState(receita.descricao ?? "");
	const [valor, setValor] = useState(
		receita.valor != null ? String(receita.valor) : "",
	);
	const [data, setData] = useState(formatarDataParaInput(receita.data));
	const [status, setStatus] = useState(receita.status ?? "");
	const fetcher = useFetcher<{ error?: string; success?: boolean }>();
	const submittedRef = useRef(false);

	const resetForm = useCallback(() => {
		setForma(receita.forma ?? "");
		setDescricao(receita.descricao ?? "");
		setValor(receita.valor != null ? String(receita.valor) : "");
		setData(formatarDataParaInput(receita.data));
		setStatus(receita.status ?? "");
	}, [receita]);

	useEffect(() => {
		if (open) resetForm();
	}, [open, resetForm]);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!forma.trim() || !descricao.trim() || !valor || !data || !status)
			return;

		const valorNum = parseFloat(valor.replace(",", "."));
		if (isNaN(valorNum) || valorNum < 0) return;

		const formData = new FormData();
		formData.append("intent", "editar_receita");
		formData.append("id", receita.id);
		formData.append("forma", forma.trim());
		formData.append("descricao", descricao.trim());
		formData.append("valor", String(valorNum));
		formData.append("data", data);
		formData.append("status", status.trim());

		fetcher.submit(formData, { method: "post" });
	}

	function handleExcluir() {
		if (!confirm("Tem certeza que deseja excluir esta receita?")) return;

		fetcher.submit(
			{ intent: "excluir_receita", id: receita.id },
			{ method: "post" },
		);
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
	const isValid =
		forma.trim() &&
		descricao.trim() &&
		valor &&
		data &&
		status &&
		!isNaN(parseFloat(valor.replace(",", "."))) &&
		parseFloat(valor.replace(",", ".")) >= 0;

	if (!open) return null;

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Editar receita</DialogTitle>
				</DialogHeader>
				<fetcher.Form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel htmlFor="editar-forma">Forma</FieldLabel>
						<Select
							value={forma}
							onValueChange={setForma}
							disabled={busy}
							required
						>
							<SelectTrigger id="editar-forma" className="w-full">
								<SelectValue placeholder="Selecione a forma" />
							</SelectTrigger>
							<SelectContent>
								{FORMAS.map((f) => (
									<SelectItem key={f} value={f}>
										{f}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="editar-descricao">Descrição</FieldLabel>
						<Input
							id="editar-descricao"
							placeholder="Descrição da receita"
							value={descricao}
							onChange={(e) => setDescricao(e.target.value)}
							disabled={busy}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="editar-valor">Valor (R$)</FieldLabel>
						<Input
							id="editar-valor"
							type="text"
							inputMode="decimal"
							placeholder="0,00"
							value={valor}
							onChange={(e) => setValor(e.target.value)}
							disabled={busy}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="editar-data">Data</FieldLabel>
						<Input
							id="editar-data"
							type="date"
							value={data}
							onChange={(e) => setData(e.target.value)}
							disabled={busy}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="editar-status">Status</FieldLabel>
						<Select
							value={status}
							onValueChange={setStatus}
							disabled={busy}
							required
						>
							<SelectTrigger id="editar-status" className="w-full">
								<SelectValue placeholder="Selecione o status" />
							</SelectTrigger>
							<SelectContent>
								{STATUS.map((s) => (
									<SelectItem key={s} value={s}>
										{s}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>

					{fetcher.data?.error && (
						<p className="text-sm text-destructive">{fetcher.data.error}</p>
					)}

					<DialogFooter className="flex-col gap-2 sm:flex-row">
						<div className="flex flex-1 justify-start">
							<Button
								type="button"
								variant="destructive"
								size="sm"
								onClick={handleExcluir}
								disabled={busy}
							>
								<Trash2 className="size-4" />
								Excluir
							</Button>
						</div>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={onClose}
								disabled={busy}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={busy || !isValid}>
								{busy ? "Salvando..." : "Salvar"}
							</Button>
						</div>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
