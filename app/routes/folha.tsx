import { BarChart3, PieChart as PieChartIcon } from "lucide-react";
import { useMemo } from "react";
import type { Route } from "./+types/folha";
import { useLoaderData } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { CardDiferencasSalarios } from "~/components/folha/card-diferencas-salarios";
import { FechamentoFolha } from "~/components/folha/fechamento-folha";
import {
	hojeFechamento,
	limitesDoPeriodo,
	mesAtualFechamento,
	montarFechamento,
	parseMesFechamento,
} from "~/lib/folha-fechamento";
import { parseTipoLancamento } from "~/lib/folha-tipos";
import { uploadReciboAndGetUrl } from "~/models/pocketbase.server";
import { formatUploadError } from "~/lib/upload-errors";
import {
	anexarComprovante,
	atualizarFuncionario,
	criarFuncionario,
	excluirFuncionario,
	getFolhasComSalarios,
	removerLancamento,
	salvarLancamentos,
} from "~/models/folha.server";
import { sincronizarDespesasSalarios } from "~/models/folha-despesas.server";
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

const chartConfigSalarios: ChartConfig = {
	total: {
		label: "Total pago",
		color: "var(--chart-2)",
	},
} as const;

export async function loader({ request }: Route.LoaderArgs) {
	// Lança/atualiza em despesas o total de salários e de 13º pagos nos meses recentes.
	await sincronizarDespesasSalarios();
	const url = new URL(request.url);
	const mesAtual = mesAtualFechamento();
	const periodo = parseMesFechamento(url.searchParams.get("mes")) ?? mesAtual;
	const tipo = parseTipoLancamento(url.searchParams.get("tipo")) ?? "salario";

	const folhas = await getFolhasComSalarios();
	const fechamento = montarFechamento(folhas, tipo, periodo);
	return { folhas, fechamento, mesAtual, hoje: hojeFechamento() };
}

/** Envia o comprovante ao PocketBase, com o mesmo prefixo de data das despesas. */
async function enviarComprovante(arquivo: File, dataStr: string) {
	const buffer = Buffer.from(await arquivo.arrayBuffer());
	return uploadReciboAndGetUrl(buffer, `folha-${dataStr}-${arquivo.name}`);
}

function lerPeriodoETipo(formData: FormData) {
	const periodo = parseMesFechamento(String(formData.get("mes") ?? ""));
	const tipo = parseTipoLancamento(formData.get("tipo"));
	return periodo && tipo ? { periodo, tipo } : null;
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

	if (intent === "salvarLancamentos") {
		const alvo = lerPeriodoETipo(formData);
		if (!alvo) return { error: "Mês ou tipo de lançamento inválido" };

		const dataStr = formData.get("data");
		const { dataMin, dataMax } = limitesDoPeriodo(alvo.tipo, alvo.periodo);
		if (
			typeof dataStr !== "string" ||
			!/^\d{4}-\d{2}-\d{2}$/.test(dataStr) ||
			dataStr < dataMin ||
			dataStr > dataMax
		) {
			return {
				error: `A data precisa estar entre ${dataMin.split("-").reverse().join("/")} e ${dataMax.split("-").reverse().join("/")}.`,
			};
		}

		let itens: { folhaId: string; valor: number }[];
		try {
			const bruto: unknown = JSON.parse(String(formData.get("itens") ?? "[]"));
			if (!Array.isArray(bruto)) throw new Error();
			itens = bruto.map((i) => {
				const valor = Number(i?.valor);
				if (typeof i?.folhaId !== "string" || !(valor > 0)) throw new Error();
				return { folhaId: i.folhaId, valor: Math.round(valor * 100) / 100 };
			});
		} catch {
			return { error: "Valores inválidos" };
		}
		if (itens.length === 0) return { error: "Selecione ao menos uma pessoa" };

		// Comprovantes anexados na hora de pagar: campo `comprovante_<folhaId>`.
		const itensComArquivo: {
			folhaId: string;
			valor: number;
			comprovante?: string;
		}[] = [];
		for (const item of itens) {
			const arquivo = formData.get(`comprovante_${item.folhaId}`);
			if (arquivo instanceof File && arquivo.size > 0) {
				try {
					const url = await enviarComprovante(arquivo, dataStr);
					itensComArquivo.push({ ...item, comprovante: url });
					continue;
				} catch (error) {
					return { error: `Comprovante: ${formatUploadError(error)}` };
				}
			}
			itensComArquivo.push(item);
		}

		try {
			await salvarLancamentos(
				alvo.tipo,
				alvo.periodo,
				new Date(dataStr),
				formData.get("pago") === "1",
				itensComArquivo,
			);
			return { success: true };
		} catch {
			return { error: "Erro ao salvar os lançamentos" };
		}
	}

	if (intent === "anexarComprovante") {
		const alvo = lerPeriodoETipo(formData);
		const folhaId = formData.get("folhaId");
		const arquivo = formData.get("comprovante");
		if (
			!alvo ||
			typeof folhaId !== "string" ||
			!folhaId ||
			!(arquivo instanceof File) ||
			arquivo.size === 0
		) {
			return { error: "Escolha o arquivo do comprovante" };
		}
		try {
			const url = await enviarComprovante(
				arquivo,
				new Date().toISOString().slice(0, 10),
			);
			await anexarComprovante(folhaId, alvo.tipo, alvo.periodo, url);
			return { success: true };
		} catch (error) {
			return { error: `Comprovante: ${formatUploadError(error)}` };
		}
	}

	if (intent === "removerLancamento") {
		const alvo = lerPeriodoETipo(formData);
		const folhaId = formData.get("folhaId");
		if (!alvo || typeof folhaId !== "string" || !folhaId) {
			return { error: "Lançamento inválido" };
		}
		try {
			await removerLancamento(folhaId, alvo.tipo, alvo.periodo);
			return { success: true };
		} catch (err) {
			return {
				error: err instanceof Error ? err.message : "Erro ao remover lançamento",
			};
		}
	}

	return { error: "Ação desconhecida" };
}

export default function Folha() {
	const { folhas, fechamento, mesAtual, hoje } = useLoaderData<typeof loader>();

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
			<h1 className='text-xl font-medium tracking-tight text-orange-500'>
				Folha de Pagamento
			</h1>

			<FechamentoFolha
				key={`${fechamento.periodo.ano}-${fechamento.periodo.mes}-${fechamento.tipo}`}
				fechamento={fechamento}
				mesAtual={mesAtual}
				hoje={hoje}
			/>

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

				<CardDiferencasSalarios folhas={folhas} />
			</div>
		</div>
	);
}
