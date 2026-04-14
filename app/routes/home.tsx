import { useRef, useMemo } from "react";
import { useLoaderData, useSearchParams, useFetcher } from "react-router";
import type { Route } from "./+types/home";
import { getAlunosAtivos, getCancelamentosNoMes } from "~/models/evo.server";
import {
	getDespesasFixasDoMes,
	getDespesasPorCategoriaDoMes,
	getDespesasTotaisDoMes,
} from "~/models/despesas.server";
import {
	getRecebimentosDoMesAtual,
	salvarContasReceber,
} from "~/models/recebimentos.server";
import { getFaturamentoDoMes } from "~/models/receitas.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import {
	Users,
	AlertCircle,
	Wallet,
	Ticket,
	UserMinus,
	TrendingUp,
	Calendar,
	DollarSign,
	Receipt,
	PiggyBank,
	Percent,
	BarChart3,
	PieChart as PieChartIcon,
	Upload,
} from "lucide-react";
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

const MESES = [
	{ valor: 1, label: "Janeiro" },
	{ valor: 2, label: "Fevereiro" },
	{ valor: 3, label: "Março" },
	{ valor: 4, label: "Abril" },
	{ valor: 5, label: "Maio" },
	{ valor: 6, label: "Junho" },
	{ valor: 7, label: "Julho" },
	{ valor: 8, label: "Agosto" },
	{ valor: 9, label: "Setembro" },
	{ valor: 10, label: "Outubro" },
	{ valor: 11, label: "Novembro" },
	{ valor: 12, label: "Dezembro" },
];

function obterAnosDisponiveis(): number[] {
	const anoAtual = new Date().getFullYear();
	const anos: number[] = [];
	for (let a = anoAtual; a >= anoAtual - 3; a--) anos.push(a);
	return anos;
}

export function meta({}: Route.MetaArgs) {
	return [
		{ title: "Financeiro Quattor" },
		{ name: "description", content: "Financeiro Quattor" },
	];
}

export async function action({ request }: Route.ActionArgs) {
	if (request.method !== "POST") return null;

	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "upload_contas_receber") {
		const file = formData.get("arquivo");
		if (!(file instanceof File) || file.size === 0) {
			return { error: "Selecione um arquivo Excel (.xlsx)" };
		}
		const ext = file.name.toLowerCase().slice(-5);
		if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
			return { error: "Formato inválido. Use .xlsx ou .xls" };
		}
		try {
			const buffer = Buffer.from(await file.arrayBuffer());
			await salvarContasReceber(buffer);
			return { success: true };
		} catch (err) {
			const msg =
				err instanceof Error ? err.message : "Erro ao salvar arquivo";
			return { error: msg };
		}
	}

	return null;
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const mesParam = url.searchParams.get("mes");
	const anoParam = url.searchParams.get("ano");

	const hoje = new Date();
	const mes =
		mesParam !== null && mesParam !== ""
			? Math.min(12, Math.max(1, parseInt(mesParam, 10) || hoje.getMonth() + 1))
			: hoje.getMonth() + 1;
	const ano =
		anoParam !== null && anoParam !== ""
			? parseInt(anoParam, 10) || hoje.getFullYear()
			: hoje.getFullYear();

	const dataReferencia = new Date(ano, mes - 1, 1);

	// Dados para gráfico: últimos 6 meses (incluindo o mês selecionado)
	const quantidadeMeses = 6;
	const mesesChart: { mes: number; ano: number; mesLabel: string }[] = [];
	for (let i = quantidadeMeses - 1; i >= 0; i--) {
		const d = new Date(ano, mes - 1 - i, 1);
		const m = d.getMonth() + 1;
		const a = d.getFullYear();
		mesesChart.push({
			mes: m,
			ano: a,
			mesLabel: MESES_NOME[m - 1] + "/" + String(a).slice(-2),
		});
	}

	const evolucaoFinanceira = await Promise.all(
		mesesChart.map(async ({ mes: m, ano: a, mesLabel }) => {
			const dataRef = new Date(a, m - 1, 1);
			const [receitas, despesas] = await Promise.all([
				getFaturamentoDoMes(dataRef),
				getDespesasTotaisDoMes(a, m),
			]);
			return { mesLabel, receitas, despesas };
		}),
	);

	// getAlunosAtivos: API EVO retorna apenas clientes ativos no momento, sem histórico
	const [
		alunosResult,
		recebimentosResult,
		cancelamentosResult,
		despesasFixas,
		faturamentoMes,
		despesasTotaisMes,
		composicaoDespesas,
	] = await Promise.all([
		getAlunosAtivos(new Date()),
		getRecebimentosDoMesAtual(),
		getCancelamentosNoMes(dataReferencia),
		getDespesasFixasDoMes(ano, mes),
		getFaturamentoDoMes(dataReferencia),
		getDespesasTotaisDoMes(ano, mes),
		getDespesasPorCategoriaDoMes(ano, mes),
	]);

	return {
		mes,
		ano,
		evolucaoFinanceira,
		composicaoDespesas,
		totalAlunosAtivos: alunosResult.alunos.length,
		erroAlunos: alunosResult.erro,
		recebimentosMes: recebimentosResult.valor,
		erroRecebimentos: recebimentosResult.erro,
		totalCancelamentos: cancelamentosResult.total,
		erroCancelamentos: cancelamentosResult.erro,
		despesasFixasMes: despesasFixas,
		faturamentoMes,
		despesasTotaisMes,
	};
}

export default function Home() {
	const [searchParams, setSearchParams] = useSearchParams();
	const fetcher = useFetcher<{ success?: boolean; error?: string }>();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const {
		mes,
		ano,
		evolucaoFinanceira,
		composicaoDespesas,
		totalAlunosAtivos,
		erroAlunos,
		recebimentosMes,
		erroRecebimentos,
		totalCancelamentos,
		erroCancelamentos,
		despesasFixasMes,
		faturamentoMes,
		despesasTotaisMes,
	} = useLoaderData<typeof loader>();

	const chartConfig = {
		receitas: {
			label: "Receitas",
			color: "var(--chart-1)",
		},
		despesas: {
			label: "Despesas",
			color: "var(--chart-2)",
		},
		...Object.fromEntries(
			composicaoDespesas.map((item, i) => [
				item.conta,
				{
					label: item.conta,
					color: `var(--chart-${(i % 5) + 1})`,
				},
			]),
		),
	} satisfies ChartConfig;

	const PIE_COLORS = [
		"var(--chart-1)",
		"var(--chart-2)",
		"var(--chart-3)",
		"var(--chart-4)",
		"var(--chart-5)",
	];

	const dadosComposicao = composicaoDespesas.map((x) => ({
		name: x.conta,
		value: x.valor,
	}));

	const ticketMedio =
		totalAlunosAtivos > 0 ? recebimentosMes / totalAlunosAtivos : 0;
	const pontoEquilibrio = ticketMedio > 0 ? despesasFixasMes / ticketMedio : 0;
	const lucroLiquido = faturamentoMes - despesasTotaisMes;
	const margemLucro =
		faturamentoMes > 0 ? (lucroLiquido / faturamentoMes) * 100 : 0;

	const anosDisponiveis = useMemo(() => {
		const base = obterAnosDisponiveis();
		return base.includes(ano) ? base : [ano, ...base].sort((a, b) => b - a);
	}, [ano]);

	function handleMesChange(valor: string) {
		const params = new URLSearchParams(searchParams);
		params.set("mes", valor);
		if (!params.has("ano")) params.set("ano", String(ano));
		setSearchParams(params);
	}

	function handleAnoChange(valor: string) {
		const params = new URLSearchParams(searchParams);
		params.set("ano", valor);
		if (!params.has("mes")) params.set("mes", String(mes));
		setSearchParams(params);
	}

	return (
		<div className='space-y-6'>
			<div className='flex flex-wrap items-center gap-4'>
				<div className='flex items-center gap-2'>
					<Calendar className='h-5 w-5 text-muted-foreground' />
					<span className='text-sm font-medium text-muted-foreground'>
						Período:
					</span>
				</div>
				<div className='flex items-center gap-2'>
					<Select value={String(mes)} onValueChange={handleMesChange}>
						<SelectTrigger className='w-[140px]'>
							<SelectValue placeholder='Mês' />
						</SelectTrigger>
						<SelectContent>
							{MESES.map((m) => (
								<SelectItem key={m.valor} value={String(m.valor)}>
									{m.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select value={String(ano)} onValueChange={handleAnoChange}>
						<SelectTrigger className='w-[100px]'>
							<SelectValue placeholder='Ano' />
						</SelectTrigger>
						<SelectContent>
							{anosDisponiveis.map((a) => (
								<SelectItem key={a} value={String(a)}>
									{a}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<fetcher.Form method="post" className="flex items-center">
						<input type="hidden" name="intent" value="upload_contas_receber" />
						<input
							ref={fileInputRef}
							type="file"
							name="arquivo"
							accept=".xlsx,.xls"
							className="hidden"
							onChange={(e) => {
								const form = e.target.form;
								if (form && e.target.files?.[0]) {
									fetcher.submit(form, { method: "post" });
								}
							}}
						/>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={fetcher.state !== "idle"}
						>
							<Upload className="mr-2 h-4 w-4" />
							{fetcher.state === "submitting"
								? "Enviando..."
								: "Enviar Excel contas a receber"}
						</Button>
					</fetcher.Form>
				</div>
			</div>

			{fetcher.data?.error && (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
					{fetcher.data.error}
				</div>
			)}
			{fetcher.data?.success && fetcher.state === "idle" && (
				<div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
					Arquivo salvo com sucesso. A Receita Recorrente foi atualizada.
				</div>
			)}

			<div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<DollarSign className='h-5 w-5' />
							<CardTitle>Faturamento do mês</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl font-mono tabular-nums'>
								{new Intl.NumberFormat("pt-BR", {
									style: "currency",
									currency: "BRL",
								}).format(faturamentoMes)}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<Receipt className='h-5 w-5' />
							<CardTitle>Despesas Totais</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<div className='flex items-baseline gap-2'>
							<span className='text-2xl font-mono tabular-nums'>
								{new Intl.NumberFormat("pt-BR", {
									style: "currency",
									currency: "BRL",
								}).format(despesasTotaisMes)}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<PiggyBank className='h-5 w-5' />
							<CardTitle>Lucro Líquido</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<div className='flex items-baseline gap-2'>
							<span
								className={`text-2xl font-mono tabular-nums ${
									lucroLiquido >= 0
										? "text-emerald-600 dark:text-emerald-400"
										: "text-red-600 dark:text-red-400"
								}`}>
								{new Intl.NumberFormat("pt-BR", {
									style: "currency",
									currency: "BRL",
								}).format(lucroLiquido)}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<Percent className='h-5 w-5' />
							<CardTitle>Margem de Lucro</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<div className='flex items-baseline gap-2'>
							<span
								className={`text-2xl font-mono tabular-nums ${
									margemLucro >= 0
										? "text-emerald-600 dark:text-emerald-400"
										: "text-red-600 dark:text-red-400"
								}`}>
								{faturamentoMes > 0 ? `${margemLucro.toFixed(1)}%` : "—"}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<Wallet className='h-5 w-5' />
							<CardTitle>Receita Recorrente Mensal</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{erroRecebimentos && (
							<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
								<AlertCircle className='h-4 w-4 shrink-0' />
								<p className='text-sm'>{erroRecebimentos}</p>
							</div>
						)}
						{!erroRecebimentos && (
							<div className='flex items-baseline gap-2'>
								<span className='text-2xl font-mono tabular-nums'>
									{new Intl.NumberFormat("pt-BR", {
										style: "currency",
										currency: "BRL",
									}).format(recebimentosMes)}
								</span>
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<Users className='h-5 w-5' />
							<CardTitle>Alunos ativos </CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{erroAlunos && (
							<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
								<AlertCircle className='h-4 w-4 shrink-0' />
								<p className='text-sm'>{erroAlunos}</p>
							</div>
						)}
						{!erroAlunos && (
							<div className='flex justify-center items-baseline gap-2'>
								<span className='text-2xl font-mono tabular-nums'>
									{totalAlunosAtivos}
								</span>
							</div>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<UserMinus className='h-5 w-5' />
							<CardTitle>Taxa de Evasão (mês)</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{erroCancelamentos && (
							<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
								<AlertCircle className='h-4 w-4 shrink-0' />
								<p className='text-sm'>{erroCancelamentos}</p>
							</div>
						)}
						{!erroCancelamentos && (
							<div className='space-y-1'>
								<div className='flex items-baseline gap-2'>
									<span className='text-2xl font-mono tabular-nums'>
										{totalAlunosAtivos > 0
											? (
													(totalCancelamentos / totalAlunosAtivos) *
													100
												).toFixed(2) + "%"
											: "—"}
									</span>
								</div>
								<p className='text-sm text-muted-foreground'>
									{totalCancelamentos}{" "}
									{totalCancelamentos === 1 ? "cancelamento" : "cancelamentos"}{" "}
									no mês
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<TrendingUp className='h-5 w-5' />
							<CardTitle>Ponto de Equilíbrio</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{erroAlunos ? (
							<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
								<AlertCircle className='h-4 w-4 shrink-0' />
								<p className='text-sm'>{erroAlunos}</p>
							</div>
						) : ticketMedio > 0 ? (
							<div className='space-y-1'>
								<div className='flex items-baseline gap-2'>
									<span className='text-2xl font-mono tabular-nums'>
										{Math.ceil(pontoEquilibrio)}
									</span>
									<span className='text-muted-foreground'>alunos</span>
								</div>
							</div>
						) : (
							<span className='text-muted-foreground'>—</span>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className='flex items-center gap-2'>
							<Ticket className='h-5 w-5' />
							<CardTitle>Ticket Médio</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						{erroAlunos && (
							<div className='flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200'>
								<AlertCircle className='h-4 w-4 shrink-0' />
								<p className='text-sm'>{erroAlunos}</p>
							</div>
						)}
						{!erroAlunos && totalAlunosAtivos > 0 && (
							<div className='flex items-baseline gap-2'>
								<span className='text-2xl font-mono tabular-nums'>
									{new Intl.NumberFormat("pt-BR", {
										style: "currency",
										currency: "BRL",
									}).format(recebimentosMes / totalAlunosAtivos)}
								</span>
							</div>
						)}
						{!erroAlunos && totalAlunosAtivos === 0 && (
							<span className='text-muted-foreground'>—</span>
						)}
					</CardContent>
				</Card>
			</div>

			<Card className='mt-8'>
				<CardHeader>
					<div className='flex items-center gap-2'>
						<BarChart3 className='h-5 w-5' />
						<CardTitle>Receitas x Despesas (Mês a Mês)</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					<ChartContainer config={chartConfig} className='h-[300px] w-full'>
						<BarChart data={evolucaoFinanceira} margin={{ bottom: 20 }}>
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
								tickFormatter={(v) =>
									new Intl.NumberFormat("pt-BR", {
										style: "currency",
										currency: "BRL",
										maximumFractionDigits: 0,
									}).format(v)
								}
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
							<Bar
								dataKey='receitas'
								fill='var(--color-despesas)'
								radius={[4, 4, 0, 0]}
							/>
							<Bar
								dataKey='despesas'
								fill='var(--color-receitas)'
								radius={[4, 4, 0, 0]}
							/>
							<ChartLegend content={<ChartLegendContent />} />
						</BarChart>
					</ChartContainer>
				</CardContent>
			</Card>

			<Card className="mt-8">
				<CardHeader>
					<div className="flex items-center gap-2">
						<PieChartIcon className="h-5 w-5" />
						<CardTitle>Composição de Custos</CardTitle>
					</div>
					<p className="text-sm text-muted-foreground">
						Despesas por categoria do mês — identifique onde reduzir gastos
					</p>
				</CardHeader>
				<CardContent>
					{composicaoDespesas.length > 0 ? (
						<ChartContainer
							config={chartConfig}
							className="mx-auto aspect-square h-[300px] max-w-[400px]"
						>
							<PieChart>
								<ChartTooltip
									content={
										<ChartTooltipContent
											hideIndicator
											formatter={(value, name) => (
												<div className="flex flex-col gap-0.5">
													<span className="font-medium">{name}</span>
													<span className="font-mono text-foreground">
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
									data={dadosComposicao}
									dataKey="value"
									nameKey="name"
									cx="50%"
									cy="50%"
									innerRadius={60}
									outerRadius={100}
									strokeWidth={0}
								>
									{dadosComposicao.map((_, index) => (
										<Cell
											key={`cell-${index}`}
											fill={PIE_COLORS[index % PIE_COLORS.length]}
										/>
									))}
								</Pie>
								<ChartLegend content={<ChartLegendContent />} />
							</PieChart>
						</ChartContainer>
					) : (
						<p className="py-8 text-center text-sm text-muted-foreground">
							Nenhuma despesa no mês selecionado
						</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
