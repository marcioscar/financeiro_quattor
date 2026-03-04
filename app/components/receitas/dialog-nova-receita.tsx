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

const FORMAS = ["Crédito", "Débito", "PIX", "Boleto", "Transferência", "Dinheiro"] as const;

const STATUS = ["recebido", "pendente", "previsto"] as const;

export function DialogNovaReceita() {
	const [open, setOpen] = useState(false);
	const [forma, setForma] = useState("");
	const [descricao, setDescricao] = useState("");
	const [valor, setValor] = useState("");
	const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
	const [status, setStatus] = useState("");
	const fetcher = useFetcher<{ error?: string; success?: boolean }>();
	const submittedRef = useRef(false);

	const resetForm = useCallback(() => {
		setForma("");
		setDescricao("");
		setValor("");
		setData(new Date().toISOString().slice(0, 10));
		setStatus("");
	}, []);

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		if (!forma.trim() || !descricao.trim() || !valor || !data || !status) return;

		const valorNum = parseFloat(valor.replace(",", "."));
		if (isNaN(valorNum) || valorNum < 0) return;

		const formData = new FormData();
		formData.append("intent", "criar_receita");
		formData.append("forma", forma.trim());
		formData.append("descricao", descricao.trim());
		formData.append("valor", String(valorNum));
		formData.append("data", data);
		formData.append("status", status.trim());

		fetcher.submit(formData, { method: "post" });
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
		forma.trim() &&
		descricao.trim() &&
		valor &&
		data &&
		status &&
		!isNaN(parseFloat(valor.replace(",", "."))) &&
		parseFloat(valor.replace(",", ".")) >= 0;

	return (
		<Dialog open={open} onOpenChange={(o) => (setOpen(o), !o && resetForm())}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Plus className="size-4" />
					Nova receita
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Nova receita</DialogTitle>
				</DialogHeader>
				<fetcher.Form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel htmlFor="forma">Forma</FieldLabel>
						<Select
							value={forma}
							onValueChange={setForma}
							disabled={busy}
							required
						>
							<SelectTrigger id="forma" className="w-full">
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
						<FieldLabel htmlFor="descricao">Descrição</FieldLabel>
						<Input
							id="descricao"
							placeholder="Descrição da receita"
							value={descricao}
							onChange={(e) => setDescricao(e.target.value)}
							disabled={busy}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="valor">Valor (R$)</FieldLabel>
						<Input
							id="valor"
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
						<FieldLabel htmlFor="data">Data</FieldLabel>
						<Input
							id="data"
							type="date"
							value={data}
							onChange={(e) => setData(e.target.value)}
							disabled={busy}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="status">Status</FieldLabel>
						<Select
							value={status}
							onValueChange={setStatus}
							disabled={busy}
							required
						>
							<SelectTrigger id="status" className="w-full">
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
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
							disabled={busy}
						>
							Cancelar
						</Button>
						<Button type="submit" disabled={busy || !isValid}>
							{busy ? "Salvando..." : "Cadastrar"}
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
