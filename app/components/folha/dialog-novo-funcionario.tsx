import { UserPlus } from "lucide-react";
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

export const OPCOES_FUNCAO = ["adm", "contrato", "coordenador", "estagiario", "professor"] as const;
export const OPCOES_MODALIDADE = [
	"aulas",
	"ballet",
	"Boxe",
	"geral",
	"judo",
	"karate",
	"Kung Fu",
	"musculacao",
	"muaithay",
	"natacao",
	"pilates",
	"prime",
] as const;

export function DialogNovoFuncionario() {
	const [open, setOpen] = useState(false);
	const [nome, setNome] = useState("");
	const [conta, setConta] = useState("");
	const [funcao, setFuncao] = useState<string>("");
	const [modalidade, setModalidade] = useState<string>("");
	const fetcher = useFetcher();

	const resetForm = useCallback(() => {
		setNome("");
		setConta("");
		setFuncao("");
		setModalidade("");
	}, []);

	useEffect(() => {
		if (open) resetForm();
	}, [open, resetForm]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!nome.trim() || !conta.trim() || !funcao.trim() || !modalidade.trim())
			return;

		fetcher.submit(
			{
				intent: "novoFuncionario",
				nome: nome.trim(),
				conta: conta.trim(),
				funcao: funcao.trim(),
				modalidade: modalidade.trim(),
			},
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
				<Button size="sm" variant="outline">
					<UserPlus className="size-4" />
					Novo funcionário
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Cadastrar funcionário</DialogTitle>
					<DialogDescription>
						Preencha os dados do novo funcionário.
					</DialogDescription>
				</DialogHeader>
				<fetcher.Form onSubmit={handleSubmit} className="space-y-4">
					<input type="hidden" name="intent" value="novoFuncionario" />
					<Field>
						<FieldLabel htmlFor="nome-func">Nome</FieldLabel>
						<Input
							id="nome-func"
							name="nome"
							placeholder="Nome do funcionário"
							value={nome}
							onChange={(e) => setNome(e.target.value)}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="conta-func">Conta</FieldLabel>
						<Input
							id="conta-func"
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
					<DialogFooter>
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
							{fetcher.state !== "idle" ? "Salvando..." : "Cadastrar"}
						</Button>
					</DialogFooter>
				</fetcher.Form>
			</DialogContent>
		</Dialog>
	);
}
