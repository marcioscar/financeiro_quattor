import { Pencil, Trash2 } from "lucide-react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	OPCOES_FUNCAO,
	OPCOES_MODALIDADE,
} from "~/components/folha/dialog-novo-funcionario";

type Props = {
	folhaId: string;
	nome: string;
	conta: string;
	funcao: string;
	modalidade: string;
};

export function DialogEditarFuncionario({
	folhaId,
	nome: nomeInicial,
	conta: contaInicial,
	funcao: funcaoInicial,
	modalidade: modalidadeInicial,
}: Props) {
	const [open, setOpen] = useState(false);
	const [nome, setNome] = useState(nomeInicial);
	const [conta, setConta] = useState(contaInicial);
	const [funcao, setFuncao] = useState(funcaoInicial);
	const [modalidade, setModalidade] = useState(modalidadeInicial);
	const fetcher = useFetcher();

	const resetForm = useCallback(() => {
		setNome(nomeInicial);
		setConta(contaInicial);
		setFuncao(funcaoInicial);
		setModalidade(modalidadeInicial);
	}, [nomeInicial, contaInicial, funcaoInicial, modalidadeInicial]);

	useEffect(() => {
		if (open) resetForm();
	}, [open, resetForm]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!nome.trim() || !conta.trim() || !funcao.trim() || !modalidade.trim())
			return;

		fetcher.submit(
			{
				intent: "editarFuncionario",
				folhaId,
				nome: nome.trim(),
				conta: conta.trim(),
				funcao: funcao.trim(),
				modalidade: modalidade.trim(),
			},
			{ method: "post" }
		);
	}

	function handleExcluir() {
		if (!confirm(`Tem certeza que deseja excluir ${nomeInicial}?`)) return;
		fetcher.submit(
			{ intent: "excluirFuncionario", folhaId },
			{ method: "post" }
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
				<Button size="xs" variant="ghost" className="h-7 px-2">
					<Pencil className="size-3.5" />
					Editar
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Editar funcionário</DialogTitle>
					<DialogDescription>
						Altere os dados do funcionário.
					</DialogDescription>
				</DialogHeader>
				<fetcher.Form onSubmit={handleSubmit} className="space-y-4">
					<input type="hidden" name="intent" value="editarFuncionario" />
					<input type="hidden" name="folhaId" value={folhaId} />
					<Field>
						<FieldLabel htmlFor="nome-edit">Nome</FieldLabel>
						<Input
							id="nome-edit"
							name="nome"
							placeholder="Nome do funcionário"
							value={nome}
							onChange={(e) => setNome(e.target.value)}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="conta-edit">Conta</FieldLabel>
						<Input
							id="conta-edit"
							name="conta"
							placeholder="Conta bancária"
							value={conta}
							onChange={(e) => setConta(e.target.value)}
							required
						/>
					</Field>
					<Field>
						<FieldLabel>Função</FieldLabel>
						<Select value={funcao} onValueChange={setFuncao} required>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Selecione a função" />
							</SelectTrigger>
							<SelectContent>
								{OPCOES_FUNCAO.map((op) => (
									<SelectItem key={op} value={op}>
										{op}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel>Modalidade</FieldLabel>
						<Select value={modalidade} onValueChange={setModalidade} required>
							<SelectTrigger className="w-full">
								<SelectValue placeholder="Selecione a modalidade" />
							</SelectTrigger>
							<SelectContent>
								{OPCOES_MODALIDADE.map((op) => (
									<SelectItem key={op} value={op}>
										{op}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</Field>
					{fetcher.data?.error && (
						<p className="text-sm text-destructive">{fetcher.data.error}</p>
					)}
					<DialogFooter className="flex-row justify-between sm:justify-between">
						<Button
							type="button"
							variant="destructive"
							onClick={handleExcluir}
							disabled={fetcher.state !== "idle"}
							className="mr-auto"
						>
							<Trash2 className="size-4" />
							Excluir
						</Button>
						<div className="flex gap-2">
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Cancelar
							</Button>
							<Button
								type="submit"
								disabled={
									fetcher.state !== "idle" ||
									!nome.trim() ||
									!conta.trim() ||
									!funcao.trim() ||
									!modalidade.trim()
								}
							>
								{fetcher.state !== "idle" ? "Salvando..." : "Salvar"}
							</Button>
						</div>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
