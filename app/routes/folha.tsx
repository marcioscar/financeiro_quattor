import { ChevronDown, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import type { Route } from "./+types/folha";
import { useLoaderData } from "react-router";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { Toggle } from "~/components/ui/toggle";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "~/components/ui/combobox";
import { DialogEditarFuncionario } from "~/components/folha/dialog-editar-funcionario";
import { DialogEditarSalario } from "~/components/folha/dialog-editar-salario";
import { DialogNovoFuncionario } from "~/components/folha/dialog-novo-funcionario";
import { DialogNovoSalario } from "~/components/folha/dialog-novo-salario";
import {
	atualizarFuncionario,
	atualizarSalarioAPagar,
	criarFuncionario,
	criarSalarioAPagar,
	excluirFuncionario,
	getFolhasComSalariosUltimos3Meses,
} from "~/models/folha.server";

const TODOS = "Todos";

function formatarData(date: Date | null | undefined): string {
	if (!date) return "-";
	return new Date(date).toLocaleDateString("pt-BR", {
		month: "2-digit",
		year: "numeric",
	});
}

function formatarMoeda(valor: number | null | undefined): string {
	if (valor == null) return "-";
	return new Intl.NumberFormat("pt-BR", {
		style: "currency",
		currency: "BRL",
	}).format(valor);
}

export async function loader({ request }: Route.LoaderArgs) {
	const folhas = await getFolhasComSalariosUltimos3Meses();
	return { folhas };
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return { error: "Método inválido" };

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "editarFuncionario") {
		const folhaId = formData.get("folhaId");
		const nome = formData.get("nome");
		const conta = formData.get("conta");
		const funcao = formData.get("funcao");
		const modalidade = formData.get("modalidade");

		if (
			typeof folhaId !== "string" ||
			!folhaId ||
			typeof nome !== "string" ||
			!nome.trim() ||
			typeof conta !== "string" ||
			!conta.trim() ||
			typeof funcao !== "string" ||
			!funcao.trim() ||
			typeof modalidade !== "string" ||
			!modalidade.trim()
		) {
			return { error: "Preencha todos os campos" };
		}

		try {
			await atualizarFuncionario(
				folhaId,
				nome.trim(),
				conta.trim(),
				funcao.trim(),
				modalidade.trim(),
			);
			return { success: true };
		} catch {
			return { error: "Erro ao atualizar funcionário" };
		}
	}

	if (intent === "excluirFuncionario") {
		const folhaId = formData.get("folhaId");

		if (typeof folhaId !== "string" || !folhaId) {
			return { error: "ID do funcionário inválido" };
		}

		try {
			await excluirFuncionario(folhaId);
			return { success: true };
		} catch {
			return { error: "Erro ao excluir funcionário" };
		}
	}

	if (intent === "novoFuncionario") {
		const nome = formData.get("nome");
		const conta = formData.get("conta");
		const funcao = formData.get("funcao");
		const modalidade = formData.get("modalidade");

		if (
			typeof nome !== "string" ||
			!nome.trim() ||
			typeof conta !== "string" ||
			!conta.trim() ||
			typeof funcao !== "string" ||
			!funcao.trim() ||
			typeof modalidade !== "string" ||
			!modalidade.trim()
		) {
			return { error: "Preencha todos os campos" };
		}

		try {
			await criarFuncionario(
				nome.trim(),
				conta.trim(),
				funcao.trim(),
				modalidade.trim(),
			);
			return { success: true };
		} catch {
			return { error: "Erro ao cadastrar funcionário" };
		}
	}

	if (intent === "editar") {
		const folhaId = formData.get("folhaId");
		const valorStr = formData.get("valor");
		const dataStr = formData.get("data");
		const marcarComoPago = formData.get("marcarComoPago") === "1";

		if (
			typeof folhaId !== "string" ||
			!folhaId ||
			typeof valorStr !== "string" ||
			!valorStr ||
			typeof dataStr !== "string" ||
			!dataStr
		) {
			return { error: "Preencha todos os campos" };
		}

		const valor = parseFloat(valorStr.replace(",", "."));
		if (isNaN(valor) || valor <= 0) {
			return { error: "Valor inválido" };
		}

		const data = new Date(dataStr);
		if (isNaN(data.getTime())) {
			return { error: "Data inválida" };
		}

		try {
			await atualizarSalarioAPagar(folhaId, valor, data, marcarComoPago);
			return { success: true };
		} catch {
			return { error: "Erro ao atualizar salário" };
		}
	}

	const folhaId = formData.get("folhaId");
	const valorStr = formData.get("valor");
	const dataStr = formData.get("data");

	if (
		typeof folhaId !== "string" ||
		!folhaId ||
		typeof valorStr !== "string" ||
		!valorStr ||
		typeof dataStr !== "string" ||
		!dataStr
	) {
		return { error: "Preencha todos os campos" };
	}

	const valor = parseFloat(valorStr.replace(",", "."));
	if (isNaN(valor) || valor <= 0) {
		return { error: "Valor inválido" };
	}

	const data = new Date(dataStr);
	if (isNaN(data.getTime())) {
		return { error: "Data inválida" };
	}

	try {
		await criarSalarioAPagar(folhaId, valor, data);
		return { success: true };
	} catch {
		return { error: "Erro ao cadastrar salário" };
	}
}

function isSalarioPagarNoMesAtual(
	detalhes: { data: Date } | null | undefined,
): boolean {
	if (!detalhes?.data) return false;
	const data = new Date(detalhes.data);
	const hoje = new Date();
	return (
		data.getMonth() === hoje.getMonth() &&
		data.getFullYear() === hoje.getFullYear()
	);
}

export default function Folha() {
	const { folhas } = useLoaderData<typeof loader>();
	const [filtroNome, setFiltroNome] = useState<string | null>();
	const [mostrarSemSalarioPagar, setMostrarSemSalarioPagar] = useState(false);
	const anchorRef = useComboboxAnchor();

	const nomes = useMemo(
		() => [TODOS, ...[...new Set(folhas.map((f) => f.nome))].sort()],
		[folhas],
	);

	const folhasFiltradas = useMemo(() => {
		let resultado = folhas;
		if (filtroNome && filtroNome !== TODOS) {
			resultado = resultado.filter((f) => f.nome === filtroNome);
		}
		if (mostrarSemSalarioPagar) {
			resultado = resultado.filter((f) => {
				if (f.salarioAPagar == null) return true;
				return !isSalarioPagarNoMesAtual(f.salarioAPagarDetalhes);
			});
		}
		return resultado;
	}, [folhas, filtroNome, mostrarSemSalarioPagar]);

	const totalSalariosAPagarMesAtual = useMemo(() => {
		return folhas.reduce((acc, f) => {
			if (
				f.salarioAPagar != null &&
				f.salarioAPagarDetalhes &&
				isSalarioPagarNoMesAtual(f.salarioAPagarDetalhes)
			) {
				return acc + f.salarioAPagar;
			}
			return acc;
		}, 0);
	}, [folhas]);

	return (
		<div className='space-y-6'>
			<div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
				<h1 className='text-xl font-medium tracking-tight text-orange-500'>
					Folha de Pagamento
				</h1>
				<div className='rounded-lg border bg-stone-50 px-4 py-2'>
					<p className='text-xs font-medium text-stone-400-700'>
						Total a pagar no mês
					</p>
					<p className='text-lg font-semibold text-orange-600'>
						{formatarMoeda(totalSalariosAPagarMesAtual)}
					</p>
				</div>
			</div>
			<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
				<div className='flex flex-wrap items-center gap-3'>
					<DialogNovoFuncionario />
					<DialogNovoSalario
						folhas={folhas.map((f) => ({ id: f.id, nome: f.nome }))}
					/>
				</div>
				<div className='flex flex-wrap items-center gap-4'>
					<Toggle
						aria-label='Mostrar apenas quem não tem salário a pagar no mês'
						size='sm'
						variant='outline'
						pressed={mostrarSemSalarioPagar}
						onPressedChange={setMostrarSemSalarioPagar}
						className='group/toggle'>
						<Wallet className='group-data-[state=on]/toggle:fill-foreground' />
						Sem salário no mês
					</Toggle>
					<div ref={anchorRef} className='w-full sm:w-64'>
						<Combobox
							value={filtroNome}
							onValueChange={(v) => setFiltroNome(v)}
							items={nomes}>
							<ComboboxInput placeholder='Filtrar por funcionário' showClear />
							<ComboboxContent anchor={anchorRef}>
								<ComboboxList>
									{(nome) => (
										<ComboboxItem key={nome} value={nome}>
											{nome}
										</ComboboxItem>
									)}
								</ComboboxList>
								<ComboboxEmpty>Nenhum funcionário encontrado</ComboboxEmpty>
							</ComboboxContent>
						</Combobox>
					</div>
				</div>
			</div>

			<div className='grid gap-4 md:grid-cols-3 lg:grid-cols-3'>
				{folhasFiltradas.map((folha) => (
					<Card key={folha.id} className='overflow-hidden bg-stone-50'>
						<CardHeader className='pb-2'>
							<CardTitle className='text-base'>{folha.nome}</CardTitle>
							<CardAction>
								<DialogEditarFuncionario
									folhaId={folha.id}
									nome={folha.nome}
									conta={folha.conta}
									funcao={folha.funcao}
									modalidade={folha.modalidade}
								/>
							</CardAction>
							<CardDescription className='text-xs font-extralight text-muted-foreground'>
								{folha.funcao} • {folha.modalidade}
							</CardDescription>
							{folha.salarioAPagar != null && folha.salarioAPagarDetalhes && (
								<div className='flex items-center gap-2'>
									<p className='text-sm font-medium text-amber-600'>
										{formatarMoeda(folha.salarioAPagar)}
									</p>
									<DialogEditarSalario
										folhaId={folha.id}
										nome={folha.nome}
										conta={folha.conta}
										valor={folha.salarioAPagarDetalhes.valor}
										data={folha.salarioAPagarDetalhes.data}
									/>
								</div>
							)}
						</CardHeader>
						<CardContent className='space-y-3'>
							{folha.salariosUltimos3Meses.length > 0 ? (
								<Collapsible>
									<CollapsibleTrigger className='flex w-full items-center justify-between rounded-md border-b px-2 py-1 text-sm hover:bg-muted/50 [&[data-state=open]>svg]:rotate-180'>
										<span>Salários</span>
										<ChevronDown className='h-4 w-4 shrink-0 transition-transform' />
									</CollapsibleTrigger>
									<CollapsibleContent>
										<ul className='mt-2 space-y-2'>
											{folha.salariosUltimos3Meses.map((sal, idx) => (
												<li
													key={sal.sal_id ?? idx}
													className='flex items-center justify-between text-sm'>
													<span className='text-muted-foreground'>
														{formatarData(sal.data)}
													</span>
													<span className='font-medium'>
														{formatarMoeda(sal.valor)}
													</span>
												</li>
											))}
										</ul>
									</CollapsibleContent>
								</Collapsible>
							) : (
								<p className='text-sm text-muted-foreground'>
									Sem registros nos últimos 3 meses
								</p>
							)}
						</CardContent>
					</Card>
				))}
			</div>

			{folhasFiltradas.length === 0 && (
				<Card>
					<CardContent className='py-12 text-center text-muted-foreground'>
						Nenhum funcionário encontrado na folha.
					</CardContent>
				</Card>
			)}
		</div>
	);
}
