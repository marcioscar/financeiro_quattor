import {
	BarChart3,
	ChevronDown,
	PieChart as PieChartIcon,
	Wallet,
} from "lucide-react";
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
	atualizarSalarioPorMesAno,
	criarFuncionario,
	criarSalarioAPagar,
	excluirFuncionario,
	getFolhasComSalariosUltimos3Meses,
	getMesAtual,
} from "~/models/folha.server";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	XAxis,
	YAxis,
} from "recharts";
import type { ChartConfig } from "~/components/ui/chart";
import {
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "~/components/ui/chart";
import { cn } from "~/lib/utils";

const TODOS = "Todos";

const MESES_NOME = [
	"Jan",
	"Fev",
	"Mar",
	"Abr",
	"Mai",
	"Jun",
	"Jul",
	"Ago",
	"Set",
	"Out",
	"Nov",
	"Dez",
];

const chartConfigSalarios: ChartConfig = {
	total: {
		label: "Total pago",
		color: "var(--chart-2)",
	},
} as const;

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
	const { folhas, totalSalariosPagosMesAtual } =
		await getFolhasComSalariosUltimos3Meses();
	return { folhas, totalSalariosPagosMesAtual };
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

	if (intent === "editarSalarioMesAtual") {
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

		const { mes, ano } = getMesAtual();

		try {
			await atualizarSalarioPorMesAno(
				folhaId,
				mes,
				ano,
				valor,
				data,
				marcarComoPago,
			);
			return { success: true };
		} catch {
			return { error: "Erro ao atualizar salário do mês" };
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

function classeFundoCardFolha(folha: {
	salarioMesAtualDetalhes: { pago: boolean } | null | undefined;
	salarioAPagarDetalhes: { data: Date } | null | undefined;
}): string {
	if (folha.salarioMesAtualDetalhes?.pago) return "bg-olive-300";
	const temSalarioNoMesAtual =
		folha.salarioMesAtualDetalhes != null ||
		isSalarioPagarNoMesAtual(folha.salarioAPagarDetalhes);
	if (temSalarioNoMesAtual) return "bg-white";
	return "bg-orange-100";
}

export default function Folha() {
	const { folhas, totalSalariosPagosMesAtual } = useLoaderData<typeof loader>();
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

	const graficoSalariosUltimos3Meses = useMemo(() => {
		const porMes = new Map<
			string,
			{ mes: number; ano: number; total: number }
		>();
		const hoje = new Date();
		const mesHoje = hoje.getMonth();
		const anoHoje = hoje.getFullYear();
		const mesesValidos = new Set<string>();
		for (let i = 0; i < 4; i++) {
			const d = new Date(anoHoje, mesHoje - i, 1);
			mesesValidos.add(`${d.getFullYear()}-${d.getMonth()}`);
		}

		for (const folha of folhas) {
			for (const sal of folha.salariosUltimos3Meses ?? []) {
				if (sal.data == null || sal.valor == null) continue;
				const d = new Date(sal.data);
				const mes = d.getMonth();
				const ano = d.getFullYear();
				const key = `${ano}-${mes}`;
				if (!mesesValidos.has(key)) continue;
				const atual = porMes.get(key);
				if (atual) {
					atual.total += sal.valor;
				} else {
					porMes.set(key, { mes, ano, total: sal.valor });
				}
			}
		}

		return Array.from(porMes.values())
			.sort(
				(a, b) =>
					new Date(a.ano, a.mes).getTime() - new Date(b.ano, b.mes).getTime(),
			)
			.map(({ mes, ano, total }) => ({
				mesLabel: `${MESES_NOME[mes]}/${String(ano).slice(-2)}`,
				total,
			}));
	}, [folhas]);

	const CORES_GRAFICO = [
		"var(--chart-1)",
		"var(--chart-2)",
		"var(--chart-3)",
		"var(--chart-4)",
		"var(--chart-5)",
	];

	const graficoPizzaSalariosPorArea = useMemo(() => {
		const porArea = new Map<string, number>();
		for (const folha of folhas) {
			const detalhes = folha.salarioMesAtualDetalhes;
			if (!detalhes?.valor) continue;
			const area = folha.funcao || "Outros";
			porArea.set(area, (porArea.get(area) ?? 0) + detalhes.valor);
		}
		return Array.from(porArea.entries())
			.map(([name, value]) => ({ name, value }))
			.sort((a, b) => b.value - a.value);
	}, [folhas]);

	const chartConfigPizza = useMemo(
		() =>
			({
				...Object.fromEntries(
					graficoPizzaSalariosPorArea.map((item, i) => [
						item.name,
						{
							label: item.name,
							color: `var(--chart-${(i % 5) + 1})`,
						},
					]),
				),
			}) satisfies ChartConfig,
		[graficoPizzaSalariosPorArea],
	);

	const graficoPizzaSalariosPorModalidade = useMemo(() => {
		const porModalidade = new Map<string, number>();
		for (const folha of folhas) {
			const detalhes = folha.salarioMesAtualDetalhes;
			if (!detalhes?.valor) continue;
			const modalidade = folha.modalidade || "Outros";
			porModalidade.set(
				modalidade,
				(porModalidade.get(modalidade) ?? 0) + detalhes.valor,
			);
		}
		return Array.from(porModalidade.entries())
			.map(([name, value]) => ({ name, value }))
			.sort((a, b) => b.value - a.value);
	}, [folhas]);

	const chartConfigPizzaModalidade = useMemo(
		() =>
			({
				...Object.fromEntries(
					graficoPizzaSalariosPorModalidade.map((item, i) => [
						item.name,
						{
							label: item.name,
							color: `var(--chart-${(i % 5) + 1})`,
						},
					]),
				),
			}) satisfies ChartConfig,
		[graficoPizzaSalariosPorModalidade],
	);

	function formatarMoedaEixo(v: unknown): string {
		const num = typeof v === "number" && !isNaN(v) ? v : 0;
		return new Intl.NumberFormat("pt-BR", {
			maximumFractionDigits: 0,
			minimumFractionDigits: 0,
		}).format(num);
	}

	return (
		<div className='space-y-6'>
			<div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
				<h1 className='text-xl font-medium tracking-tight text-orange-500'>
					Folha de Pagamento
				</h1>
				<div className='flex flex-wrap gap-4'>
					<div className='rounded-lg border bg-stone-50 px-4 py-2'>
						<p className='text-xs font-medium text-stone-500'>
							Total a pagar no mês
						</p>
						<p className='text-lg font-semibold text-orange-600'>
							{formatarMoeda(totalSalariosAPagarMesAtual)}
						</p>
					</div>
					<div className='rounded-lg border bg-stone-50 px-4 py-2'>
						<p className='text-xs font-medium text-stone-500'>
							Salários pagos no mês
						</p>
						<p className='text-lg font-semibold text-green-600'>
							{formatarMoeda(totalSalariosPagosMesAtual)}
						</p>
					</div>
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
					<Card
						key={folha.id}
						className={cn("overflow-hidden", classeFundoCardFolha(folha))}>
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
							{folha.salarioMesAtualDetalhes && (
								<div className='flex items-center gap-2'>
									<p className='text-sm font-medium text-amber-600'>
										{formatarMoeda(folha.salarioMesAtualDetalhes.valor)}
										{folha.salarioMesAtualDetalhes.pago && (
											<span className='ml-1 text-xs font-normal text-green-600'>
												(pago)
											</span>
										)}
									</p>
									<DialogEditarSalario
										folhaId={folha.id}
										nome={folha.nome}
										conta={folha.conta}
										valor={folha.salarioMesAtualDetalhes.valor}
										data={folha.salarioMesAtualDetalhes.data}
										porMesAtual
										jaPago={folha.salarioMesAtualDetalhes.pago}
									/>
								</div>
							)}
							{folha.salarioAPagar != null &&
								folha.salarioAPagarDetalhes &&
								!isSalarioPagarNoMesAtual(folha.salarioAPagarDetalhes) && (
									<div className='flex items-center gap-2'>
										<p className='text-sm font-medium text-amber-600'>
											A pagar: {formatarMoeda(folha.salarioAPagar)}
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

			<div className='mt-8 space-y-8'>
				<div className='grid gap-8 lg:grid-cols-2'>
					<Card>
						<CardHeader>
							<div className='flex items-center gap-2'>
								<PieChartIcon className='h-5 w-5 text-orange-500' />
								<CardTitle>Salários por área — mês atual</CardTitle>
							</div>
						</CardHeader>
						<CardContent>
							{graficoPizzaSalariosPorArea.length > 0 ? (
								<ChartContainer
									config={chartConfigPizza}
									className='mx-auto aspect-square h-[300px] max-w-[400px]'>
									<PieChart>
										<ChartTooltip
											content={
												<ChartTooltipContent
													hideIndicator
													formatter={(value, name) => (
														<div className='flex flex-col gap-0.5'>
															<span className='font-medium'>{name}</span>
															<span className='font-mono text-foreground'>
																{new Intl.NumberFormat("pt-BR", {
																	style: "currency",
																	currency: "BRL",
																}).format(value as number)}
															</span>
														</div>
													)}
												/>
											}
										/>
										<Pie
											data={graficoPizzaSalariosPorArea}
											dataKey='value'
											nameKey='name'
											cx='50%'
											cy='50%'
											innerRadius={60}
											outerRadius={100}
											strokeWidth={0}>
											{graficoPizzaSalariosPorArea.map((_, index) => (
												<Cell
													key={`cell-${index}`}
													fill={CORES_GRAFICO[index % CORES_GRAFICO.length]}
												/>
											))}
										</Pie>
										<ChartLegend content={<ChartLegendContent />} />
									</PieChart>
								</ChartContainer>
							) : (
								<div className='flex h-[200px] items-center justify-center rounded-lg border border-dashed bg-muted/30'>
									<p className='text-sm text-muted-foreground'>
										Sem dados de salários no mês atual
									</p>
								</div>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className='flex items-center gap-2'>
								<PieChartIcon className='h-5 w-5 text-orange-500' />
								<CardTitle>Salários por modalidade — mês atual</CardTitle>
							</div>
						</CardHeader>
						<CardContent>
							{graficoPizzaSalariosPorModalidade.length > 0 ? (
								<ChartContainer
									config={chartConfigPizzaModalidade}
									className='mx-auto aspect-square h-[300px] max-w-[400px]'>
									<PieChart>
										<ChartTooltip
											content={
												<ChartTooltipContent
													hideIndicator
													formatter={(value, name) => (
														<div className='flex flex-col gap-0.5'>
															<span className='font-medium'>{name}</span>
															<span className='font-mono text-foreground'>
																{new Intl.NumberFormat("pt-BR", {
																	style: "currency",
																	currency: "BRL",
																}).format(value as number)}
															</span>
														</div>
													)}
												/>
											}
										/>
										<Pie
											data={graficoPizzaSalariosPorModalidade}
											dataKey='value'
											nameKey='name'
											cx='50%'
											cy='50%'
											innerRadius={60}
											outerRadius={100}
											strokeWidth={0}>
											{graficoPizzaSalariosPorModalidade.map((_, index) => (
												<Cell
													key={`cell-mod-${index}`}
													fill={CORES_GRAFICO[index % CORES_GRAFICO.length]}
												/>
											))}
										</Pie>
										<ChartLegend
											content={
												<ChartLegendContent className='flex-wrap justify-center' />
											}
										/>
									</PieChart>
								</ChartContainer>
							) : (
								<div className='flex h-[200px] items-center justify-center rounded-lg border border-dashed bg-muted/30'>
									<p className='text-sm text-muted-foreground'>
										Sem dados de salários no mês atual
									</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<BarChart3 className='h-5 w-5 text-orange-500' />
							<CardTitle>Comparativo de salários — últimos meses</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{graficoSalariosUltimos3Meses.length > 0 ? (
							<ChartContainer
								config={chartConfigSalarios}
								className='h-[280px] w-full'>
								<BarChart
									data={graficoSalariosUltimos3Meses}
									margin={{ bottom: 20 }}>
									<CartesianGrid strokeDasharray='3 3' vertical={false} />
									<XAxis
										dataKey='mesLabel'
										tickLine={false}
										axisLine={false}
										tickMargin={8}
									/>
									<YAxis
										tickLine={false}
										axisLine={false}
										tickMargin={8}
										tickFormatter={(v) => formatarMoedaEixo(v)}
									/>
									<ChartTooltip
										content={
											<ChartTooltipContent
												formatter={(value) =>
													new Intl.NumberFormat("pt-BR", {
														style: "currency",
														currency: "BRL",
													}).format(value as number)
												}
											/>
										}
									/>
									<Bar dataKey='total' radius={[4, 4, 0, 0]}>
										{graficoSalariosUltimos3Meses.map((_, idx) => (
											<Cell
												key={idx}
												fill={CORES_GRAFICO[idx % CORES_GRAFICO.length]}
											/>
										))}
									</Bar>
								</BarChart>
							</ChartContainer>
						) : (
							<div className='flex h-[200px] items-center justify-center rounded-lg border border-dashed bg-muted/30'>
								<p className='text-sm text-muted-foreground'>
									Sem dados de salários nos últimos meses
								</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
